import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import {
  DEVICE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  createSessionConfig,
  signSession,
} from '../src/modules/auth/session.js';
import { TEST_JWT_SECRET, TEST_ORIGIN, createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const EMAIL = 'admin@sch.test';
const PASSWORD = 'contraseña-del-admin-123';
const COOKIE_NAME = 'sch_session';

let adminId = 0;

beforeEach(async () => {
  await resetDatabase(prisma);
  const admin = await prisma.adminUser.create({
    data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD) },
  });
  adminId = admin.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

type App = ReturnType<typeof createTestApp>;

function login(app: App, body: unknown = { email: EMAIL, password: PASSWORD }) {
  return request(app)
    .post('/api/auth/login')
    .set('Origin', TEST_ORIGIN)
    .send(body as object);
}

/** Cookie de sesión ("sch_session=…") del Set-Cookie de una respuesta. */
function sessionCookieFrom(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))?.split(';')[0];
}

async function loggedInCookie(app: App): Promise<string> {
  const res = await login(app);
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error('El login no devolvió cookie');
  return cookie;
}

function me(app: App, cookie?: string) {
  const req = request(app).get('/api/auth/me');
  return cookie ? req.set('Cookie', cookie) : req;
}

async function tokenCookie(claims: Record<string, unknown>, secret = TEST_JWT_SECRET) {
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(adminId))
    .setIssuer('sch-api')
    .setAudience('sch-admin')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
  return `${COOKIE_NAME}=${token}`;
}

