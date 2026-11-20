import {
  bulkPriceSchema,
  publicServicesQuerySchema,
  serviceInputSchema,
  serviceReorderSchema,
  serviceUpdateSchema,
  slugSchema,
  type AdminServiceDetail,
  type AdminServiceSummary,
  type BulkPriceResult,
  type DataResponse,
  type PublicServiceDetail,
  type PublicServiceSummary,
} from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { parseIdParam } from '../../lib/admin-errors.js';
import { AppError } from '../../lib/app-error.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import * as servicesService from './services.service.js';

export function createServicesController(prisma: PrismaClient, cache: TtlCache) {
  const listPublic: RequestHandler = async (req, res) => {
    // Un ZodError acá se traduce a 400 VALIDATION_ERROR en el error handler.
    const query = publicServicesQuerySchema.parse(req.query);
    const load = () => servicesService.listPublicServices(prisma, query);
    // Las búsquedas (?q=) no se cachean: son texto libre y casi nunca se repiten.
    const data = query.q ? await load() : await cache.get(`services:${query.category ?? ''}`, load);
    const body: DataResponse<PublicServiceSummary[]> = { data };
    res.json(body);
  };

  const getPublicBySlug: RequestHandler<{ slug: string }> = async (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug);
    // Un slug mal formado no puede existir: se responde igual que uno inexistente.
    if (!slug.success) {
      throw new AppError(404, 'SERVICE_NOT_FOUND', 'El servicio no existe o ya no está disponible');
    }
    const body: DataResponse<PublicServiceDetail> = {
      data: await cache.get(`service:${slug.data}`, () =>
        servicesService.getPublicServiceBySlug(prisma, slug.data),
      ),
    };
    res.json(body);
  };

  return { listPublic, getPublicBySlug };
}

/**
 * Panel. `onCatalogChange` se llama después de cada escritura exitosa (vacía la caché pública:
 * el cambio se ve en el sitio al recargar).
 */
export function createServicesAdminController(prisma: PrismaClient, onCatalogChange: () => void) {
  const parseId = (value: string | undefined) =>
    parseIdParam(value, servicesService.serviceNotFound);

  const list: RequestHandler = async (_req, res) => {
    const body: DataResponse<AdminServiceSummary[]> = {
      data: await servicesService.listAdminServices(prisma),
    };
    res.json(body);
  };

  const get: RequestHandler<{ id: string }> = async (req, res) => {
    const body: DataResponse<AdminServiceDetail> = {
      data: await servicesService.getAdminService(prisma, parseId(req.params.id)),
    };
    res.json(body);
  };

  const create: RequestHandler = async (req, res) => {
    const input = serviceInputSchema.parse(req.body);
    const body: DataResponse<AdminServiceDetail> = {
      data: await servicesService.createService(prisma, input),
    };
    onCatalogChange();
    res.status(201).json(body);
  };

  const update: RequestHandler<{ id: string }> = async (req, res) => {
    const id = parseId(req.params.id);
    const patch = serviceUpdateSchema.parse(req.body);
    const body: DataResponse<AdminServiceDetail> = {
      data: await servicesService.updateService(prisma, id, patch),
    };
    onCatalogChange();
    res.json(body);
  };

  const remove: RequestHandler<{ id: string }> = async (req, res) => {
    await servicesService.deleteService(prisma, parseId(req.params.id));
    onCatalogChange();
    res.status(204).end();
  };

  const reorder: RequestHandler = async (req, res) => {
    await servicesService.reorderServices(prisma, serviceReorderSchema.parse(req.body));
    onCatalogChange();
    res.status(204).end();
  };

  const bulkPrice: RequestHandler = async (req, res) => {
    const input = bulkPriceSchema.parse(req.body);
    const body: DataResponse<BulkPriceResult> = {
      data: await servicesService.bulkUpdatePrices(prisma, input),
    };
    onCatalogChange();
    res.json(body);
  };

  return { list, get, create, update, remove, reorder, bulkPrice };
}
