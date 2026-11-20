import { Prisma } from '../generated/prisma/client.js';
import { AppError } from './app-error.js';

export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** Violación de un índice único (en el catálogo, el único índice único es el slug). */
export function isUniqueViolation(error: unknown): boolean {
  return isPrismaError(error, 'P2002');
}

/** El registro a editar ya no existe (lo borraron entre la lectura y la escritura). */
export function isRecordNotFound(error: unknown): boolean {
  return isPrismaError(error, 'P2025');
}

/** Clave foránea inválida (ej. la categoría se borró entre la verificación y el alta). */
export function isForeignKeyViolation(error: unknown): boolean {
  return isPrismaError(error, 'P2003');
}

/**
 * Transacciones con un update por ítem (reordenar, precios masivos): el timeout por defecto de
 * Prisma (5 s) queda corto con la latencia hasta Neon y una lista larga.
 */
export const BATCH_TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 20_000 } as const;

/**
 * Error de validación de un campo con el mismo formato que los de Zod, para que el panel lo
 * marque en el formulario (`details: [{ path, message }]`).
 */
export function fieldValidationError(field: string, message: string): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', [
    { path: [field], message },
  ]);
}

export function slugTakenError(message: string): AppError {
  return new AppError(409, 'SLUG_TAKEN', message, [{ path: ['slug'], message }]);
}

/**
 * Id numérico de la ruta (`/:id`). Un id mal formado no puede existir: se responde 404 igual
 * que uno inexistente.
 */
export function parseIdParam(value: string | undefined, notFound: () => AppError): number {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) throw notFound();
  return Number(value);
}

/** True si ambas listas tienen exactamente los mismos ids (sin importar el orden). */
export function sameIdSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function orderMismatchError(): AppError {
  return new AppError(
    409,
    'ORDER_MISMATCH',
    'La lista cambió mientras la ordenabas. Recargá la página e intentá de nuevo.',
  );
}
