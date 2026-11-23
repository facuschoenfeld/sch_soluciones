import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminDashboard } from '@sch/shared';
import {
  adminClient,
  loginAdmin,
  loginAsAdmin,
  type AdminClient,
} from './helpers/admin-session.js';
import { createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
// 23/11/2026 15:30 hora argentina. El mes en curso es noviembre (AR).
const NOW = new Date('2026-11-23T18:30:00.000Z');
const app = createTestApp(prisma, { options: { now: () => NOW.getTime() } });
let admin: AdminClient;
let clientId = 0;

beforeEach(async () => {
  await resetDatabase(prisma);
  admin = adminClient(app, await loginAsAdmin(app, prisma));
  clientId = (await prisma.client.create({ data: { fullName: 'Ana', phone: '1122334455' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function addJob(data: Record<string, unknown> = {}) {
  return prisma.job.create({
    data: { clientId, title: 'Trabajo', status: 'QUOTED', ...data },
  });
}

async function getDashboard(client: AdminClient = admin) {
  const res = await client.get('/api/admin/dashboard');
  expect(res.status).toBe(200);
  return res.body.data as AdminDashboard;
}

describe('GET /api/admin/dashboard', () => {
  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
  });

  it('sin datos: ceros, listas vacías y el mes en hora argentina', async () => {
    await prisma.client.deleteMany();
    const data = await getDashboard();
    expect(data.statusCounts).toEqual({
      QUOTED: 0,
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    });
    expect(data.monthIncome).toEqual([]);
    expect(data.balanceDue).toEqual({ jobs: 0, byCurrency: [] });
    expect(data.upcomingJobs).toEqual([]);
    expect(data.recentClients).toEqual([]);
    expect(data.month).toEqual({
      start: '2026-11-01T03:00:00.000Z',
      end: '2026-12-01T03:00:00.000Z',
    });
  });

  it('statusCounts cuenta por estado y deja en 0 los demás', async () => {
    await addJob({ status: 'QUOTED' });
    await addJob({ status: 'QUOTED' });
    await addJob({ status: 'IN_PROGRESS' });
    await addJob({ status: 'CANCELLED' });
    const { statusCounts } = await getDashboard();
    expect(statusCounts).toEqual({
      QUOTED: 2,
      SCHEDULED: 0,
      IN_PROGRESS: 1,
      COMPLETED: 0,
      DELIVERED: 0,
      CANCELLED: 1,
    });
  });

  describe('monthIncome', () => {
    it('suma por moneda solo terminados/entregados con completedAt dentro del mes AR', async () => {
      const inMonth = new Date('2026-11-10T12:00:00.000Z');
      await addJob({
        status: 'COMPLETED',
        completedAt: inMonth,
        amountCharged: 1000,
        amountPaid: 400,
        currency: 'ARS',
      });
      await addJob({
        status: 'DELIVERED',
        completedAt: inMonth,
        amountCharged: 500.5,
        amountPaid: 500.5,
        currency: 'ARS',
      });
      await addJob({
        status: 'COMPLETED',
        completedAt: inMonth,
        amountCharged: 80,
        amountPaid: 80,
        currency: 'USD',
      });
      // Excluidos: cancelado, abierto, mes anterior y mes siguiente.
      await addJob({ status: 'CANCELLED', completedAt: inMonth, amountCharged: 7777 });
      await addJob({ status: 'IN_PROGRESS', completedAt: inMonth, amountCharged: 8888 });
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-10-31T12:00:00.000Z'),
        amountCharged: 9999,
      });
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-12-05T12:00:00.000Z'),
        amountCharged: 6666,
      });

      const { monthIncome } = await getDashboard();
      expect(monthIncome).toEqual([
        { currency: 'ARS', charged: 1500.5, paid: 900.5, jobs: 2 },
        { currency: 'USD', charged: 80, paid: 80, jobs: 1 },
      ]);
    });

    it('bordes del mes en hora argentina (inicio inclusivo, fin exclusivo)', async () => {
      // 01/11 02:59:59.999 UTC = 31/10 23:59 AR (octubre): fuera.
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-11-01T02:59:59.999Z'),
        amountCharged: 1,
      });
      // 01/11 03:00 UTC = 01/11 00:00 AR: dentro.
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-11-01T03:00:00.000Z'),
        amountCharged: 10,
      });
      // 30/11 22:00 AR = 01/12 01:00 UTC: sigue siendo noviembre en Argentina.
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-12-01T01:00:00.000Z'),
        amountCharged: 100,
      });
      // 01/12 03:00 UTC = 01/12 00:00 AR: diciembre, fuera.
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-12-01T03:00:00.000Z'),
        amountCharged: 1000,
      });

      const { monthIncome } = await getDashboard();
      expect(monthIncome).toEqual([{ currency: 'ARS', charged: 110, paid: 0, jobs: 2 }]);
    });

    it('con el reloj a las 22:00 AR del último día, el mes sigue siendo noviembre', async () => {
      const lateApp = createTestApp(prisma, {
        options: { now: () => new Date('2026-12-01T01:00:00.000Z').getTime() },
      });
      const lateAdmin = adminClient(lateApp, await loginAdmin(lateApp));
      await addJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-11-30T20:00:00.000Z'),
        amountCharged: 50,
      });
      const data = await getDashboard(lateAdmin);
      expect(data.month.start).toBe('2026-11-01T03:00:00.000Z');
      expect(data.monthIncome).toEqual([{ currency: 'ARS', charged: 50, paid: 0, jobs: 1 }]);
    });
  });

  describe('balanceDue', () => {
    it('cuenta terminados/entregados con saldo, por moneda (resta exacta)', async () => {
      await addJob({ status: 'COMPLETED', amountCharged: 0.3, amountPaid: 0.1, currency: 'ARS' });
      await addJob({ status: 'DELIVERED', amountCharged: 1000, amountPaid: 0, currency: 'ARS' });
      await addJob({ status: 'COMPLETED', amountCharged: 100, amountPaid: 40.25, currency: 'USD' });
      // Excluidos: pagado completo, sin cargo, abierto, cancelado.
      await addJob({ status: 'COMPLETED', amountCharged: 500, amountPaid: 500 });
      await addJob({ status: 'COMPLETED', amountCharged: 0, amountPaid: 0 });
      await addJob({ status: 'IN_PROGRESS', amountCharged: 500, amountPaid: 0 });
      await addJob({ status: 'CANCELLED', amountCharged: 500, amountPaid: 0 });

      const { balanceDue } = await getDashboard();
      expect(balanceDue).toEqual({
        jobs: 3,
        byCurrency: [
          { currency: 'ARS', amount: 1000.2 },
          { currency: 'USD', amount: 59.75 },
        ],
      });
    });

    it('incluye saldos de meses anteriores (no depende del mes en curso)', async () => {
      await addJob({
        status: 'DELIVERED',
        completedAt: new Date('2026-01-10T12:00:00.000Z'),
        amountCharged: 300,
        amountPaid: 100,
      });
      const { balanceDue, monthIncome } = await getDashboard();
      expect(balanceDue.byCurrency).toEqual([{ currency: 'ARS', amount: 200 }]);
      expect(monthIncome).toEqual([]);
    });
  });

  describe('upcomingJobs', () => {
    it('solo turnos futuros de trabajos abiertos, orden ascendente', async () => {
      const at = (iso: string) => new Date(iso);
      await addJob({
        title: 'tercero',
        status: 'IN_PROGRESS',
        scheduledAt: at('2026-11-30T12:00:00Z'),
      });
      await addJob({
        title: 'primero',
        status: 'SCHEDULED',
        scheduledAt: at('2026-11-23T18:30:00Z'),
      });
      await addJob({ title: 'segundo', status: 'QUOTED', scheduledAt: at('2026-11-24T12:00:00Z') });
      // Excluidos.
      await addJob({
        title: 'pasado',
        status: 'SCHEDULED',
        scheduledAt: at('2026-11-23T18:29:59Z'),
      });
      await addJob({
        title: 'terminado',
        status: 'COMPLETED',
        scheduledAt: at('2026-11-25T12:00:00Z'),
      });
      await addJob({
        title: 'entregado',
        status: 'DELIVERED',
        scheduledAt: at('2026-11-25T12:00:00Z'),
      });
      await addJob({
        title: 'cancelado',
        status: 'CANCELLED',
        scheduledAt: at('2026-11-25T12:00:00Z'),
      });
      await addJob({ title: 'sin-turno', status: 'SCHEDULED', scheduledAt: null });

      const { upcomingJobs } = await getDashboard();
      expect(upcomingJobs.map((job) => job.title)).toEqual(['primero', 'segundo', 'tercero']);
      expect(upcomingJobs[0]).toEqual({
        id: expect.any(Number),
        title: 'primero',
        status: 'SCHEDULED',
        scheduledAt: '2026-11-23T18:30:00.000Z',
        client: { id: clientId, fullName: 'Ana' },
      });
    });

    it('máximo 5', async () => {
      for (let day = 1; day <= 7; day++) {
        await addJob({
          title: `t${day}`,
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.UTC(2026, 10, 23 + day, 12)),
        });
      }
      const { upcomingJobs } = await getDashboard();
      expect(upcomingJobs.map((job) => job.title)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    });
  });

  describe('recentClients', () => {
    it('máximo 5, los más nuevos primero, sin datos de contacto', async () => {
      await prisma.client.deleteMany();
      for (let i = 1; i <= 7; i++) {
        await prisma.client.create({
          data: {
            fullName: `Cliente ${i}`,
            phone: `11000000${i}0`,
            email: `c${i}@x.com`,
            createdAt: new Date(Date.UTC(2026, 0, i, 12)),
          },
        });
      }
      const { recentClients } = await getDashboard();
      expect(recentClients.map((client) => client.fullName)).toEqual([
        'Cliente 7',
        'Cliente 6',
        'Cliente 5',
        'Cliente 4',
        'Cliente 3',
      ]);
      expect(Object.keys(recentClients[0] ?? {}).sort()).toEqual(['createdAt', 'fullName', 'id']);
    });
  });
});
