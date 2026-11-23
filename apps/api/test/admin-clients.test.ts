import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminClientDetail, AdminClientSummary } from '@sch/shared';
import { adminClient, loginAsAdmin, type AdminClient } from './helpers/admin-session.js';
import { TEST_ORIGIN, createTestApp } from './helpers/test-app.js';
import { binary } from './helpers/binary-parser.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const FIXED_NOW = new Date('2026-11-23T18:30:00.000Z');
const app = createTestApp(prisma, { options: { now: () => FIXED_NOW.getTime() } });
let admin: AdminClient;

beforeEach(async () => {
  await resetDatabase(prisma);
  admin = adminClient(app, await loginAsAdmin(app, prisma));
});

afterAll(async () => {
  await prisma.$disconnect();
});

function validClient(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Ana Pérez',
    phone: '+54 (11) 2233-4455',
    email: 'Ana@Mail.com',
    address: 'Calle 123',
    source: 'WHATSAPP',
    notes: 'Cliente frecuente',
    ...overrides,
  };
}

async function createClient(overrides: Record<string, unknown> = {}) {
  const res = await admin.post('/api/admin/clients', validClient(overrides));
  expect(res.status).toBe(201);
  return res.body.data as AdminClientDetail;
}

async function addJob(clientId: number, data: Record<string, unknown> = {}) {
  return prisma.job.create({
    data: { clientId, title: 'Trabajo', status: 'QUOTED', ...data },
  });
}

describe('acceso', () => {
  it('sin sesión todo responde 401', async () => {
    const created = await createClient();
    const responses = await Promise.all([
      request(app).get('/api/admin/clients'),
      request(app).get(`/api/admin/clients/${created.id}`),
      request(app).get('/api/admin/clients/export?format=csv'),
      request(app).post('/api/admin/clients').set('Origin', TEST_ORIGIN).send(validClient()),
      request(app).patch(`/api/admin/clients/${created.id}`).set('Origin', TEST_ORIGIN).send({}),
      request(app).delete(`/api/admin/clients/${created.id}`).set('Origin', TEST_ORIGIN).send({}),
    ]);
    for (const res of responses) expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/clients', () => {
  it('crea (201) con teléfono normalizado a dígitos y email en minúsculas', async () => {
    const res = await admin.post('/api/admin/clients', validClient());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      fullName: 'Ana Pérez',
      phone: '541122334455',
      email: 'ana@mail.com',
      source: 'WHATSAPP',
      jobsCount: 0,
      totals: [],
    });
  });

  it('vacíos opcionales se guardan como null', async () => {
    const created = await createClient({ email: '', address: '', notes: null });
    expect(created).toMatchObject({ email: null, address: null, notes: null });
  });

  it('valida: teléfono corto, nombre vacío, email inválido (400 con details)', async () => {
    const res = await admin.post(
      '/api/admin/clients',
      validClient({ phone: '123', fullName: ' ', email: 'x' }),
    );
    expect(res.status).toBe(400);
    const paths = (res.body.error.details as { path: string[] }[]).map((d) => d.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['phone', 'fullName', 'email']));
  });
});

