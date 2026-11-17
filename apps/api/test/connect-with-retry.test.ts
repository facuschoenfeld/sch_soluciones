import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/lib/logger.js';
import { connectWithRetry, type DbPinger } from '../src/lib/prisma.js';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

function fakeDb(queryRaw: ReturnType<typeof vi.fn>): DbPinger {
  return { $queryRaw: queryRaw } as unknown as DbPinger;
}

describe('connectWithRetry', () => {
  it('conecta en el primer intento sin esperar', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ok = await connectWithRetry(fakeDb(vi.fn().mockResolvedValue([])), { logger, sleep });

    expect(ok).toBe(true);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('reintenta con backoff exponencial hasta que la base despierta', async () => {
    const queryRaw = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue([]);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const ok = await connectWithRetry(fakeDb(queryRaw), { logger, sleep, baseDelayMs: 100 });

    expect(ok).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it('devuelve false al agotar los intentos', async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error('down'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const ok = await connectWithRetry(fakeDb(queryRaw), { logger, sleep, retries: 3 });

    expect(ok).toBe(false);
    expect(queryRaw).toHaveBeenCalledTimes(3);
    // No se espera después del último intento.
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
