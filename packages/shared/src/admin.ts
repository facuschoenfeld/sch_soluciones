import type { Currency, PriceType, ServiceLine } from './enums.js';
import type { PublicSettings } from './public.js';

// Contratos de la API del panel (/api/admin, requiere sesión). Los montos `Decimal` viajan como
// number y las fechas como string ISO.

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  line: ServiceLine;
  sortOrder: number;
  isActive: boolean;
  /** Servicios de la categoría (activos y archivados): con alguno no se puede borrar. */
  servicesCount: number;
}

export interface AdminServiceSummary {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  shortDescription: string;
  priceType: PriceType;
  priceAmount: number | null;
  currency: Currency;
  priceUnit: string | null;
  estimatedTime: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  priceUpdatedAt: string;
  updatedAt: string;
  category: { id: number; name: string; line: ServiceLine; isActive: boolean };
  /** Trabajos registrados con este servicio: con alguno no se puede borrar (solo archivar). */
  jobsCount: number;
}

export interface AdminServiceDetail extends AdminServiceSummary {
  /** Markdown. */
  description: string;
  whatsappTemplate: string | null;
}

/** Resultado de la actualización masiva de precios (para el resumen del panel). */
export interface BulkPriceResult {
  updated: { id: number; name: string; currency: Currency; before: number; after: number }[];
  /** Servicios "a consultar": no tienen monto, no se tocan. */
  skipped: { id: number; name: string }[];
}

/** Settings completos (el panel edita todo; hoy coincide con lo público). */
export type AdminSettings = PublicSettings;

type ContactSettings = Pick<PublicSettings, 'whatsappNumber' | 'email'>;

/**
 * True si cambian los datos a los que llegan los clientes (WhatsApp o email). Con una sesión
 * ajena abierta, cambiarlos desviaría los contactos sin que el dueño lo note: la API pide la
 * contraseña actual. Compara valores ya normalizados (solo dígitos, email en minúsculas).
 */
export function contactSettingsChanged(before: ContactSettings, after: ContactSettings): boolean {
  return before.whatsappNumber !== after.whatsappNumber || before.email !== after.email;
}
