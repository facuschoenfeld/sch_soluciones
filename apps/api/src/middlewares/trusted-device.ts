import type { Request } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { readTrustedDevice, type SessionConfig } from '../modules/auth/session.js';

/** Devuelve el id del dispositivo de confianza del request, o null si no tiene uno vigente. */
export type TrustedDeviceResolver = (req: Request) => Promise<string | null>;

/**
 * Un dispositivo es de confianza si su cookie es válida y su `tv` coincide con el `tokenVersion`
 * actual del admin (cambiar la contraseña o cerrar todas las sesiones lo revoca). El resultado
 * se memoriza por request: lo consultan varios limitadores. Si la base falla, se lo trata como
 * no confiable (solo pierde la exención del límite global).
 */
export function createTrustedDeviceResolver(
  db: PrismaClient,
  session: SessionConfig,
): TrustedDeviceResolver {
  const cache = new WeakMap<Request, Promise<string | null>>();

  async function resolve(req: Request): Promise<string | null> {
    const device = await readTrustedDevice(req, session);
    if (!device) return null;
    try {
      const admin = await db.adminUser.findUnique({
        where: { id: device.adminId },
        select: { tokenVersion: true },
      });
      return admin?.tokenVersion === device.tokenVersion ? device.deviceId : null;
    } catch {
      return null;
    }
  }

  return (req) => {
    let result = cache.get(req);
    if (!result) {
      result = resolve(req);
      cache.set(req, result);
    }
    return result;
  };
}
