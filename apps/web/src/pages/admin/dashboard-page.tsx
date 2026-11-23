import {
  JOB_STATUS_LABELS,
  formatAmount,
  formatDate,
  formatDateTime,
  formatMonth,
  type AdminDashboard,
  type JobStatus,
} from '@sch/shared';
import { ArrowRight, CalendarClock, Plus, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { JobStatusBadge } from '@/components/admin/job-badges';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminDashboard } from '@/lib/admin-api';
import { AdminPageHeader } from './admin-section-page';

const STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[];

export function DashboardPage() {
  const dashboard = useAdminDashboard();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <AdminPageHeader
        title="Inicio"
        description="Resumen de tus trabajos, cobros y próximos turnos."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/admin/clientes/nuevo">
                <UserPlus aria-hidden="true" />
                Nuevo cliente
              </Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link to="/admin/trabajos/nuevo">
                <Plus aria-hidden="true" />
                Nuevo trabajo
              </Link>
            </Button>
          </div>
        }
      />

      {dashboard.isError ? (
        <QueryError
          error={dashboard.error}
          title="No se pudo cargar el resumen"
          onRetry={() => void dashboard.refetch()}
        />
      ) : dashboard.isPending ? (
        <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Cargando resumen">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <DashboardContent data={dashboard.data} />
      )}
    </div>
  );
}

function Panel({
  title,
  link,
  children,
}: {
  title: string;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="flex-1">{children}</div>
      {link && (
        <Link
          to={link.to}
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary focus-ring hover:underline"
        >
          {link.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function DashboardContent({ data }: { data: AdminDashboard }) {
  const month = formatMonth(new Date(data.month.start));
  const totalJobs = STATUSES.reduce((sum, status) => sum + data.statusCounts[status], 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={`Ingresos de ${month}`}>
        {data.monthIncome.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no terminaste trabajos este mes.</p>
        ) : (
          <ul className="space-y-3">
            {data.monthIncome.map((income) => (
              <li key={income.currency}>
                <p className="text-3xl font-bold tabular-nums">
                  {formatAmount(income.charged, income.currency)}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Cobrado {formatAmount(income.paid, income.currency)} ·{' '}
                  {income.jobs === 1 ? '1 trabajo' : `${income.jobs} trabajos`}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Trabajos terminados o entregados en el mes.
        </p>
      </Panel>

      <Panel
        title="Pendiente de cobro"
        link={
          data.balanceDue.jobs > 0
            ? { to: '/admin/trabajos?saldo=1', label: 'Ver trabajos con saldo' }
            : undefined
        }
      >
        {data.balanceDue.jobs === 0 ? (
          <p className="text-sm text-muted-foreground">No hay trabajos terminados sin cobrar.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {data.balanceDue.byCurrency.map((item) => (
                <li key={item.currency} className="text-3xl font-bold tabular-nums">
                  {formatAmount(item.amount, item.currency)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {data.balanceDue.jobs === 1
                ? '1 trabajo terminado con saldo'
                : `${data.balanceDue.jobs} trabajos terminados con saldo`}
            </p>
          </>
        )}
      </Panel>

      <Panel
        title="Trabajos por estado"
        link={{
          to: '/admin/trabajos',
          label: totalJobs > 0 ? 'Ver todos los trabajos' : 'Ir a trabajos',
        }}
      >
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STATUSES.map((status) => (
            <li key={status}>
              <Link
                to={`/admin/trabajos?estado=${status}`}
                className="flex min-h-11 flex-col gap-1 rounded-lg border p-3 focus-ring hover:bg-accent"
              >
                <span className="text-2xl font-bold tabular-nums">{data.statusCounts[status]}</span>
                <JobStatusBadge status={status} />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Próximos turnos">
        {data.upcomingJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay turnos agendados. Cargá la fecha del turno en cada trabajo.
          </p>
        ) : (
          <ul className="divide-y">
            {data.upcomingJobs.map((job) => (
              <li key={job.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <CalendarClock
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <Link
                    to={`/admin/trabajos/${job.id}`}
                    state={{ from: '/admin' }}
                    className="font-medium break-words focus-ring hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(job.scheduledAt)} · {job.client.fullName}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Últimos clientes" link={{ to: '/admin/clientes', label: 'Ver clientes' }}>
        {data.recentClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no cargaste clientes.</p>
        ) : (
          <ul className="divide-y">
            {data.recentClients.map((client) => (
              <li
                key={client.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0"
              >
                <Link
                  to={`/admin/clientes/${client.id}`}
                  className="font-medium break-words focus-ring hover:underline"
                >
                  {client.fullName}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {formatDate(client.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
