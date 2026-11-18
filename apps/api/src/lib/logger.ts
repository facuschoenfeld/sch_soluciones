import { pino, type Logger, type LoggerOptions } from 'pino';
import type { Env } from '../config/env.js';

export type { Logger };

export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  const options: LoggerOptions = {
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    // Nunca loguear credenciales ni cookies de sesión (Ley 25.326: datos personales).
    // El body nunca se registra; igual se redactan los campos sensibles por si un log los incluye.
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.body',
      'password',
      'currentPassword',
      'newPassword',
      'email',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.email',
    ],
  };

  if (env.NODE_ENV === 'development') {
    options.transport = { target: 'pino-pretty', options: { colorize: true } };
  }

  return pino(options);
}
