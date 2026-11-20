import {
  categoryInputSchema,
  categoryUpdateSchema,
  reorderSchema,
  type AdminCategory,
  type DataResponse,
  type PublicCategory,
} from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { parseIdParam } from '../../lib/admin-errors.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import * as categoriesService from './categories.service.js';

export function createCategoriesController(prisma: PrismaClient, cache: TtlCache) {
  const listPublic: RequestHandler = async (_req, res) => {
    const body: DataResponse<PublicCategory[]> = {
      data: await cache.get('categories', () => categoriesService.listPublicCategories(prisma)),
    };
    res.json(body);
  };

  return { listPublic };
}

/**
 * Panel. `onCatalogChange` se llama después de cada escritura exitosa (vacía la caché pública:
 * el cambio se ve en el sitio al recargar).
 */
export function createCategoriesAdminController(prisma: PrismaClient, onCatalogChange: () => void) {
  const list: RequestHandler = async (_req, res) => {
    const body: DataResponse<AdminCategory[]> = {
      data: await categoriesService.listAdminCategories(prisma),
    };
    res.json(body);
  };

  const create: RequestHandler = async (req, res) => {
    const input = categoryInputSchema.parse(req.body);
    const body: DataResponse<AdminCategory> = {
      data: await categoriesService.createCategory(prisma, input),
    };
    onCatalogChange();
    res.status(201).json(body);
  };

  const update: RequestHandler<{ id: string }> = async (req, res) => {
    const id = parseIdParam(req.params.id, categoriesService.categoryNotFound);
    const patch = categoryUpdateSchema.parse(req.body);
    const body: DataResponse<AdminCategory> = {
      data: await categoriesService.updateCategory(prisma, id, patch),
    };
    onCatalogChange();
    res.json(body);
  };

  const remove: RequestHandler<{ id: string }> = async (req, res) => {
    const id = parseIdParam(req.params.id, categoriesService.categoryNotFound);
    await categoriesService.deleteCategory(prisma, id);
    onCatalogChange();
    res.status(204).end();
  };

  const reorder: RequestHandler = async (req, res) => {
    const { ids } = reorderSchema.parse(req.body);
    await categoriesService.reorderCategories(prisma, ids);
    onCatalogChange();
    res.status(204).end();
  };

  return { list, create, update, remove, reorder };
}
