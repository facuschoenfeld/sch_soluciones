import type { ApiErrorBody } from '@sch/shared';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/app-error.js';
import type { TrustedDeviceResolver } from './trusted-device.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const JSON_CONTENT_TYPE = /^application\/json\s*(;|$)/i;

/**
 * Defensa CSRF para /api/auth y /api/admin, además de la cookie SameSite=Strict:
 * - toda escritura debe traer un header Origin de la lista permitida (los navegadores lo
 *   envían siempre en POST/PUT/PATCH/DELETE);
 * - y declarar Content-Type JSON: un formulario de otro sitio no puede enviarlo sin preflight.
 */
export function protectWrites(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin');
    if (!origin || !allowed.has(origin)) {
      throw new AppError(403, 'FORBIDDEN_ORIGIN', 'La petición no proviene de un origen permitido');
    }
    if (!JSON_CONTENT_TYPE.test(req.get('content-type') ?? '')) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'El cuerpo debe enviarse como JSON');
    }
    next();
  };
}

/** Respuestas con datos de la sesión o del panel: nunca en caché (navegador ni proxies). */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export interface RateLimitOptions {
  /** Peticiones a /api por IP cada 15 min (salvo `/api/health` exacto, que usa el monitor). */
  apiPerIp: number;
  /** Intentos fallidos de login (o de contraseña actual) por IP cada 1 h. */
  loginFailuresPerIp: number;
  /** Intentos fallidos por dispositivo de confianza cada 1 h (aunque cambie la IP). */
  loginFailuresPerDevice: number;
  /**
   * Intentos fallidos en total cada 1 h desde dispositivos sin cookie de confianza: frena la
   * fuerza bruta distribuida (hay un solo admin) sin dejar afuera al admin real.
   */
  loginFailuresGlobal: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitOptions = {
  apiPerIp: 300,
  loginFailuresPerIp: 10,
  loginFailuresPerDevice: 10,
  loginFailuresGlobal: 50,
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

function tooManyRequests(message: string): RequestHandler {
  return (_req, res) => {
    const body: ApiErrorBody = { error: { code: 'TOO_MANY_REQUESTS', message } };
    res.status(429).json(body);
  };
}

/**
 * Limitadores en memoria: alcanzan con una única instancia de la API (Render gratuito) y se
 * reinician cuando el servicio se duerme o se redeploya. Con más instancias haría falta un
 * store compartido. Detrás del proxy de Render, `req.ip` es real solo con `trust proxy` = 1.
 */
export function createRateLimiters(
  options: RateLimitOptions,
  { trustedDevice }: { trustedDevice: TrustedDeviceResolver },
) {
  const api = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: options.apiPerIp,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Solo el health liviano: /api/health/db sí cuenta (toca la base).
    skip: (req) => req.path === '/health',
    handler: tooManyRequests('Demasiadas peticiones. Probá de nuevo en unos minutos.'),
  });

  // Solo cuentan los intentos fallidos (status >= 400): un login correcto no consume cupo.
  // Ventana de 1 h, igual que el global: una sola IP no alcanza para agotar el límite global.
  const credentialsPerIp = rateLimit({
    windowMs: ONE_HOUR,
    limit: options.loginFailuresPerIp,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: tooManyRequests('Demasiados intentos. Probá de nuevo más tarde.'),
  });

  // Límite propio de cada dispositivo de confianza: una cookie robada no permite fuerza bruta
  // rotando IPs (sin dispositivo, este limitador no aplica).
  const credentialsPerDevice = rateLimit({
    windowMs: ONE_HOUR,
    limit: options.loginFailuresPerDevice,
    keyGenerator: async (req) => `device:${(await trustedDevice(req)) ?? ''}`,
    skip: async (req) => (await trustedDevice(req)) === null,
    skipSuccessfulRequests: true,
    standardHeaders: false,
    legacyHeaders: false,
    handler: tooManyRequests('Demasiados intentos. Probá de nuevo más tarde.'),
  });

  // Clave fija (no por IP ni por email): con el email como clave cualquiera podría bloquear al
  // admin conociéndolo. Los dispositivos de confianza quedan afuera (tienen su propio límite):
  // un ataque distribuido no bloquea al admin desde su PC o su celular.
  const credentialsGlobal = rateLimit({
    windowMs: ONE_HOUR,
    limit: options.loginFailuresGlobal,
    keyGenerator: () => 'global',
    skip: async (req) => (await trustedDevice(req)) !== null,
    skipSuccessfulRequests: true,
    standardHeaders: false,
    legacyHeaders: false,
    handler: tooManyRequests('Demasiados intentos. Probá de nuevo más tarde.'),
  });

  return { api, credentials: [credentialsPerIp, credentialsPerDevice, credentialsGlobal] };
}
