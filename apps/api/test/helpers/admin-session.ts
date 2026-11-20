import type { Express } from 'express';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { hashPassword } from '../../src/lib/password.js';
import { TEST_ORIGIN } from './test-app.js';

export const ADMIN_EMAIL = 'admin@sch.test';
const ADMIN_PASSWORD = 'contraseña-del-admin-123';

/** Inicia sesión con el admin ya creado y devuelve la cookie ("sch_session=…"). */
export async function loginAdmin(app: Express): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', TEST_ORIGIN)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const session = cookies?.find((cookie) => cookie.startsWith('sch_session='))?.split(';')[0];
  if (!session) throw new Error('El login no devolvió cookie de sesión');
  return session;
}

/** Crea el admin (la base no debe tener ninguno) e inicia sesión. */
export async function loginAsAdmin(app: Express, prisma: PrismaClient): Promise<string> {
  await prisma.adminUser.create({
    data: { email: ADMIN_EMAIL, passwordHash: await hashPassword(ADMIN_PASSWORD) },
  });
  return loginAdmin(app);
}

/** Cliente del panel con la cookie de sesión y el Origin permitido ya puestos. */
export function adminClient(app: Express, cookie: string) {
  const withAuth = (req: request.Test) => req.set('Cookie', cookie).set('Origin', TEST_ORIGIN);
  return {
    get: (path: string) => withAuth(request(app).get(path)),
    post: (path: string, body: object = {}) => withAuth(request(app).post(path)).send(body),
    put: (path: string, body: object = {}) => withAuth(request(app).put(path)).send(body),
    patch: (path: string, body: object = {}) => withAuth(request(app).patch(path)).send(body),
    // Con body vacío igual se manda Content-Type JSON (lo exige la defensa CSRF).
    delete: (path: string) => withAuth(request(app).delete(path)).type('json').send({}),
  };
}

export type AdminClient = ReturnType<typeof adminClient>;
