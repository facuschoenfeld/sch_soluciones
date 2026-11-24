import {
  CLIENT_SOURCE_LABELS,
  balanceDue,
  formatAmount,
  formatDate,
  type AdminClientDetail,
} from '@sch/shared';
import { ArrowLeft, ClipboardList, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { JobList } from '@/components/admin/job-list';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/feedback/empty-state';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappIcon } from '@/components/whatsapp/whatsapp-icon';
import {
  mutationErrorMessage,
  useAdminClient,
  useAdminJobs,
  useDeleteClient,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { clientWhatsappUrl } from '@/lib/client-phone';
import { focusMainOnClose } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from './admin-section-page';

const HISTORY_PAGE_SIZE = 10;

/** `/admin/clientes/:id`: ficha con contacto, notas, totales e historial de trabajos. */
export function ClientDetailPage() {
  const params = useParams();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : undefined;
  const client = useAdminClient(id);

  let content: ReactNode;
  if (id === undefined || (client.error instanceof ApiError && client.error.status === 404)) {
    content = (
      <>
        <AdminPageHeader title="Cliente" />
        <EmptyState
          icon={Users}
          title="El cliente no existe"
          description="Puede que lo hayas borrado. Volvé al listado para ver los que hay."
          action={
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/admin/clientes">Ver clientes</Link>
            </Button>
          }
        />
      </>
    );
  } else if (client.isError) {
    content = (
      <>
        <AdminPageHeader title="Cliente" />
        <QueryError
          error={client.error}
          title="No se pudo cargar el cliente"
          onRetry={() => void client.refetch()}
        />
      </>
    );
  } else if (client.isPending) {
    content = (
      <div className="space-y-4" role="status" aria-label="Cargando">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  } else {
    content = <ClientDetail client={client.data} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="link" className="-ml-3 min-h-11 px-3">
        <Link to="/admin/clientes">
          <ArrowLeft aria-hidden="true" />
          Volver a clientes
        </Link>
      </Button>
      {content}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ClientDetail({ client }: { client: AdminClientDetail }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const whatsappUrl = clientWhatsappUrl(client.phone, client.fullName);

  return (
    <>
      <AdminPageHeader
        title={client.fullName}
        description={`Cliente desde el ${formatDate(client.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {whatsappUrl && (
              <Button asChild variant="whatsapp" className="min-h-11">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <WhatsappIcon aria-hidden="true" />
                  Escribir por WhatsApp
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-11">
              <Link to={`/admin/clientes/${client.id}/editar`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Contacto">
          {/* Cada par en su fila: en el celular el dato queda pegado a su título. */}
          <dl className="space-y-3 text-sm">
            <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>
                {/* "+" solo con código de país: si no, el celular marcaría a otro país. */}
                <a
                  href={`tel:${whatsappUrl ? '+' : ''}${client.phone}`}
                  className="tabular-nums focus-ring hover:underline"
                >
                  {client.phone}
                </a>
                {!whatsappUrl && (
                  <span className="block text-muted-foreground">
                    Sin código de país: editalo para poder escribirle por WhatsApp.
                  </span>
                )}
              </dd>
            </div>
            <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-words">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="focus-ring hover:underline">
                    {client.email}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">Dirección</dt>
              <dd className="break-words">{client.address ?? '—'}</dd>
            </div>
            <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-x-4">
              <dt className="text-muted-foreground">¿Cómo llegó?</dt>
              <dd>{CLIENT_SOURCE_LABELS[client.source]}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Facturación">
          {client.totals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no tiene trabajos terminados.</p>
          ) : (
            <ul className="space-y-3">
              {client.totals.map((total) => {
                const due = balanceDue(total.charged, total.paid);
                return (
                  <li key={total.currency} className="space-y-1">
                    <p className="text-2xl font-bold tabular-nums">
                      {formatAmount(total.charged, total.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Facturado · cobrado {formatAmount(total.paid, total.currency)}
                    </p>
                    {due > 0 && (
                      <p className="text-sm font-semibold text-destructive-text tabular-nums">
                        Saldo a cobrar: {formatAmount(due, total.currency)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Solo trabajos terminados o entregados (sin presupuestos, en curso ni cancelados).
          </p>
        </Card>
      </div>

      {client.notes && (
        <Card title="Notas">
          <p className="text-sm break-words whitespace-pre-line">{client.notes}</p>
        </Card>
      )}

      <JobHistory client={client} />

      <div className="border-t pt-6">
        {client.jobsCount === 0 ? (
          <Button variant="outline" className="min-h-11" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Borrar cliente
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Un cliente con trabajos registrados no se puede borrar (se conserva el historial).
          </p>
        )}
      </div>
      <DeleteClientDialog client={client} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function JobHistory({ client }: { client: AdminClientDetail }) {
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    clientId: String(client.id),
    page: String(page),
    pageSize: String(HISTORY_PAGE_SIZE),
  }).toString();
  const jobs = useAdminJobs(query);
  const newJobLink = `/admin/trabajos/nuevo?cliente=${client.id}`;

  return (
    <section aria-labelledby="client-jobs" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="client-jobs" className="text-xl font-semibold">
          Historial de trabajos
        </h2>
        <div className="flex flex-wrap gap-2">
          {client.jobsCount > 0 && (
            <Button asChild variant="outline" className="min-h-11">
              <Link to={`/admin/trabajos?cliente=${client.id}`}>
                <ClipboardList aria-hidden="true" />
                Filtrar en Trabajos
              </Link>
            </Button>
          )}
          <Button asChild className="min-h-11">
            <Link to={newJobLink}>
              <Plus aria-hidden="true" />
              Nuevo trabajo
            </Link>
          </Button>
        </div>
      </div>

      {jobs.isError ? (
        <QueryError
          error={jobs.error}
          title="No se pudo cargar el historial"
          onRetry={() => void jobs.refetch()}
        />
      ) : jobs.isPending ? (
        <Skeleton className="h-40 rounded-xl" role="status" aria-label="Cargando trabajos" />
      ) : jobs.data.data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={page > 1 ? 'Esta página está vacía' : 'Todavía no tiene trabajos'}
          description={page > 1 ? undefined : 'Registrá el primero para llevar su historial.'}
          action={
            page > 1 ? (
              <Button variant="outline" className="min-h-11" onClick={() => setPage(1)}>
                Ir a la primera página
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="sr-only" role="status">
            {jobs.isPlaceholderData
              ? 'Cargando trabajos…'
              : `Página ${jobs.data.meta.page} de ${Math.ceil(jobs.data.meta.total / jobs.data.meta.pageSize)}`}
          </p>
          <div
            aria-busy={jobs.isPlaceholderData}
            className={cn('transition-opacity', jobs.isPlaceholderData && 'opacity-60')}
          >
            <JobList jobs={jobs.data.data} showClient={false} />
          </div>
          <Pagination
            meta={jobs.data.meta}
            onPageChange={setPage}
            itemsLabel="trabajos"
            pending={jobs.isPlaceholderData}
          />
        </>
      )}
    </section>
  );
}

function DeleteClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: AdminClientDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const remove = useDeleteClient();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={`¿Borrar a ${client.fullName}?`}
      description={<p>Se borran sus datos de contacto y notas. No se puede deshacer.</p>}
      confirmLabel="Borrar cliente"
      pendingLabel="Borrando…"
      pending={remove.isPending}
      error={remove.error ? mutationErrorMessage(remove.error, 'No se pudo borrar') : null}
      onCloseAutoFocus={remove.isSuccess ? focusMainOnClose : undefined}
      onConfirm={() =>
        remove.mutate(client.id, {
          onSuccess: () => {
            toast.success('Cliente borrado');
            void navigate('/admin/clientes', { replace: true });
          },
        })
      }
    />
  );
}
