import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PublicServiceSummary } from '@sch/shared';
import { createTestApp } from './helpers/test-app.js';
import { getTestPrisma, resetDatabase } from './helpers/test-db.js';

const prisma = getTestPrisma();
const app = createTestApp(prisma);

async function crearServicio(
  categoryId: number,
  slug: string,
  name: string,
  extra: { sortOrder?: number; shortDescription?: string } = {},
) {
  return prisma.service.create({
    data: {
      categoryId,
      slug,
      name,
      shortDescription: extra.shortDescription ?? 'Descripción',
      priceType: 'QUOTE',
      sortOrder: extra.sortOrder ?? 0,
    },
  });
}

async function listar(query: string): Promise<PublicServiceSummary[]> {
  const res = await request(app).get(`/api/public/services${query}`);
  expect(res.status).toBe(200);
  return res.body.data as PublicServiceSummary[];
}

let categoriaId = 0;
let categoriaBId = 0;

beforeAll(async () => {
  await resetDatabase(prisma);
  const a = await prisma.category.create({
    data: { name: 'A', slug: 'cat-a', line: 'TECH_SUPPORT', sortOrder: 1 },
  });
  const b = await prisma.category.create({
    data: { name: 'B', slug: 'cat-b', line: 'TECH_SUPPORT', sortOrder: 2 },
  });
  categoriaId = a.id;
  categoriaBId = b.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('orden de servicios por sortOrder', () => {
  it('refleja los cambios de sortOrder dentro de una categoría y desempata por nombre', async () => {
    await prisma.service.deleteMany();
    await crearServicio(categoriaId, 'uno', 'Uno', { sortOrder: 1 });
    await crearServicio(categoriaId, 'dos', 'Dos', { sortOrder: 2 });
    await crearServicio(categoriaId, 'tres', 'Tres', { sortOrder: 3 });

    expect((await listar('?category=cat-a')).map((s) => s.slug)).toEqual(['uno', 'dos', 'tres']);

    await prisma.service.update({ where: { slug: 'tres' }, data: { sortOrder: 0 } });
    expect((await listar('?category=cat-a')).map((s) => s.slug)).toEqual(['tres', 'uno', 'dos']);

    // Empate de sortOrder: desempata alfabéticamente por nombre.
    await prisma.service.update({ where: { slug: 'dos' }, data: { sortOrder: 0 } });
    expect((await listar('?category=cat-a')).map((s) => s.slug)).toEqual(['dos', 'tres', 'uno']);
  });

  it('el sortOrder de la categoría prevalece sobre el del servicio', async () => {
    await prisma.service.deleteMany();
    await crearServicio(categoriaId, 'a-tarde', 'A tarde', { sortOrder: 99 });
    await crearServicio(categoriaBId, 'b-temprano', 'B temprano', { sortOrder: 0 });

    expect((await listar('')).map((s) => s.slug)).toEqual(['a-tarde', 'b-temprano']);

    await prisma.category.update({ where: { id: categoriaBId }, data: { sortOrder: 0 } });
    expect((await listar('')).map((s) => s.slug)).toEqual(['b-temprano', 'a-tarde']);
  });
});

describe('búsqueda con caracteres especiales de LIKE', () => {
  beforeAll(async () => {
    await prisma.service.deleteMany();
    await crearServicio(categoriaId, 'descuento', 'Descuento 50% off');
    await crearServicio(categoriaId, 'guion-bajo', 'Archivo_final');
    await crearServicio(categoriaId, 'comun', 'Servicio común', {
      shortDescription: 'Sin símbolos',
    });
    await crearServicio(categoriaId, 'barra', 'Ruta C:\\datos');
  });

  // Los comodines de LIKE se escapan en escapeLikePattern (services.service.ts).
  it('"%" se busca literalmente y no como comodín', async () => {
    expect((await listar('?q=%25')).map((s) => s.slug)).toEqual(['descuento']);
    expect((await listar('?q=50%25')).map((s) => s.slug)).toEqual(['descuento']);
  });

  it('"_" se busca literalmente y no como comodín de un carácter', async () => {
    expect((await listar('?q=_')).map((s) => s.slug)).toEqual(['guion-bajo']);
    // Si "_" fuera comodín, "a_c" coincidiría con textos como "abc".
    expect(await listar('?q=a_c')).toEqual([]);
  });

  it('"\\" se busca literalmente', async () => {
    expect((await listar('?q=C:%5Cdatos')).map((s) => s.slug)).toEqual(['barra']);
  });

  it('una búsqueda sin coincidencias devuelve lista vacía', async () => {
    expect(await listar('?q=zzzz')).toEqual([]);
  });

  it('la búsqueda ignora mayúsculas y minúsculas', async () => {
    expect((await listar('?q=SERVICIO')).map((s) => s.slug)).toEqual(['comun']);
  });
});
