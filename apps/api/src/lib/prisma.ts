import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Logger } from './logger.js';

export function createPrismaClient(connectionString: string): PrismaClient {
  // `minimal`: los mensajes de error no reproducen la consulta con sus argumentos.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }), errorFormat: 'minimal' });
}

/** Subconjunto mínimo del cliente que necesitan los chequeos de salud (facilita los tests). */
export type DbPinger = Pick<PrismaClient, '$queryRaw'>;

export async function pingDatabase(db: DbPinger): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}

/** Resume el error de conexión en una línea (sin stack ni la consulta que lo disparó). */
export function describeDbError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const lines = error.message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? error.name;
}

interface RetryOptions {
  logger: Logger;
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Intenta conectar a la base con backoff exponencial.
 * Neon suspende el cómputo tras unos minutos sin uso y tarda unos segundos en despertar,
 * así que el primer intento puede fallar. Devuelve false si se agotan los intentos;
 * la API sigue levantada y Prisma reintenta en la próxima consulta.
 */
export async function connectWithRetry(
  db: DbPinger,
  { logger, retries = 5, baseDelayMs = 1000, sleep = defaultSleep }: RetryOptions,
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pingDatabase(db);
      logger.info({ attempt }, 'Conexión a la base establecida');
      return true;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      logger.warn(
        { attempt, retries, reason: describeDbError(error) },
        'No se pudo conectar a la base',
      );
      if (!isLastAttempt) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  logger.error({ retries }, 'Se agotaron los reintentos de conexión a la base');
  return false;
}
