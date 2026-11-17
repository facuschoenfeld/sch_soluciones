import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/lib/app-error.js';
import { createLogger } from '../src/lib/logger.js';
import { createErrorHandler, notFoundHandler } from '../src/middlewares/error-handler.js';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

function createSpyLogger() {
  const error = vi.fn();
  const warn = vi.fn();
  return { error, warn, logger: { error, warn } as unknown as typeof logger };
}

function buildApp(loggerOverride = logger): Express {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.post('/echo', (req, res) => {
    const data = z.object({ name: z.string().min(1) }).parse(req.body);
    res.json(data);
  });
  app.get('/app-error', () => {
    throw new AppError(409, 'CONFLICT', 'Ya existe', { field: 'email' });
  });
  app.get('/boom', () => {
    throw new Error('secreto interno');
  });
  app.get('/app-error-5xx', () => {
    throw new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'Sin base',
      undefined,
      new Error('ECONNREFUSED'),
    );
  });
  app.get('/internal-with-status', () => {
    // Error interno con forma parecida a http-errors pero sin `expose`: no debe tratarse como 4xx.
    throw Object.assign(new Error('falla interna'), { type: 'custom', status: 400 });
  });
  app.get('/prisma-error', () => {
    throw Object.assign(new Error('Unique constraint failed: data: { fullName: "Juan Pérez" }'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { modelName: 'Client' },
    });
  });
  app.use(notFoundHandler);
  app.use(createErrorHandler(loggerOverride));
  return app;
}

describe('notFoundHandler', () => {
  it('responde 404 con código NOT_FOUND', async () => {
    const res = await request(buildApp()).get('/nada');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('GET /nada');
  });
});

describe('createErrorHandler', () => {
  it('traduce AppError a su status, código y detalles', async () => {
    const res = await request(buildApp()).get('/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'Ya existe', details: { field: 'email' } },
    });
  });

  it('traduce ZodError a 400 VALIDATION_ERROR con path y message por issue', async () => {
    const res = await request(buildApp()).post('/echo').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveLength(1);
    expect(res.body.error.details[0].path).toEqual(['name']);
    expect(typeof res.body.error.details[0].message).toBe('string');
  });

  it('responde 400 VALIDATION_ERROR cuando falta el campo requerido', async () => {
    const res = await request(buildApp()).post('/echo').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 413 PAYLOAD_TOO_LARGE cuando el body supera el límite', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .send({ name: 'x'.repeat(5000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('responde 400 BAD_REQUEST cuando el JSON está mal formado', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('oculta el mensaje de un error inesperado, responde 500 y lo registra', async () => {
    const spyLogger = createSpyLogger();
    const res = await request(buildApp(spyLogger.logger)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secreto interno');
    expect(spyLogger.error).toHaveBeenCalledOnce();
  });

  it('no registra los AppError 4xx', async () => {
    const spyLogger = createSpyLogger();
    await request(buildApp(spyLogger.logger)).get('/app-error');
    expect(spyLogger.error).not.toHaveBeenCalled();
    expect(spyLogger.warn).not.toHaveBeenCalled();
  });

  it('registra como warning el motivo de un AppError 5xx sin enviarlo al cliente', async () => {
    const spyLogger = createSpyLogger();
    const res = await request(buildApp(spyLogger.logger)).get('/app-error-5xx');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    expect(spyLogger.error).not.toHaveBeenCalled();
    expect(spyLogger.warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(spyLogger.warn.mock.calls[0])).toContain('ECONNREFUSED');
  });

  it('responde 4xx (no 500) a otros errores del cliente en body-parser, sin loguear error', async () => {
    const spyLogger = createSpyLogger();
    const res = await request(buildApp(spyLogger.logger))
      .post('/echo')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{"name":"x"}');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(spyLogger.error).not.toHaveBeenCalled();
  });

  it('trata como 500 un error con status pero sin `expose` (no proviene del cliente)', async () => {
    const res = await request(buildApp()).get('/internal-with-status');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('no registra el mensaje de un error de Prisma (puede contener datos personales)', async () => {
    const spyLogger = createSpyLogger();
    await request(buildApp(spyLogger.logger)).get('/prisma-error');
    const logged = JSON.stringify(spyLogger.error.mock.calls[0]);
    expect(logged).toContain('P2002');
    expect(logged).not.toContain('Juan Pérez');
  });
});
