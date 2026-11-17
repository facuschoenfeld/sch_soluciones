import type { PublicSettings } from '@sch/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/app-error.js';

export const SETTINGS_ID = 1;

export async function getPublicSettings(prisma: PrismaClient): Promise<PublicSettings> {
  const settings = await prisma.settings.findUnique({
    where: { id: SETTINGS_ID },
    // Selección explícita: solo datos públicos del negocio.
    select: {
      businessName: true,
      tagline: true,
      whatsappNumber: true,
      bookingWhatsappTemplate: true,
      inquiryWhatsappTemplate: true,
      generalWhatsappTemplate: true,
      heroTitle: true,
      heroSubtitle: true,
      businessHours: true,
      serviceArea: true,
      instagramUrl: true,
      githubUrl: true,
      linkedinUrl: true,
      email: true,
    },
  });

  if (!settings) {
    throw new AppError(
      404,
      'SETTINGS_NOT_FOUND',
      'La configuración del sitio todavía no está cargada',
    );
  }
  return settings;
}
