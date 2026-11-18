import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  JWT_SECRET: 'kV3pQ9zX7mT2wR8yL5nB4cH6jF1dS0gA-Ue_Ko9Pi7Mu',
};

describe('loadEnv', () => {
  it('aplica valores por defecto y separa los orígenes permitidos', () => {
    const env = loadEnv({ ...base, ALLOWED_ORIGINS: 'http://a.com, https://b.com:8443' });

    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.ALLOWED_ORIGINS).toEqual(['http://a.com', 'https://b.com:8443']);
  });

  it('exige NODE_ENV explícito', () => {
    const { NODE_ENV: _omit, ...withoutNodeEnv } = base;
    expect(() => loadEnv(withoutNodeEnv)).toThrow(/NODE_ENV/);
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...withoutDb } = base;
    expect(() => loadEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('rechaza una DATABASE_URL que no es de PostgreSQL', () => {
    expect(() => loadEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['con barra final', 'http://localhost:5173/'],
    ['con ruta', 'https://a.com/app'],
    ['sin protocolo', 'localhost:5173'],
    ['vacío', ' , '],
  ])('rechaza un ALLOWED_ORIGINS %s', (_caso, value) => {
    expect(() => loadEnv({ ...base, ALLOWED_ORIGINS: value })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('en producción exige orígenes https', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: 'http://sitio.com' }),
    ).toThrow(/https/);
    expect(
      loadEnv({ ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://sitio.onrender.com' })
        .ALLOWED_ORIGINS,
    ).toEqual(['https://sitio.onrender.com']);
  });

  it.each([
    ['ausente', undefined],
    ['corto', 'x'.repeat(42)],
    ['con el valor de ejemplo', `CAMBIAR_POR_UN_SECRETO_${'x'.repeat(40)}`],
    ['poco aleatorio', 'abcd'.repeat(12)],
  ])('rechaza un JWT_SECRET %s', (_caso, value) => {
    expect(() => loadEnv({ ...base, JWT_SECRET: value })).toThrow(/JWT_SECRET/);
  });
});