describe('GET /api/admin/clients', () => {
  it('lista paginada ordenada por nombre con jobsCount', async () => {
    const zeta = await createClient({ fullName: 'Zeta' });
    await createClient({ fullName: 'Alfa', phone: '1111111111' });
    await addJob(zeta.id);
    await addJob(zeta.id);

    const res = await admin.get('/api/admin/clients');
    expect(res.status).toBe(200);
    const data = res.body.data as AdminClientSummary[];
    expect(data.map((c) => c.fullName)).toEqual(['Alfa', 'Zeta']);
    expect(data[1]?.jobsCount).toBe(2);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it('pagina con page y pageSize', async () => {
    for (const name of ['A', 'B', 'C']) {
      await createClient({ fullName: name, phone: `11000000${name.charCodeAt(0)}` });
    }
    const res = await admin.get('/api/admin/clients?page=2&pageSize=2');
    expect(res.body.data.map((c: AdminClientSummary) => c.fullName)).toEqual(['C']);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it('rechaza page/pageSize inválidos (400)', async () => {
    expect((await admin.get('/api/admin/clients?page=0')).status).toBe(400);
    expect((await admin.get('/api/admin/clients?pageSize=101')).status).toBe(400);
  });

  it('?q= busca por nombre y email sin distinguir mayúsculas', async () => {
    await createClient({ fullName: 'María Gómez', email: 'maria@x.com', phone: '1122223333' });
    await createClient({ fullName: 'Pedro', email: 'PEDRO@empresa.com', phone: '1144445555' });

    const byName = await admin.get('/api/admin/clients?q=MARÍA');
    expect(byName.body.data.map((c: AdminClientSummary) => c.fullName)).toEqual(['María Gómez']);
    const byEmail = await admin.get('/api/admin/clients?q=Empresa');
    expect(byEmail.body.data.map((c: AdminClientSummary) => c.fullName)).toEqual(['Pedro']);
  });

  it('?q= busca el teléfono por dígitos (ej. "11 2233" encuentra 541122334455)', async () => {
    await createClient({ fullName: 'Ana' });
    await createClient({ fullName: 'Otro', phone: '3515556666' });
    const res = await admin.get('/api/admin/clients?q=11%202233');
    expect(res.body.data.map((c: AdminClientSummary) => c.fullName)).toEqual(['Ana']);
    expect(res.body.meta.total).toBe(1);
  });

  it('?q= escapa los comodines % y _ (no son "cualquier cosa")', async () => {
    await createClient({ fullName: '100% Servicio', phone: '1122223333' });
    await createClient({ fullName: 'Juan_Perez', phone: '1122224444' });
    await createClient({ fullName: 'Juan Perez', phone: '1122225555' });
    await createClient({ fullName: 'Otro', phone: '1122226666' });

    const percent = await admin.get('/api/admin/clients?q=%25');
    expect(percent.body.data.map((c: AdminClientSummary) => c.fullName)).toEqual(['100% Servicio']);
    const underscore = await admin.get('/api/admin/clients?q=Juan_P');
    expect(underscore.body.data.map((c: AdminClientSummary) => c.fullName)).toEqual(['Juan_Perez']);
  });

  it('?q= vacío no filtra', async () => {
    await createClient();
    const res = await admin.get('/api/admin/clients?q=');
    expect(res.body.meta.total).toBe(1);
  });
});

describe('GET /api/admin/clients/:id', () => {
  it('devuelve totals por moneda solo de terminados y entregados', async () => {
    const client = await createClient();
    await addJob(client.id, {
      amountCharged: 1000,
      amountPaid: 400,
      currency: 'ARS',
      status: 'COMPLETED',
    });
    await addJob(client.id, {
      amountCharged: 500.5,
      amountPaid: 500.5,
      currency: 'ARS',
      status: 'DELIVERED',
    });
    await addJob(client.id, {
      amountCharged: 50,
      amountPaid: 10,
      currency: 'USD',
      status: 'COMPLETED',
    });
    // Un presupuesto o un trabajo en curso todavía no se facturó.
    await addJob(client.id, {
      amountCharged: 70000,
      amountPaid: 0,
      currency: 'ARS',
      status: 'QUOTED',
    });
    await addJob(client.id, {
      amountCharged: 8000,
      amountPaid: 2000,
      currency: 'ARS',
      status: 'IN_PROGRESS',
    });
    await addJob(client.id, {
      amountCharged: 99999,
      amountPaid: 99999,
      currency: 'ARS',
      status: 'CANCELLED',
    });

    const res = await admin.get(`/api/admin/clients/${client.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.jobsCount).toBe(6);
    expect(res.body.data.totals).toEqual([
      { currency: 'ARS', charged: 1500.5, paid: 900.5 },
      { currency: 'USD', charged: 50, paid: 10 },
    ]);
    expect(res.body.data.address).toBe('Calle 123');
  });

  it('404 inexistente y 404 con id no numérico', async () => {
    const missing = await admin.get('/api/admin/clients/999');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('CLIENT_NOT_FOUND');
    expect((await admin.get('/api/admin/clients/abc')).status).toBe(404);
  });
});

describe('PATCH /api/admin/clients/:id', () => {
  it('actualiza solo lo enviado y normaliza el teléfono', async () => {
    const client = await createClient();
    const res = await admin.patch(`/api/admin/clients/${client.id}`, { phone: '(351) 555-6666' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      phone: '3515556666',
      fullName: 'Ana Pérez',
      email: 'ana@mail.com',
    });
  });

  it('permite borrar un campo opcional con null o vacío', async () => {
    const client = await createClient();
    const res = await admin.patch(`/api/admin/clients/${client.id}`, { email: '', notes: null });
    expect(res.body.data).toMatchObject({ email: null, notes: null });
  });

  it('400 con datos inválidos y 404 inexistente', async () => {
    const client = await createClient();
    expect((await admin.patch(`/api/admin/clients/${client.id}`, { phone: 'abc' })).status).toBe(
      400,
    );
    expect((await admin.patch('/api/admin/clients/999', { fullName: 'X' })).status).toBe(404);
  });
});

describe('DELETE /api/admin/clients/:id', () => {
  it('204 sin trabajos y el cliente desaparece', async () => {
    const client = await createClient();
    expect((await admin.delete(`/api/admin/clients/${client.id}`)).status).toBe(204);
    expect((await admin.get(`/api/admin/clients/${client.id}`)).status).toBe(404);
  });

  it('409 CLIENT_HAS_JOBS con trabajos (y sigue existiendo)', async () => {
    const client = await createClient();
    await addJob(client.id);
    const res = await admin.delete(`/api/admin/clients/${client.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLIENT_HAS_JOBS');
    expect((await admin.get(`/api/admin/clients/${client.id}`)).status).toBe(200);
  });

  it('404 inexistente', async () => {
    const res = await admin.delete('/api/admin/clients/999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
  });
});

describe('GET /api/admin/clients/export', () => {
  it('CSV: headers de descarga con la fecha argentina y contenido', async () => {
    await createClient({ fullName: '=CMD()', phone: '1122223333' });
    const res = await admin.get('/api/admin/clients/export?format=csv').buffer().parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="clientes-2026-11-23.csv"',
    );
    const text = (res.body as Buffer).toString('utf8');
    expect(text.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(text).toContain('Nombre;Teléfono;Email');
    // Sin inyección de fórmulas.
    expect(text).toContain("'=CMD()");
    expect(text).toContain('WhatsApp');
  });

  it('CSV: el teléfono (solo dígitos) va como texto para Excel', async () => {
    await createClient({ fullName: 'Ana', phone: '+54 9 11 2233-4455' });
    const res = await admin.get('/api/admin/clients/export?format=csv').buffer().parse(binary);
    expect((res.body as Buffer).toString('utf8')).toContain('"=""5491122334455"""');
  });

  it('CSV respeta ?q=', async () => {
    await createClient({ fullName: 'Ana', phone: '1122223333' });
    await createClient({ fullName: 'Beto', phone: '1144445555' });
    const res = await admin
      .get('/api/admin/clients/export?format=csv&q=beto')
      .buffer()
      .parse(binary);
    const text = (res.body as Buffer).toString('utf8');
    expect(text).toContain('Beto');
    expect(text).not.toContain('Ana');
  });

  it('PDF: application/pdf, adjunto y cuerpo %PDF', async () => {
    await createClient();
    const res = await admin.get('/api/admin/clients/export?format=pdf').buffer().parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="clientes-2026-11-23.pdf"',
    );
    expect((res.body as Buffer).subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('400 sin format o con format desconocido (no lo toma como :id)', async () => {
    expect((await admin.get('/api/admin/clients/export')).status).toBe(400);
    expect((await admin.get('/api/admin/clients/export?format=xlsx')).status).toBe(400);
  });
});
