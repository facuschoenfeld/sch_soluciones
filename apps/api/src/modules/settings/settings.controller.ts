import type { DataResponse, PublicSettings } from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import * as settingsService from './settings.service.js';

export function createSettingsController(prisma: PrismaClient, cache: TtlCache) {
  const getPublic: RequestHandler = async (_req, res) => {
    const body: DataResponse<PublicSettings> = {
      data: await cache.get('settings', () => settingsService.getPublicSettings(prisma)),
    };
    res.json(body);
  };

  return { getPublic };
}
