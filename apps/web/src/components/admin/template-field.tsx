import {
  WHATSAPP_TEMPLATE_MAX_LENGTH,
  buildWhatsappMessage,
  type WhatsappTemplateValues,
  type WhatsappTemplateVariable,
} from '@sch/shared';
import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WhatsappIcon } from '@/components/whatsapp/whatsapp-icon';
import { FormField } from './form-field';

interface TemplateFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Plantilla que se usa si el campo queda vacío (se muestra en la vista previa). */
  fallback: string;
  fallbackLabel: string;
  /** Variables que tienen sentido en esta plantilla (la general no tiene servicio ni precio). */
  variables: readonly WhatsappTemplateVariable[];
  /** Valores de ejemplo para la vista previa. */
  previewValues: WhatsappTemplateValues;
}

/** Plantilla de WhatsApp: chips para insertar variables donde está el cursor y vista previa. */
export function TemplateField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  onBlur,
  fallback,
  fallbackLabel,
  variables,
  previewValues,
}: TemplateFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = value.trim() === '';
  const preview = buildWhatsappMessage(isEmpty ? fallback : value, previewValues);

  const insertVariable = (variable: WhatsappTemplateVariable) => {
    const token = `{{${variable}}}`;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    // Después del render, el cursor queda justo detrás de la variable insertada.
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-3">
      <FormField id={id} label={label} hint={hint} error={error}>
        {(aria) => (
          <Textarea
            {...aria}
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            placeholder={fallback}
            maxLength={WHATSAPP_TEMPLATE_MAX_LENGTH}
            rows={3}
          />
        )}
      </FormField>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Insertar variable"
      >
        <span className="text-sm text-muted-foreground">Insertar:</span>
        {variables.map((variable) => (
          <Button
            key={variable}
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 font-mono text-xs"
            onClick={() => insertVariable(variable)}
            aria-label={`Insertar {{${variable}}}`}
          >
            <Plus className="size-3" aria-hidden="true" />
            {`{{${variable}}}`}
          </Button>
        ))}
      </div>

      <figure className="space-y-1.5">
        <figcaption className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <WhatsappIcon className="size-4" aria-hidden="true" />
          Vista previa{isEmpty && ` (vacía: se usa ${fallbackLabel})`}
        </figcaption>
        <p
          className="rounded-lg rounded-tl-none bg-whatsapp/10 px-3 py-2 text-sm whitespace-pre-wrap"
          data-testid={`${id}-preview`}
        >
          {preview}
        </p>
      </figure>
    </div>
  );
}
