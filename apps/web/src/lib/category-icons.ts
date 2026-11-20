import {
  AppWindow,
  Code,
  Cpu,
  Download,
  Globe,
  HardDrive,
  Laptop,
  Monitor,
  Settings,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

// Íconos disponibles para las categorías (Category.icon guarda el nombre en kebab-case).
// Se importan uno por uno para no incluir toda la librería en el bundle.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'app-window': AppWindow,
  code: Code,
  cpu: Cpu,
  download: Download,
  globe: Globe,
  'hard-drive': HardDrive,
  laptop: Laptop,
  monitor: Monitor,
  settings: Settings,
  'shield-check': ShieldCheck,
  wrench: Wrench,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

/** Nombres en español para el selector del panel. */
export const CATEGORY_ICON_LABELS: Record<string, string> = {
  'app-window': 'Ventana de aplicación',
  code: 'Código',
  cpu: 'Procesador',
  download: 'Descarga',
  globe: 'Web (globo)',
  'hard-drive': 'Disco',
  laptop: 'Notebook',
  monitor: 'Monitor',
  settings: 'Engranaje',
  'shield-check': 'Escudo',
  wrench: 'Llave (herramienta)',
};

/** Ícono de la categoría; si el nombre no está en la lista, uno genérico. */
export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Settings;
}
