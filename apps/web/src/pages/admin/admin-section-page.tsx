import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { usePageTitle } from '@/lib/hooks';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  usePageTitle(`${title} · Panel`);
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

interface UpcomingSectionPageProps {
  title: string;
  icon: LucideIcon;
  description: string;
}

/** Sección del panel que todavía no tiene contenido (se completa en las próximas etapas). */
export function UpcomingSectionPage({ title, icon, description }: UpcomingSectionPageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <AdminPageHeader title={title} />
      <EmptyState icon={icon} title="Próximamente" description={description} />
    </div>
  );
}
