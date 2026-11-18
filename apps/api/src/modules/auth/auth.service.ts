import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/app-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';

export interface AuthenticatedAdmin {
  id: number;
  email: string;
  tokenVersion: number;
}

// Hash de una contraseña aleatoria: si el email no existe se verifica contra este, así el
// tiempo de respuesta es el mismo y no revela qué emails son de un admin.
let dummyHash: Promise<string> | undefined;

export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString('hex')).catch((error: unknown) => {
    // Si falla, se reintenta en el próximo login (no queda guardada la promesa rechazada).
    dummyHash = undefined;
    throw error;
  });
  return dummyHash;
}

/** Devuelve el admin si email y contraseña coinciden; null en cualquier otro caso. */
export async function authenticate(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<AuthenticatedAdmin | null> {
  const admin = await db.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, tokenVersion: true },
  });
  const isValid = await verifyPassword(admin?.passwordHash ?? (await getDummyHash()), password);
  if (!admin || !isValid) return null;
  return { id: admin.id, email: admin.email, tokenVersion: admin.tokenVersion };
}

/**
 * Cambia la contraseña e incrementa `tokenVersion` en la misma operación: todas las sesiones
 * emitidas antes quedan inválidas. Devuelve la versión nueva para reemitir la sesión actual.
 */
export async function changePassword(
  db: PrismaClient,
  adminId: number,
  { currentPassword, newPassword }: { currentPassword: string; newPassword: string },
): Promise<{ tokenVersion: number }> {
  const admin = await db.adminUser.findUnique({
    where: { id: adminId },
    select: { passwordHash: true },
  });
  if (!admin || !(await verifyPassword(admin.passwordHash, currentPassword))) {
    // Mismo formato de `details` que VALIDATION_ERROR, para marcar el campo en el formulario.
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta', [
      { path: ['currentPassword'], message: 'La contraseña actual no es correcta' },
    ]);
  }

  return db.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
}

/** Incrementa `tokenVersion`: invalida todas las sesiones y dispositivos de confianza. */
export async function revokeAllSessions(db: PrismaClient, adminId: number): Promise<void> {
  await db.adminUser.update({
    where: { id: adminId },
    data: { tokenVersion: { increment: 1 } },
    select: { id: true },
  });
}
