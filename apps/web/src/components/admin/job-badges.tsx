import {
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentStatus,
  type JobStatus,
} from '@sch/shared';
import {
  CalendarClock,
  Check,
  CircleDashed,
  CircleDollarSign,
  CircleX,
  PackageCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// El estado se distingue por texto e ícono, no solo por color (accesibilidad).
const STATUS_STYLES: Record<JobStatus, { icon: LucideIcon; className: string }> = {
  QUOTED: { icon: CircleDashed, className: 'border-border text-foreground' },
  SCHEDULED: { icon: CalendarClock, className: 'border-primary/40 text-primary' },
  IN_PROGRESS: { icon: Wrench, className: 'bg-secondary text-secondary-foreground' },
  COMPLETED: { icon: Check, className: 'bg-primary text-primary-foreground' },
  DELIVERED: { icon: PackageCheck, className: 'bg-primary text-primary-foreground' },
  CANCELLED: { icon: CircleX, className: 'bg-muted text-muted-foreground' },
};

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const { icon: Icon, className: style } = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={cn(style, className)}>
      <Icon aria-hidden="true" />
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Pagado / parcial / sin pagar. Nada si el trabajo no tiene cargo. */
export function PaymentBadge({
  amountCharged,
  amountPaid,
}: {
  amountCharged: number;
  amountPaid: number;
}) {
  const status = paymentStatus(amountCharged, amountPaid);
  if (status === 'NO_CHARGE') return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        status === 'PAID' && 'border-border text-foreground',
        status === 'PARTIAL' && 'border-border bg-secondary text-secondary-foreground',
        status === 'PENDING' && 'border-destructive/40 text-destructive-text',
      )}
    >
      {status === 'PAID' ? <Check aria-hidden="true" /> : <CircleDollarSign aria-hidden="true" />}
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