describe('POST /api/auth/login', () => {
  it('con credenciales correctas inicia sesión con una cookie httpOnly y SameSite=Strict', async () => {
    const res = await login(createTestApp(prisma));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { email: EMAIL } });
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(setCookie).toMatch(/sch_session=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).not.toMatch(/Domain=/);
    expect(res.headers['cache-control']).toBe('no-store');
    // El token nunca va en el body.
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
  });

  it('normaliza el email (mayúsculas y espacios) igual que el seed', async () => {
    const res = await login(createTestApp(prisma), {
      email: '  Admin@SCH.test ',
      password: PASSWORD,
    });
    expect(res.status).toBe(200);
  });

  it('responde lo mismo con contraseña incorrecta o email inexistente', async () => {
    const app = createTestApp(prisma);
    const wrongPassword = await login(app, { email: EMAIL, password: 'incorrecta' });
    const unknownEmail = await login(app, { email: 'otro@sch.test', password: PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña incorrectos' },
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('valida el body (400) y no acepta contraseñas gigantes', async () => {
    const app = createTestApp(prisma);
    const invalid = await login(app, { email: 'no-es-email', password: '' });
    const huge = await login(app, { email: EMAIL, password: 'a'.repeat(257) });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(huge.status).toBe(400);
  });

  it('limita los intentos fallidos por IP (429) y no cuenta los exitosos', async () => {
    const app = createTestApp(prisma, { options: { rateLimits: { loginFailuresPerIp: 3 } } });

    expect((await login(app)).status).toBe(200);
    for (let i = 0; i < 3; i++) {
      expect((await login(app, { email: EMAIL, password: 'incorrecta' })).status).toBe(401);
    }
    const blocked = await login(app);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('el límite global de fallos frena aunque cambie la IP', async () => {
    const app = createTestApp(prisma, {
      options: { rateLimits: { loginFailuresPerIp: 100, loginFailuresGlobal: 2 } },
    });
    await login(app, { email: EMAIL, password: 'incorrecta' });
    await login(app, { email: EMAIL, password: 'incorrecta' });

    expect((await login(app)).status).toBe(429);
  });
});

describe('dispositivo de confianza', () => {
  it('el login correcto deja una cookie de dispositivo httpOnly', async () => {
    const res = await login(createTestApp(prisma));
    const device = (res.headers['set-cookie'] as unknown as string[]).find((cookie) =>
      cookie.startsWith('sch_device='),
    );

    expect(device).toBeDefined();
    expect(device).toMatch(/HttpOnly/);
    expect(device).toMatch(/SameSite=Strict/);
  });

  it('exime del límite global (un ataque distribuido no bloquea al admin en su dispositivo)', async () => {
    const app = createTestApp(prisma, {
      options: { rateLimits: { loginFailuresPerIp: 100, loginFailuresGlobal: 2 } },
    });
    const first = await login(app);
    const device = (first.headers['set-cookie'] as unknown as string[])
      .find((cookie) => cookie.startsWith('sch_device='))
      ?.split(';')[0];
    expect(device).toBeDefined();

    await login(app, { email: EMAIL, password: 'incorrecta' });
    await login(app, { email: EMAIL, password: 'incorrecta' });

    expect((await login(app)).status).toBe(429);
    const trusted = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', device ?? '')
      .send({ email: EMAIL, password: PASSWORD });
    expect(trusted.status).toBe(200);
  });

  it.each([
    ['una cookie de sesión válida (otra audiencia)', 'session'],
    ['un token de dispositivo vencido', 'expired'],
  ])('%s no exime del límite global', async (_caso, kind) => {
    let clock = Date.now();
    const app = createTestApp(prisma, {
      options: {
        now: () => clock,
        rateLimits: { loginFailuresPerIp: 100, loginFailuresGlobal: 1 },
      },
    });
    const ok = await login(app);
    const cookies = ok.headers['set-cookie'] as unknown as string[];
    const pick = (name: string) =>
      cookies.find((c) => c.startsWith(`${name}=`))?.split(';')[0] ?? '';
    const device =
      kind === 'session'
        ? pick(COOKIE_NAME).replace(`${COOKIE_NAME}=`, 'sch_device=')
        : pick('sch_device');
    if (kind === 'expired') clock += (DEVICE_TTL_SECONDS + 1) * 1000;

    await login(app, { email: EMAIL, password: 'incorrecta' });
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', device)
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(429);
  });

  it('una cookie de dispositivo falsa no exime del límite global', async () => {
    const app = createTestApp(prisma, {
      options: { rateLimits: { loginFailuresPerIp: 100, loginFailuresGlobal: 1 } },
    });
    await login(app, { email: EMAIL, password: 'incorrecta' });
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', 'sch_device=falsa')
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(429);
  });
});

describe('dispositivo de confianza: límite propio y revocación', () => {
  function deviceCookieFrom(res: request.Response): string {
    const cookie = (res.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('sch_device='))
      ?.split(';')[0];
    if (!cookie) throw new Error('sin cookie de dispositivo');
    return cookie;
  }

  function loginWith(app: App, cookie: string, password: string) {
    return request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookie)
      .send({ email: EMAIL, password });
  }

  it('cada dispositivo tiene su propio límite de fallos (una cookie robada no da intentos ilimitados)', async () => {
    const app = createTestApp(prisma, {
      options: {
        rateLimits: {
          loginFailuresPerIp: 100,
          loginFailuresGlobal: 100,
          loginFailuresPerDevice: 2,
        },
      },
    });
    const device = deviceCookieFrom(await login(app));

    expect((await loginWith(app, device, 'incorrecta')).status).toBe(401);
    expect((await loginWith(app, device, 'incorrecta')).status).toBe(401);
    expect((await loginWith(app, device, PASSWORD)).status).toBe(429);
  });

  it('cambiar la contraseña revoca la exención de los otros dispositivos', async () => {
    const app = createTestApp(prisma, {
      options: { rateLimits: { loginFailuresPerIp: 100, loginFailuresGlobal: 1 } },
    });
    const first = await login(app);
    const oldDevice = deviceCookieFrom(first);
    const newPassword = 'una-contraseña-nueva-segura';
    await request(app)
      .post('/api/admin/password')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', sessionCookieFrom(first) ?? '')
      .send({ currentPassword: PASSWORD, newPassword });

    await login(app, { email: EMAIL, password: 'incorrecta' });
    expect((await loginWith(app, oldDevice, newPassword)).status).toBe(429);
  });
});

describe('dispositivo de confianza: casos de revocación', () => {
  function deviceFrom(res: request.Response): string {
    return (
      (res.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('sch_device='))
        ?.split(';')[0] ?? ''
    );
  }
  const strictGlobal = {
    options: { rateLimits: { loginFailuresPerIp: 100, loginFailuresGlobal: 1 } },
  };

  it('cerrar todas las sesiones revoca la exención del dispositivo', async () => {
    const app = createTestApp(prisma, strictGlobal);
    const first = await login(app);
    await request(app)
      .post('/api/admin/logout-all')
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'application/json')
      .set('Cookie', sessionCookieFrom(first) ?? '');
    await login(app, { email: EMAIL, password: 'incorrecta' });

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', deviceFrom(first))
      .send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(429);
  });

  it('después de cambiar la contraseña, el dispositivo actual sigue exento', async () => {
    const app = createTestApp(prisma, strictGlobal);
    const first = await login(app);
    const newPassword = 'una-contraseña-nueva-segura';
    const changed = await request(app)
      .post('/api/admin/password')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', sessionCookieFrom(first) ?? '')
      .send({ currentPassword: PASSWORD, newPassword });
    await login(app, { email: EMAIL, password: 'incorrecta' });

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', deviceFrom(changed))
      .send({ email: EMAIL, password: newPassword });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/logout-all', () => {
  function logoutAll(app: App, cookie?: string) {
    const req = request(app)
      .post('/api/admin/logout-all')
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'application/json');
    return cookie ? req.set('Cookie', cookie) : req;
  }

  it('cierra todas las sesiones, incluida la actual', async () => {
    const app = createTestApp(prisma);
    const other = await loggedInCookie(app);
    const current = await loggedInCookie(app);

    const res = await logoutAll(app, current);

    expect(res.status).toBe(204);
    expect(sessionCookieFrom(res)).toBe(`${COOKIE_NAME}=`);
    expect((await me(app, current)).body.data).toBeNull();
    expect((await me(app, other)).body.data).toBeNull();
    expect(
      (await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } })).tokenVersion,
    ).toBe(1);
    // Se puede volver a iniciar sesión normalmente.
    expect((await login(app)).status).toBe(200);
  });

  it('sin sesión responde 401 y desde otro origen 403', async () => {
    const app = createTestApp(prisma);
    expect((await logoutAll(app)).status).toBe(401);
    const evil = await request(app)
      .post('/api/admin/logout-all')
      .set('Origin', 'https://evil.example')
      .set('Content-Type', 'application/json')
      .set('Cookie', await loggedInCookie(app));
    expect(evil.status).toBe(403);
  });
});

