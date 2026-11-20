import {
  settingsInputSchema,
  type AdminSettings,
  type DataResponse,
  type PublicSettings,
} from '@sch/shared';
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

/** Panel. `onChange` vacía la caché pública después de guardar. */
export function createSettingsAdminController(prisma: PrismaClient, onChange: () => void) {
  const get: RequestHandler = async (_req, res) => {
    const body: DataResponse<AdminSettings> = {
      data: await settingsService.getAdminSettings(prisma),
    };
    res.json(body);
  };

  const update: RequestHandler = async (req, res) => {
    const input = settingsInputSchema.parse(req.body);
    const body: DataResponse<AdminSettings> = {
      data: await settingsService.updateSettings(prisma, input),
    };
    onChange();
    res.json(body);
  };

  return { get, update };
}
