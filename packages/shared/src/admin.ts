import type { ClientSource, Currency, JobStatus, PriceType, ServiceLine } from './enums.js';
import type { CurrencyTotals } from './crm.js';
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

// --- Clientes y trabajos (mini CRM) ----------------------------------------
// Datos personales (Ley 25.326): estos contratos solo existen en /api/admin.

export interface AdminClientSummary {
  id: number;
  fullName: string;
  /** Solo dígitos. */
  phone: string;
  email: string | null;
  source: ClientSource;
  createdAt: string;
  /** Trabajos registrados: con alguno el cliente no se puede borrar. */
  jobsCount: number;
}

export interface AdminClientDetail extends AdminClientSummary {
  address: string | null;
  notes: string | null;
  updatedAt: string;
  /** Facturado y cobrado por moneda (solo trabajos terminados o entregados). */
  totals: CurrencyTotals[];
}

export interface DeviceInfo {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  reportedIssue: string | null;
}

export interface AdminJob {
  id: number;
  clientId: number;
  client: { id: number; fullName: string; phone: string };
  serviceId: number | null;
  /** Servicio actual del catálogo (null si no tiene o se borró). */
  service: { id: number; name: string; isActive: boolean } | null;
  /** Nombre y precio del servicio al asignarlo: el historial no cambia con el catálogo. */
  serviceNameSnapshot: string | null;
  servicePriceSnapshot: number | null;
  servicePriceTypeSnapshot: PriceType | null;
  serviceCurrencySnapshot: Currency | null;
  title: string;
  description: string | null;
  deviceInfo: DeviceInfo | null;
  status: JobStatus;
  amountCharged: number;
  currency: Currency;
  amountPaid: number;
  receivedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/admin/dashboard`. */
export interface AdminDashboard {
  /** Mes en curso (hora argentina), como rango ISO [inicio, fin). */
  month: { start: string; end: string };
  statusCounts: Record<JobStatus, number>;
  /** Trabajos terminados o entregados en el mes: lo facturado y cuánto se cobró. */
  monthIncome: (CurrencyTotals & { jobs: number })[];
  /** Terminados o entregados con saldo a cobrar (de cualquier mes). */
  balanceDue: { jobs: number; byCurrency: { currency: Currency; amount: number }[] };
  upcomingJobs: {
    id: number;
    title: string;
    status: JobStatus;
    scheduledAt: string;
    client: { id: number; fullName: string };
  }[];
  recentClients: { id: number; fullName: string; createdAt: string }[];
}
