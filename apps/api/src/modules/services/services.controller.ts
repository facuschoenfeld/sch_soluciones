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
import * as servicesService from './services.service.js';

export function createServicesController(prisma: PrismaClient) {
  const listPublic: RequestHandler = async (req, res) => {
    // Un ZodError acá se traduce a 400 VALIDATION_ERROR en el error handler.
    const query = publicServicesQuerySchema.parse(req.query);
    const body: DataResponse<PublicServiceSummary[]> = {
      data: await servicesService.listPublicServices(prisma, query),
    };
    res.json(body);
  };

  const getPublicBySlug: RequestHandler<{ slug: string }> = async (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug);
    // Un slug mal formado no puede existir: se responde igual que uno inexistente.
    if (!slug.success) {
      throw new AppError(404, 'SERVICE_NOT_FOUND', 'El servicio no existe o ya no está disponible');
    }
    const body: DataResponse<PublicServiceDetail> = {
      data: await servicesService.getPublicServiceBySlug(prisma, slug.data),
    };
    res.json(body);
  };

  return { listPublic, getPublicBySlug };
}