describe('protección CSRF en escrituras', () => {
  it('rechaza un login sin Origin o desde un origen no permitido (403)', async () => {
    const app = createTestApp(prisma);
    const noOrigin = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    const evil = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: EMAIL, password: PASSWORD });

    for (const res of [noOrigin, evil]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('rechaza un body que no es JSON (415), como el de un formulario de otro sitio', async () => {
    const res = await request(createTestApp(prisma))
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .type('form')
      .send(`email=${EMAIL}&password=${PASSWORD}`);

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('también protege las escrituras del panel', async () => {
    const app = createTestApp(prisma);
    const cookie = await loggedInCookie(app);
    const res = await request(app)
      .post('/api/admin/password')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ currentPassword: PASSWORD, newPassword: 'otra-contraseña-larga' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el admin de la sesión', async () => {
    const app = createTestApp(prisma);
    const res = await me(app, await loggedInCookie(app));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { email: EMAIL } });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sin cookie responde 200 con data null (consulta de estado, sin error)', async () => {
    const res = await me(createTestApp(prisma));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
  });

  it.each([
    ['basura', `${COOKIE_NAME}=no-es-un-jwt`],
    ['firmado con otro secreto', 'otro'],
    ['sin firma (alg none)', 'none'],
    ['de otro emisor', 'issuer'],
  ])('rechaza un token %s', async (_caso, kind) => {
    let cookie = kind;
    if (kind === 'otro')
      cookie = await tokenCookie(
        { tv: 0, auth_time: Math.floor(Date.now() / 1000) },
        'x'.repeat(43),
      );
    if (kind === 'none') {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: String(adminId),
          tv: 0,
          iss: 'sch-api',
          aud: 'sch-admin',
          exp: 9999999999,
        }),
      ).toString('base64url');
      cookie = `${COOKIE_NAME}=${header}.${payload}.`;
    }
    if (kind === 'issuer') {
      const token = await new SignJWT({ tv: 0, auth_time: Math.floor(Date.now() / 1000) })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(adminId))
        .setIssuer('otro')
        .setAudience('sch-admin')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(TEST_JWT_SECRET));
      cookie = `${COOKIE_NAME}=${token}`;
    }

    const app = createTestApp(prisma);
    const res = await me(app, cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    // La cookie inválida se borra.
    expect(sessionCookieFrom(res)).toBe(`${COOKIE_NAME}=`);
    // Y en el panel no da acceso.
    const admin = await request(app).get('/api/admin/password').set('Cookie', cookie);
    expect(admin.status).toBe(401);
  });

  it('rechaza un token vencido', async () => {
    let clock = Date.now();
    const app = createTestApp(prisma, { options: { now: () => clock } });
    const cookie = await loggedInCookie(app);

    clock += (SESSION_TTL_SECONDS + 1) * 1000;
    expect((await me(app, cookie)).body.data).toBeNull();
  });

  it('renueva la cookie pasada la mitad de la duración, sin superar el tope desde el login', async () => {
    let clock = Date.now();
    const app = createTestApp(prisma, { options: { now: () => clock } });
    const cookie = await loggedInCookie(app);

    clock += (SESSION_TTL_SECONDS / 2 - 60) * 1000;
    expect(sessionCookieFrom(await me(app, cookie))).toBeUndefined();

    clock += 120 * 1000;
    const renewedRes = await me(app, cookie);
    const renewed = sessionCookieFrom(renewedRes);
    expect(renewedRes.status).toBe(200);
    expect(renewed).toBeDefined();
    expect(renewed).not.toBe(cookie);
  });

  it('una sesión más vieja que el tope absoluto ya no se renueva', async () => {
    const now = Date.now();
    const config = createSessionConfig({
      jwtSecret: TEST_JWT_SECRET,
      secure: false,
      now: () => now,
    });
    // auth_time de hace 7 días: el token vence en este mismo instante.
    const { token } = await signSession(config, {
      adminId,
      tokenVersion: 0,
      authTime: Math.floor(now / 1000) - config.maxSessionSeconds,
    });

    expect((await me(createTestApp(prisma), `${COOKIE_NAME}=${token}`)).body.data).toBeNull();
  });

  it('si el admin ya no existe, la sesión deja de valer', async () => {
    const app = createTestApp(prisma);
    const cookie = await loggedInCookie(app);
    await prisma.adminUser.deleteMany();

    expect((await me(app, cookie)).body.data).toBeNull();
  });
});

