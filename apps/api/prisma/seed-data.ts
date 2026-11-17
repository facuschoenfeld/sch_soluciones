// Datos iniciales de ejemplo. Los precios y textos son placeholders para editar desde el panel.
import {
  DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  type Currency,
  type PriceType,
  type ServiceLine,
} from '@sch/shared';

export const seedSettings = {
  businessName: 'SCH Soluciones',
  tagline: 'Desarrollo de software y servicio técnico de PC',
  // Placeholder evidente: reemplazar desde el panel por el número real.
  whatsappNumber: '5491100000000',
  bookingWhatsappTemplate: DEFAULT_BOOKING_WHATSAPP_TEMPLATE,
  inquiryWhatsappTemplate: DEFAULT_INQUIRY_WHATSAPP_TEMPLATE,
  generalWhatsappTemplate: DEFAULT_GENERAL_WHATSAPP_TEMPLATE,
  heroTitle: 'Soluciones en desarrollo y servicio técnico',
  heroSubtitle:
    'Páginas web, aplicaciones de escritorio y mantenimiento de PC para tu casa o negocio.',
  businessHours: 'Lunes a viernes de 9 a 18 h',
  serviceArea: 'Zona a definir',
  instagramUrl: null,
  githubUrl: null,
  linkedinUrl: null,
  email: null,
};

export interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  /** Nombre de ícono de lucide-react. */
  icon: string;
  line: ServiceLine;
  sortOrder: number;
}

export const seedCategories: SeedCategory[] = [
  {
    slug: 'desarrollo-web',
    name: 'Desarrollo web',
    description: 'Sitios y aplicaciones web a medida, rápidos y adaptados a celulares.',
    icon: 'globe',
    line: 'DEVELOPMENT',
    sortOrder: 1,
  },
  {
    slug: 'aplicaciones-de-escritorio',
    name: 'Aplicaciones de escritorio',
    description: 'Programas para Windows pensados para la gestión de tu negocio.',
    icon: 'app-window',
    line: 'DEVELOPMENT',
    sortOrder: 2,
  },
  {
    slug: 'mantenimiento-de-pc',
    name: 'Mantenimiento de PC',
    description: 'Limpieza, optimización y armado de equipos.',
    icon: 'wrench',
    line: 'TECH_SUPPORT',
    sortOrder: 3,
  },
  {
    slug: 'reparacion',
    name: 'Reparación',
    description: 'Diagnóstico y reparación de PCs y notebooks.',
    icon: 'cpu',
    line: 'TECH_SUPPORT',
    sortOrder: 4,
  },
  {
    slug: 'instalacion-de-software',
    name: 'Instalación de software / Windows',
    description: 'Instalación de Windows, programas y drivers.',
    icon: 'download',
    line: 'TECH_SUPPORT',
    sortOrder: 5,
  },
];

