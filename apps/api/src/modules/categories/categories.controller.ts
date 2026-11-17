import type { DataResponse, PublicCategory } from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import * as categoriesService from './categories.service.js';

export function createCategoriesController(prisma: PrismaClient) {
  const listPublic: RequestHandler = async (_req, res) => {
    const body: DataResponse<PublicCategory[]> = {
      data: await categoriesService.listPublicCategories(prisma),
    };
    res.json(body);
  };

  return { listPublic };
}
