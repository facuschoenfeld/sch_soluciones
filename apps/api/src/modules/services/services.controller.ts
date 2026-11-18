import {
  publicServicesQuerySchema,
  slugSchema,
  type DataResponse,
  type PublicServiceDetail,
  type PublicServiceSummary,
} from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
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
