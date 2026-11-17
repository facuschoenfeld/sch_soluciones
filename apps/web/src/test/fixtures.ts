import {
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  type PublicCategory,
  type PublicServiceSummary,
  type PublicSettings,
} from '@sch/shared';

export const settingsFixture: PublicSettings = {
  businessName: 'SCH Soluciones',
  tagline: 'Desarrollo y servicio técnico',
  whatsappNumber: '5491122334455',
  bookingWhatsappTemplate: DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  inquiryWhatsappTemplate: DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  generalWhatsappTemplate: DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  heroTitle: 'Título',
  heroSubtitle: 'Subtítulo',
  businessHours: 'Lunes a viernes de 9 a 18 h',
  serviceArea: 'Zona oeste',
  instagramUrl: 'https://instagram.com/sch',
  githubUrl: null,
  linkedinUrl: 'javascript:alert(1)',
  email: 'hola@example.com',
};

export const categoriesFixture: PublicCategory[] = [
  {
    slug: 'desarrollo-web',
    name: 'Desarrollo web',
    description: null,
    icon: 'globe',
    line: 'DEVELOPMENT',
  },
  { slug: 'reparacion', name: 'Reparación', description: null, icon: 'cpu', line: 'TECH_SUPPORT' },
];

export const windowsService: PublicServiceSummary = {
  slug: 'instalacion-de-windows',
  name: 'Instalación de Windows',
  shortDescription: 'Instalación limpia con drivers.',
  priceType: 'FIXED',
  priceAmount: 30000,
  currency: 'ARS',
  priceUnit: 'por equipo',
  estimatedTime: '24 h',
  isFeatured: true,
  whatsappTemplate: null,
  category: { slug: 'reparacion', name: 'Reparación', line: 'TECH_SUPPORT' },
};

export const landingService: PublicServiceSummary = {
  slug: 'landing-page',
  name: 'Landing page',
  shortDescription: 'Página de presentación.',
  priceType: 'FROM',
  priceAmount: 150000,
  currency: 'ARS',
  priceUnit: null,
  estimatedTime: null,
  isFeatured: false,
  whatsappTemplate: null,
  category: { slug: 'desarrollo-web', name: 'Desarrollo web', line: 'DEVELOPMENT' },
};
