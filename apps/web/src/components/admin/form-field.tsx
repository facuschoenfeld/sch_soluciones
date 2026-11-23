import { Eye, EyeOff, TriangleExclamationPoint } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** "warning": la pista es un aviso (no bloquea, pero hay que verla). */
  hintTone?: 'muted' | 'warning';
  children: (aria: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

/**
 * Label + control + ayuda + error, con los atributos aria conectados. El label tiene id
 * `<id>-label`, para controles compuestos que lo usan con `aria-labelledby`.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  hintTone = 'muted',
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // `content-start`: en una grilla de varias columnas la celda se estira al alto de la fila (la
  // vecina con ayuda o error es más alta); sin esto las filas internas también se estiran y el
  // label y el control bajan, desalineados con los de al lado.
  return (
    <div className="grid content-start gap-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <p
          id={hintId}
          className={cn(
            'text-sm',
            hintTone === 'warning'
              ? 'flex gap-1.5 font-medium text-destructive-text'
              : 'text-muted-foreground',
          )}
        >
          {hintTone === 'warning' && (
            <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Input de contraseña con botón para mostrarla (útil en el celular). */
export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('h-11 pr-12', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 size-11"
        onClick={() => setVisible((value) => !value)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
