import {
  JOB_STATUS_LABELS,
  isBackwardStatusChange,
  isDoneJobStatus,
  jobStatusChangeIssue,
  nextJobStatus,
  type AdminJob,
  type JobStatus,
} from '@sch/shared';
import { ArrowRight } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { mutationErrorMessage, useSaveJob } from '@/lib/admin-api';
import { notifyError } from '@/lib/notify';
import { ConfirmDialog } from './confirm-dialog';
import { JobStatusBadge } from './job-badges';

const STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[];

/**
 * Estado de un trabajo guardado: el paso siguiente como acción principal y cualquier otro
 * desde la lista. Avanzar (aunque se salteen pasos) y cancelar se aplican al instante;
 * retroceder o reabrir un cancelado pide confirmación.
 */
export function JobStatusControl({ job }: { job: AdminJob }) {
  const save = useSaveJob();
  const selectId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [target, setTarget] = useState<JobStatus | ''>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  // El destino de la confirmación queda guardado aunque el diálogo se cierre: así el texto no
  // se vacía durante la animación de salida.
  const [confirming, setConfirming] = useState<JobStatus>('QUOTED');
  const next = nextJobStatus(job.status);
  const reopening = job.status === 'CANCELLED';

  const apply = (status: JobStatus, fromPrimary: boolean) => {
    if (save.isPending) return;
    save.mutate(
      { id: job.id, input: { status } },
      {
        onSuccess: () => {
          setTarget('');
          setConfirmOpen(false);
          toast.success(`Estado: ${JOB_STATUS_LABELS[status]}`);
          // En el último paso el botón principal desaparece: el foco va al encabezado.
          if (fromPrimary && !nextJobStatus(status)) {
            requestAnimationFrame(() => headingRef.current?.focus());
          }
        },
        onError: (error) => {
          setConfirmOpen(false);
          notifyError(mutationErrorMessage(error, 'No se pudo cambiar el estado'));
        },
      },
    );
  };

  const request = (status: JobStatus, fromPrimary = false) => {
    if (isBackwardStatusChange(job.status, status)) {
      setConfirming(status);
      setConfirmOpen(true);
    } else {
      apply(status, fromPrimary);
    }
  };

  return (
    <section
      aria-labelledby="job-status-heading"
      className="space-y-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id="job-status-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold focus-visible:outline-none"
        >
          Estado
        </h2>
        <JobStatusBadge status={job.status} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {next && (
          <Button
            className="min-h-11"
            aria-disabled={save.isPending}
            onClick={() => request(next, true)}
          >
            Pasar a {JOB_STATUS_LABELS[next]}
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={selectId}>Cambiar a otro estado</Label>
          <div className="flex gap-2">
            <NativeSelect
              id={selectId}
              value={target}
              onChange={(event) => setTarget(event.target.value as JobStatus | '')}
              className="min-w-44"
            >
              <option value="">Elegí un estado</option>
              {STATUSES.filter((status) => status !== job.status).map((status) => {
                const unavailable = jobStatusChangeIssue(job.status, status) !== null;
                return (
                  <option key={status} value={status} disabled={unavailable}>
                    {JOB_STATUS_LABELS[status]}
                    {unavailable ? ' (no disponible)' : ''}
                  </option>
                );
              })}
            </NativeSelect>
            <Button
              variant="outline"
              className="min-h-11"
              aria-disabled={!target || save.isPending}
              onClick={() => target && request(target)}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {save.isPending
          ? 'Guardando el estado…'
          : job.status === 'DELIVERED'
            ? 'Un trabajo entregado no se puede cancelar.'
            : 'Al terminar un trabajo se registra la fecha de terminado (la de ese día).'}
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={reopening ? '¿Reabrir el trabajo?' : `¿Volver a ${JOB_STATUS_LABELS[confirming]}?`}
        description={
          <p>
            {reopening ? (
              <>
                El trabajo está cancelado y va a volver a estar activo, en{' '}
                <strong>{JOB_STATUS_LABELS[confirming]}</strong>.
              </>
            ) : (
              <>
                El trabajo está en <strong>{JOB_STATUS_LABELS[job.status]}</strong> y vuelve a{' '}
                <strong>{JOB_STATUS_LABELS[confirming]}</strong>, un paso anterior del flujo.
              </>
            )}{' '}
            {isDoneJobStatus(job.status) && !isDoneJobStatus(confirming)
              ? 'Se borra la fecha de terminado (se completa de nuevo al terminarlo). Los cobros no cambian.'
              : !isDoneJobStatus(job.status) && isDoneJobStatus(confirming)
                ? 'La fecha de terminado pasa a ser la de hoy. Los cobros no cambian.'
                : 'Las fechas y los cobros no cambian.'}
          </p>
        }
        confirmLabel={reopening ? 'Reabrir' : 'Sí, volver'}
        pendingLabel="Guardando…"
        pending={save.isPending}
        destructive={false}
        onConfirm={() => apply(confirming, false)}
      />
    </section>
  );
}
