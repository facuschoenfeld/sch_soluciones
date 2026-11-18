import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { ADMIN_NAV } from '@/components/admin/admin-nav';
import { AdminPageHeader } from './admin-section-page';

const SECTION_DESCRIPTIONS: Record<string, string> = {
  '/admin/servicios': 'Precios, servicios destacados y archivados.',
  '/admin/categorias': 'Orden y visibilidad de las categorías.',
  '/admin/clientes': 'Datos de contacto e historial de cada cliente.',
  '/admin/trabajos': 'Estado, cobros y datos del equipo de cada trabajo.',
  '/admin/configuracion': 'Datos del negocio y tu contraseña.',
};

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <AdminPageHeader
        title="Inicio"
        description="Hola. Desde acá vas a manejar el catálogo, tus clientes y los trabajos."
      />

      <p className="text-muted-foreground">
        Pronto vas a ver acá un resumen: trabajos del mes, cobros pendientes y próximos turnos.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_NAV.filter((item) => item.to !== '/admin').map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm focus-ring transition-shadow hover:shadow-md"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                {label}
              </span>
              <span className="text-sm text-muted-foreground">{SECTION_DESCRIPTIONS[to]}</span>
              <ArrowRight
                className="mt-auto size-4 text-primary transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
