import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('loadEnv', () => {
  it('aplica valores por defecto y separa los orígenes de CORS', () => {
    const env = loadEnv({ ...base, CORS_ORIGIN: 'http://a.com, https://b.com:8443' });

    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CORS_ORIGIN).toEqual(['http://a.com', 'https://b.com:8443']);
  });

  it('exige NODE_ENV explícito', () => {
    const { NODE_ENV: _omit, ...withoutNodeEnv } = base;
    expect(() => loadEnv(withoutNodeEnv)).toThrow(/NODE_ENV/);
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    expect(() => loadEnv({ NODE_ENV: 'development', CORS_ORIGIN: base.CORS_ORIGIN })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rechaza una DATABASE_URL que no es de PostgreSQL', () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['con barra final', 'http://localhost:5173/'],
    ['con ruta', 'https://a.com/app'],
    ['sin protocolo', 'localhost:5173'],
    ['vacío', ' , '],
  ])('rechaza un CORS_ORIGIN %s', (_caso, value) => {
    expect(() => loadEnv({ ...base, CORS_ORIGIN: value })).toThrow(/CORS_ORIGIN/);
  });
});
