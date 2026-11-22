import type { AdminSettings, PublicSettings, SettingsInputParsed } from '@sch/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/app-error.js';

export const SETTINGS_ID = 1;

// Selección explícita: solo datos públicos del negocio (el panel edita los mismos campos).
const settingsSelect = {
  businessName: true,
  tagline: true,
  whatsappNumber: true,
  bookingWhatsappTemplate: true,
  inquiryWhatsappTemplate: true,
  generalWhatsappTemplate: true,
  heroTitle: true,
  heroSubtitle: true,
  aboutText: true,
  businessHours: true,
  serviceArea: true,
  instagramUrl: true,
  githubUrl: true,
  linkedinUrl: true,
  email: true,
} satisfies Prisma.SettingsSelect;

function settingsNotFound(): AppError {
  return new AppError(
    404,
    'SETTINGS_NOT_FOUND',
    'La configuración del sitio todavía no está cargada',
  );
}

export async function getPublicSettings(prisma: PrismaClient): Promise<PublicSettings> {
  const settings = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: settingsSelect,
  });
  if (!settings) throw settingsNotFound();
  return settings;
}

export const getAdminSettings: (prisma: PrismaClient) => Promise<AdminSettings> = getPublicSettings;

/** Datos de contacto guardados (null si todavía no hay configuración). */
export function getContactSettings(
  prisma: PrismaClient,
): Promise<{ whatsappNumber: string; email: string | null } | null> {
  return prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    select: { whatsappNumber: true, email: true },
  });
}

/**
 * Reemplaza la configuración. Si la fila no existe (sin seed), la crea.
 * Con `includeContact: false` el update no toca WhatsApp ni email: así un guardado sin
 * contraseña nunca puede pisar un contacto que otra petición cambió (con contraseña) entre la
 * lectura y la escritura.
 */
export function updateSettings(
  prisma: PrismaClient,
  input: SettingsInputParsed,
  { includeContact }: { includeContact: boolean },
): Promise<AdminSettings> {
  const { whatsappNumber: _whatsappNumber, email: _email, ...withoutContact } = input;
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...input },
    update: includeContact ? input : withoutContact,
    select: settingsSelect,
  });
}
