import { randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';

// Sesión del admin: JWT HS256 en una cookie httpOnly. El token nunca viaja en el body ni se
// guarda en el navegador fuera de la cookie. Claims mínimos y sin datos personales:
//   sub = id del admin · tv = tokenVersion (se incrementa al cambiar la contraseña)
//   auth_time = momento del login (tope absoluto de la sesión)

const ISSUER = 'sch-api';
const AUDIENCE = 'sch-admin';
const ALGORITHM = 'HS256';

export interface SessionConfig {
  secret: Uint8Array;
  /** Producción: cookie `Secure` con prefijo `__Host-` (Secure + Path=/ + sin Domain). */
  secure: boolean;
  /** Duración de cada token; se renueva al usarlo pasada la mitad. */
  ttlSeconds: number;
  /** Tope absoluto desde el login: después hay que volver a iniciar sesión. */
  maxSessionSeconds: number;
  now: () => number;
}

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60;

export function createSessionConfig({
  jwtSecret,
  secure,
  now = Date.now,
}: {
  jwtSecret: string;
  secure: boolean;
  now?: () => number;
}): SessionConfig {
  return {
    secret: new TextEncoder().encode(jwtSecret),
    secure,
    ttlSeconds: SESSION_TTL_SECONDS,
    maxSessionSeconds: MAX_SESSION_SECONDS,
    now,
  };
}

export function sessionCookieName(config: SessionConfig): string {
  return config.secure ? '__Host-session' : 'sch_session';
}

export interface SessionClaims {
  adminId: number;
  tokenVersion: number;
  /** Segundos epoch. */
  authTime: number;
  /** Segundos epoch. */
  expiresAt: number;
}

const nowSeconds = (config: SessionConfig) => Math.floor(config.now() / 1000);

export async function signSession(
  config: SessionConfig,
  { adminId, tokenVersion, authTime }: Omit<SessionClaims, 'expiresAt'>,
): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = nowSeconds(config);
  const expiresAt = Math.min(issuedAt + config.ttlSeconds, authTime + config.maxSessionSeconds);
  const token = await new SignJWT({ tv: tokenVersion, auth_time: authTime })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(adminId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(config.secret);
  return { token, expiresAt };
}

/** Claims de un token válido, o null si es inválido, vencido o de otra emisión. */
export async function verifySession(
  config: SessionConfig,
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, config.secret, {
      // Solo HS256: un token con `alg: none` u otro algoritmo se rechaza.
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: new Date(config.now()),
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    const { sub, tv, auth_time: authTime, exp } = payload;
    if (
      typeof sub !== 'string' ||
      !/^[1-9]\d*$/.test(sub) ||
      typeof tv !== 'number' ||
      !Number.isInteger(tv) ||
      typeof authTime !== 'number' ||
      typeof exp !== 'number'
    ) {
      return null;
    }
    // Sesión más vieja que el tope absoluto (no debería pasar: exp ya lo limita).
    if (nowSeconds(config) >= authTime + config.maxSessionSeconds) return null;
    return { adminId: Number(sub), tokenVersion: tv, authTime, expiresAt: exp };
  } catch {
    return null;
  }
}

function cookieOptions(config: SessionConfig): CookieOptions {
  return { httpOnly: true, sameSite: 'strict', secure: config.secure, path: '/' };
}

export function setSessionCookie(
  res: Response,
  config: SessionConfig,
  { token, expiresAt }: { token: string; expiresAt: number },
): void {
  res.cookie(sessionCookieName(config), token, {
    ...cookieOptions(config),
    maxAge: Math.max(0, expiresAt * 1000 - config.now()),
  });
}

export function clearSessionCookie(res: Response, config: SessionConfig): void {
  res.clearCookie(sessionCookieName(config), cookieOptions(config));
}

/** Lee una cookie sin depender de cookie-parser (se usan solo dos). */
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function readSessionCookie(req: Request, config: SessionConfig): string | null {
  return readCookie(req, sessionCookieName(config));
}

// --- Dispositivo de confianza ---------------------------------------------------------------
// Cookie firmada que se emite al iniciar sesión correctamente (patrón "device cookies" de OWASP).
// No da acceso a nada: exime a ese navegador del límite GLOBAL de intentos fallidos, para que un
// ataque distribuido no deje afuera al admin en sus propios dispositivos. Cada dispositivo tiene
// su propio límite (por `jti`), así una cookie robada no habilita fuerza bruta rotando IPs, y
// lleva `tv`: cambiar la contraseña o cerrar todas las sesiones la invalida.

const DEVICE_AUDIENCE = 'sch-trusted-device';
export const DEVICE_TTL_SECONDS = 90 * 24 * 60 * 60;

export function deviceCookieName(config: SessionConfig): string {
  return config.secure ? '__Host-device' : 'sch_device';
}

export interface DeviceClaims {
  adminId: number;
  tokenVersion: number;
  /** Identificador del dispositivo: clave de su límite de intentos. */
  deviceId: string;
}

export async function setTrustedDeviceCookie(
  res: Response,
  config: SessionConfig,
  { adminId, tokenVersion }: { adminId: number; tokenVersion: number },
): Promise<void> {
  const issuedAt = nowSeconds(config);
  const token = await new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(adminId))
    .setJti(randomUUID())
    .setIssuer(ISSUER)
    .setAudience(DEVICE_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + DEVICE_TTL_SECONDS)
    .sign(config.secret);
  res.cookie(deviceCookieName(config), token, {
    ...cookieOptions(config),
    maxAge: DEVICE_TTL_SECONDS * 1000,
  });
}

/** Claims de la cookie de dispositivo si la firma y el vencimiento son válidos (sin mirar la base). */
export async function readTrustedDevice(
  req: Request,
  config: SessionConfig,
): Promise<DeviceClaims | null> {
  const token = readCookie(req, deviceCookieName(config));
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, config.secret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: DEVICE_AUDIENCE,
      currentDate: new Date(config.now()),
      requiredClaims: ['sub', 'jti', 'exp'],
    });
    const { sub, tv, jti } = payload;
    if (
      typeof sub !== 'string' ||
      !/^[1-9]\d*$/.test(sub) ||
      typeof tv !== 'number' ||
      !Number.isInteger(tv) ||
      typeof jti !== 'string'
    ) {
      return null;
    }
    return { adminId: Number(sub), tokenVersion: tv, deviceId: jti };
  } catch {
    return null;
  }
}
