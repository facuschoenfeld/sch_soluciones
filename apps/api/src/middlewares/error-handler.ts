import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@sch/shared';
import { AppError } from '../lib/app-error.js';
import { toLogSafeError } from '../lib/log-safe-error.js';
import type { Logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `No existe la ruta ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
};

interface ClientHttpError {
  type: string;
  status: number;
}

/**
 * Errores de body-parser causados por el cliente (http-errors con `expose: true` y status 4xx):
 * JSON inválido, body grande, charset no soportado, request abortado, etc.
 */
function asClientHttpError(error: unknown): ClientHttpError | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { type, status, expose } = error as { type?: unknown; status?: unknown; expose?: unknown };
  if (
    typeof type === 'string' &&
    expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  ) {
    return { type, status };
  }
  return undefined;
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  // Express identifica el manejador de errores por tener 4 parámetros.
  return (error: unknown, _req, res, next) => {
    // Si la respuesta ya empezó a enviarse, se delega en Express para cortar la conexión.
    if (res.headersSent) {
      next(error);
      return;
    }

    let status = 500;
    let body: ApiErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' },
    };
    const clientHttpError = asClientHttpError(error);

    if (error instanceof AppError) {
      status = error.status;
      body = { error: { code: error.code, message: error.message, details: error.details } };
    } else if (error instanceof ZodError) {
      status = 400;
      body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los datos enviados no son válidos',
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
      };
    } else if (clientHttpError) {
      status = clientHttpError.status;
      // Mensajes propios: no se reenvía el `message` original de la librería.
      if (clientHttpError.type === 'entity.parse.failed') {
        body = {
          error: { code: 'BAD_REQUEST', message: 'El cuerpo de la petición no es JSON válido' },
        };
      } else if (clientHttpError.type === 'entity.too.large') {
        body = {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'El cuerpo de la petición es demasiado grande',
          },
        };
      } else {
        body = { error: { code: 'BAD_REQUEST', message: 'La petición no es válida' } };
      }
    }

    if (status >= 500) {
      if (error instanceof AppError) {
        // Error esperado (ej. base caída): se registra el motivo, sin datos de la consulta.
        const cause = error.cause === undefined ? undefined : toLogSafeError(error.cause);
        logger.warn({ code: error.code, cause }, error.message);
      } else {
        logger.error({ err: toLogSafeError(error) }, 'Error no controlado');
      }
    }

    res.status(status).json(body);
  };
}