describe('POST /api/auth/logout', () => {
  it('borra la cookie de sesión', async () => {
    const app = createTestApp(prisma);
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'application/json')
      .set('Cookie', await loggedInCookie(app));

    expect(res.status).toBe(204);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(setCookie).toMatch(/sch_session=;/);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('/api/admin sin sesión', () => {
  it.each([
    ['GET', '/api/admin/password'],
    ['GET', '/api/admin/ruta-que-no-existe'],
    ['GET', '/api/admin'],
  ])('%s %s responde 401 (no revela qué rutas existen)', async (method, path) => {
    const res = await request(createTestApp(prisma))[method.toLowerCase() as 'get'](path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/admin/password sin cookie responde 401', async () => {
    const res = await request(createTestApp(prisma))
      .post('/api/admin/password')
      .set('Origin', TEST_ORIGIN)
      .send({ currentPassword: PASSWORD, newPassword: 'otra-contraseña-larga' });

    expect(res.status).toBe(401);
  });

  it('con sesión, una ruta inexistente del panel responde 404', async () => {
    const app = createTestApp(prisma);
    const res = await request(app)
      .get('/api/admin/ruta-que-no-existe')
      .set('Cookie', await loggedInCookie(app));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/password', () => {
  function changePassword(app: App, cookie: string, body: object) {
    return request(app)
      .post('/api/admin/password')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookie)
      .send(body);
  }

  it('cambia la contraseña, mantiene la sesión actual e invalida las anteriores', async () => {
    const app = createTestApp(prisma);
    const otherSession = await loggedInCookie(app);
    const cookie = await loggedInCookie(app);
    const newPassword = 'una-contraseña-nueva-segura';

    const res = await changePassword(app, cookie, { currentPassword: PASSWORD, newPassword });
    const newCookie = sessionCookieFrom(res);

    expect(res.status).toBe(204);
    expect(newCookie).toBeDefined();
    expect((await me(app, newCookie)).body.data).toEqual({ email: EMAIL });
    expect((await me(app, otherSession)).body.data).toBeNull();
    expect((await me(app, cookie)).body.data).toBeNull();

    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
    expect(await verifyPassword(admin.passwordHash, newPassword)).toBe(true);
    expect(admin.tokenVersion).toBe(1);
    expect((await login(app, { email: EMAIL, password: newPassword })).status).toBe(200);
    expect((await login(app)).status).toBe(401);
  });

  it('exige la contraseña actual correcta', async () => {
    const app = createTestApp(prisma);
    const res = await changePassword(app, await loggedInCookie(app), {
      currentPassword: 'incorrecta',
      newPassword: 'una-contraseña-nueva-segura',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(res.body.error.details[0].path).toEqual(['currentPassword']);
  });

  it.each([
    ['corta', 'corta'],
    ['igual a la actual', PASSWORD],
  ])('rechaza una contraseña nueva %s', async (_caso, newPassword) => {
    const app = createTestApp(prisma);
    const res = await changePassword(app, await loggedInCookie(app), {
      currentPassword: PASSWORD,
      newPassword,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('comparte el límite de intentos fallidos con el login', async () => {
    const app = createTestApp(prisma, { options: { rateLimits: { loginFailuresPerIp: 2 } } });
    const cookie = await loggedInCookie(app);
    const wrong = { currentPassword: 'incorrecta', newPassword: 'una-contraseña-nueva-segura' };

    await changePassword(app, cookie, wrong);
    await changePassword(app, cookie, wrong);
    expect((await changePassword(app, cookie, wrong)).status).toBe(429);
  });
});

describe('cookie en producción', () => {
  it('usa Secure y el prefijo __Host-', async () => {
    const app = createTestApp(prisma, { isProduction: true });
    const res = await login(app);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('\n');

    expect(res.status).toBe(200);
    expect(setCookie).toMatch(/^__Host-session=/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/Path=\//);
  });
});