export interface SeedService {
  categorySlug: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  priceType: PriceType;
  priceAmount: number | null;
  currency: Currency;
  priceUnit: string | null;
  estimatedTime: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export const seedServices: SeedService[] = [
  {
    categorySlug: 'desarrollo-web',
    slug: 'landing-page',
    name: 'Landing page',
    shortDescription: 'Una página de presentación para tu negocio, lista para compartir.',
    description:
      'Página única con la información clave de tu negocio:\n\n- Diseño adaptado a celulares\n- Botón de contacto por WhatsApp\n- Vista previa al compartir en redes\n\nEl precio final depende de la cantidad de secciones.',
    priceType: 'FROM',
    priceAmount: 150000,
    currency: 'ARS',
    priceUnit: null,
    estimatedTime: '1 a 2 semanas',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    categorySlug: 'desarrollo-web',
    slug: 'sitio-web-institucional',
    name: 'Sitio web institucional',
    shortDescription: 'Sitio de varias páginas con servicios, contacto y novedades.',
    description:
      'Sitio completo para empresas o profesionales, con secciones administrables y formulario de contacto.',
    priceType: 'FROM',
    priceAmount: 300000,
    currency: 'ARS',
    priceUnit: null,
    estimatedTime: '3 a 4 semanas',
    isFeatured: false,
    sortOrder: 2,
  },
  {
    categorySlug: 'desarrollo-web',
    slug: 'tienda-online',
    name: 'Tienda online',
    shortDescription: 'Catálogo de productos con carrito y medios de pago.',
    description:
      'Tienda a medida o sobre plataformas existentes. Se cotiza según cantidad de productos e integraciones.',
    priceType: 'QUOTE',
    priceAmount: null,
    currency: 'ARS',
    priceUnit: null,
    estimatedTime: null,
    isFeatured: false,
    sortOrder: 3,
  },
  {
    categorySlug: 'aplicaciones-de-escritorio',
    slug: 'app-de-escritorio-a-medida',
    name: 'App de escritorio a medida',
    shortDescription: 'Un programa hecho para la forma de trabajar de tu negocio.',
    description:
      'Desarrollo de aplicaciones para Windows: stock, turnos, facturación interna, reportes y más. Se cotiza según el alcance.',
    priceType: 'QUOTE',
    priceAmount: null,
    currency: 'ARS',
    priceUnit: null,
    estimatedTime: null,
    isFeatured: true,
    sortOrder: 1,
  },
  {
    categorySlug: 'aplicaciones-de-escritorio',
    slug: 'sistema-de-gestion-para-comercios',
    name: 'Sistema de gestión para comercios',
    shortDescription: 'Ventas, stock y clientes en un solo programa.',
    description:
      'Sistema base para comercios, adaptable a cada rubro. Incluye instalación y capacitación.',
    priceType: 'FROM',
    priceAmount: 800,
    currency: 'USD',
    priceUnit: null,
    estimatedTime: '4 a 6 semanas',
    isFeatured: false,
    sortOrder: 2,
  },
  {
    categorySlug: 'mantenimiento-de-pc',
    slug: 'limpieza-y-mantenimiento-preventivo',
    name: 'Limpieza y mantenimiento preventivo',
    shortDescription: 'Limpieza interna, cambio de pasta térmica y optimización.',
    description:
      'Limpieza completa de polvo, cambio de pasta térmica, revisión de temperaturas y optimización del sistema.',
    priceType: 'FIXED',
    priceAmount: 25000,
    currency: 'ARS',
    priceUnit: 'por equipo',
    estimatedTime: '24 a 48 h',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    categorySlug: 'mantenimiento-de-pc',
    slug: 'armado-de-pc',
    name: 'Armado de PC',
    shortDescription: 'Armado y configuración de tu PC a partir de los componentes.',
    description:
      'Armado, gestión de cables, actualización de BIOS, pruebas de estabilidad e instalación del sistema operativo.',
    priceType: 'FIXED',
    priceAmount: 40000,
    currency: 'ARS',
    priceUnit: 'por equipo',
    estimatedTime: '48 h',
    isFeatured: false,
    sortOrder: 2,
  },
  {
    categorySlug: 'reparacion',
    slug: 'diagnostico-de-fallas',
    name: 'Diagnóstico de fallas',
    shortDescription: 'Revisión del equipo para identificar el problema y presupuestar.',
    description:
      'Revisión de hardware y software para detectar la falla. **Si se realiza la reparación, el diagnóstico se descuenta.**',
    priceType: 'FIXED',
    priceAmount: 10000,
    currency: 'ARS',
    priceUnit: 'por equipo',
    estimatedTime: '24 h',
    isFeatured: false,
    sortOrder: 1,
  },
  {
    categorySlug: 'reparacion',
    slug: 'reparacion-de-pc-y-notebooks',
    name: 'Reparación de PC y notebooks',
    shortDescription: 'Cambio de componentes, fallas de encendido, pantallas y más.',
    description:
      'Reparación de equipos de escritorio y notebooks. El precio final depende de la falla y los repuestos.',
    priceType: 'FROM',
    priceAmount: 20000,
    currency: 'ARS',
    priceUnit: null,
    estimatedTime: 'Según la falla',
    isFeatured: false,
    sortOrder: 2,
  },
  {
    categorySlug: 'instalacion-de-software',
    slug: 'instalacion-de-windows',
    name: 'Instalación de Windows',
    shortDescription: 'Instalación limpia de Windows con drivers y actualizaciones.',
    description:
      'Instalación de Windows 10/11, drivers, actualizaciones y programas básicos (navegador, lector de PDF, compresor).',
    priceType: 'FIXED',
    priceAmount: 30000,
    currency: 'ARS',
    priceUnit: 'por equipo',
    estimatedTime: '24 h',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    categorySlug: 'instalacion-de-software',
    slug: 'formateo-con-respaldo',
    name: 'Formateo con respaldo de datos',
    shortDescription: 'Respaldo de tus archivos, formateo e instalación limpia.',
    description:
      'Se respaldan documentos, fotos y archivos importantes antes de formatear, y se restauran al terminar.',
    priceType: 'FIXED',
    priceAmount: 35000,
    currency: 'ARS',
    priceUnit: 'por equipo',
    estimatedTime: '24 a 48 h',
    isFeatured: false,
    sortOrder: 2,
  },
];
