import {
  contactSettingsChanged,
  settingsUpdateSchema,
  type AdminSettings,
  type DataResponse,
  type PublicSettings,
} from '@sch/shared';
import type { RequestHandler } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/app-error.js';
import type { TtlCache } from '../../lib/ttl-cache.js';
import { unauthenticated } from '../../middlewares/require-auth.js';
import { verifyCurrentPassword } from '../auth/auth.service.js';
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

const PASSWORD_REQUIRED_MESSAGE =
  'Para cambiar el número de WhatsApp o el email, confirmá con tu contraseña';

/** Panel. `onChange` vacía la caché pública después de guardar. */
export function createSettingsAdminController(prisma: PrismaClient, onChange: () => void) {
  const get: RequestHandler = async (_req, res) => {
    const body: DataResponse<AdminSettings> = {
      data: await settingsService.getAdminSettings(prisma),
    };
    res.json(body);
  };

  const update: RequestHandler = async (req, res) => {
    const admin = res.locals.admin;
    if (!admin) throw unauthenticated();
    const { currentPassword, ...input } = settingsUpdateSchema.parse(req.body);

    // Cambiar a dónde llegan los clientes exige la contraseña (por si alguien usa una sesión
    // abierta). Sin fila todavía (instalación sin seed) no hay contacto que proteger.
    const current = await settingsService.getContactSettings(prisma);
    const contactChanged = current !== null && contactSettingsChanged(current, input);
    if (contactChanged) {
      // Un intento rechazado puede ser una sesión robada: queda el evento (sin valores).
      if (currentPassword === undefined) {
        req.log.warn(
          { event: 'contact_settings_change_denied' },
          'Cambio de contacto sin contraseña',
        );
        throw new AppError(403, 'CURRENT_PASSWORD_REQUIRED', PASSWORD_REQUIRED_MESSAGE, [
          { path: ['currentPassword'], message: PASSWORD_REQUIRED_MESSAGE },
        ]);
      }
      await verifyCurrentPassword(prisma, admin.id, currentPassword).catch((error: unknown) => {
        // Solo la contraseña incorrecta: un fallo de la base no es un intento rechazado.
        if (error instanceof AppError && error.code === 'INVALID_CURRENT_PASSWORD') {
          req.log.warn({ event: 'contact_settings_change_denied' }, 'Contraseña incorrecta');
        }
        throw error;
      });
    }

    const body: DataResponse<AdminSettings> = {
      data: await settingsService.updateSettings(prisma, input, {
        // Sin fila (alta) se escribe todo; con fila, el contacto solo si cambió (y se verificó).
        includeContact: current === null || contactChanged,
      }),
    };
    // Sin los valores (Ley 25.326 y regla de logs): solo el evento.
    if (contactChanged) req.log.info({ event: 'contact_settings_changed' }, 'Contacto actualizado');
    onChange();
    res.json(body);
  };

  return { get, update };
}
