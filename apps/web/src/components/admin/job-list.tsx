import {
  OPEN_JOB_STATUSES,
  balanceDue,
  formatAmount,
  formatDate,
  formatDateTime,
  type AdminJob,
  type JobStatus,
} from '@sch/shared';
import { Link, useLocation } from 'react-router';
import { JobStatusBadge, PaymentBadge } from './job-badges';

interface JobListProps {
  jobs: AdminJob[];
  /** En la ficha del cliente no se repite su nombre en cada fila. */
  showClient?: boolean;
}

const isOpen = (status: JobStatus) => (OPEN_JOB_STATUSES as readonly JobStatus[]).includes(status);

/** Lista de trabajos (listado general e historial del cliente). */
export function JobList({ jobs, showClient = true }: JobListProps) {
  // La página del trabajo vuelve a donde se estaba (listado filtrado, ficha del cliente).
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  return (
    <ul className="divide-y rounded-xl border bg-card shadow-sm">
      {jobs.map((job) => {
        const serviceName = job.serviceNameSnapshot ?? job.service?.name;
        const due = balanceDue(job.amountCharged, job.amountPaid);
        return (
          <li
            key={job.id}
            className="grid gap-x-4 gap-y-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/admin/trabajos/${job.id}`}
                  state={{ from }}
                  className="font-semibold break-words focus-ring hover:underline"
                >
                  {job.title}
                </Link>
                <JobStatusBadge status={job.status} />
              </p>
              <p className="text-sm text-muted-foreground">
                {showClient && (
                  <>
                    <Link
                      to={`/admin/clientes/${job.client.id}`}
                      className="font-medium text-foreground focus-ring hover:underline"
                    >
                      {job.client.fullName}
                    </Link>
                    {' · '}
                  </>
                )}
                Ingreso {formatDate(job.receivedAt)}
                {serviceName && ` · ${serviceName}`}
              </p>
              {job.scheduledAt && isOpen(job.status) && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Turno: </span>
                  {formatDateTime(job.scheduledAt)}
                </p>
              )}
            </div>

            <div className="space-y-1 text-sm sm:text-right">
              <p className="font-semibold tabular-nums">
                {job.amountCharged === 0
                  ? 'Sin cargo'
                  : formatAmount(job.amountCharged, job.currency)}
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <PaymentBadge amountCharged={job.amountCharged} amountPaid={job.amountPaid} />
                {due > 0 && job.amountPaid > 0 && (
                  <span className="text-muted-foreground tabular-nums">
                    Saldo {formatAmount(due, job.currency)}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
