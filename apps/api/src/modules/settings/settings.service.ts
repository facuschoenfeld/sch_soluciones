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

/** Reemplaza la configuración completa. Si la fila no existe (sin seed), la crea. */
export function updateSettings(
  prisma: PrismaClient,
  input: SettingsInputParsed,
): Promise<AdminSettings> {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...input },
    update: input,
    select: settingsSelect,
  });
}
