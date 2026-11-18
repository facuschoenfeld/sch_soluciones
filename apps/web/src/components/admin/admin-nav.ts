import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Solo coincide con la ruta exacta (el inicio es el índice del panel). */
  end?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/admin/servicios', label: 'Servicios', icon: Package },
  { to: '/admin/categorias', label: 'Categorías', icon: Tags },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/trabajos', label: 'Trabajos', icon: ClipboardList },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
];
