import type { Currency, PriceType, ServiceLine } from './enums.js';

// Contratos de la API pública (sin auth). Nunca incluir datos de clientes ni del admin.

export interface PublicSettings {
  businessName: string;
  tagline: string | null;
  whatsappNumber: string;
  bookingWhatsappTemplate: string;
  inquiryWhatsappTemplate: string;
  heroTitle: string;
  heroSubtitle: string | null;
  businessHours: string | null;
  serviceArea: string | null;
  instagramUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  email: string | null;
}

export interface PublicCategory {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  line: ServiceLine;
}

export interface PublicServiceSummary {
  slug: string;
  name: string;
  shortDescription: string;
  priceType: PriceType;
  priceAmount: number | null;
  currency: Currency;
  priceUnit: string | null;
  estimatedTime: string | null;
  isFeatured: boolean;
  /** Plantilla propia para reservar turno; si es null se usa la de Settings. */
  whatsappTemplate: string | null;
  category: Pick<PublicCategory, 'slug' | 'name' | 'line'>;
}

export interface PublicServiceDetail extends PublicServiceSummary {
  /** Markdown. */
  description: string;
}
