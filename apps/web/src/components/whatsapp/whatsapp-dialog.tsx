import {
  buildWhatsappUrl,
  isValidWhatsappNumber,
  type PublicServiceSummary,
  type PublicSettings,
} from '@sch/shared';
import { CalendarCheck, MessageCircle, MessagesSquare, type LucideIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { QueryError } from '@/components/feedback/query-error';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/lib/public-api';
import { WHATSAPP_INTENT_LABELS, buildInitialMessage, type WhatsappIntent } from '@/lib/whatsapp';

const INTENT_ICONS: Record<WhatsappIntent, LucideIcon> = {
  booking: CalendarCheck,
  inquiry: MessagesSquare,
};

interface WhatsappDialogContentProps {
  service: PublicServiceSummary | null;
  initialIntent: WhatsappIntent;
  /** Se llama al abrir WhatsApp (para cerrar el diálogo). */
  onSent: () => void;
}

export function WhatsappDialogContent({
  service,
  initialIntent,
  onSent,
}: WhatsappDialogContentProps) {
  const settings = useSettings();

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Escribime por WhatsApp</DialogTitle>
        <DialogDescription>
          {service ? (
            <>
              Sobre: <span className="font-medium text-foreground">{service.name}</span>. Podés
              editar el mensaje antes de enviarlo.
            </>
          ) : (
            'Contame en qué te puedo ayudar. Podés editar el mensaje antes de enviarlo.'
          )}
        </DialogDescription>
      </DialogHeader>

      {/* Se decide por `data` y no por el estado: si falla un refetch en segundo plano, los datos
          siguen y el formulario no se desmonta (no se pierde lo que el visitante escribió). */}
      {settings.data ? (
        <WhatsappMessageForm
          settings={settings.data}
          service={service}
          initialIntent={initialIntent}
          onSent={onSent}
        />
      ) : settings.isError ? (
        <QueryError
          error={settings.error}
          title="No se pudieron cargar los datos de contacto"
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <div className="space-y-3" role="status" aria-label="Cargando">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </DialogContent>
  );
}

interface WhatsappMessageFormProps extends WhatsappDialogContentProps {
  settings: PublicSettings;
}

function WhatsappMessageForm({
  settings,
  service,
  initialIntent,
  onSent,
}: WhatsappMessageFormProps) {
  const id = useId();
  const [intent, setIntent] = useState(initialIntent);
  const [message, setMessage] = useState(() =>
    buildInitialMessage(settings, service, initialIntent),
  );
  // Texto editado que se reemplazó al cambiar de opción, para poder deshacerlo.
  const [replacedText, setReplacedText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const changeIntent = (next: WhatsappIntent) => {
    const edited = message !== buildInitialMessage(settings, service, intent);
    setIntent(next);
    setMessage(buildInitialMessage(settings, service, next));
    // Si el texto no estaba editado se conserva lo guardado: cambiar de opción dos veces no
    // debe perder lo que el visitante había escrito.
    setReplacedText(edited ? message : replacedText);
  };

  const undoReplace = () => {
    if (replacedText === null) return;
    setMessage(replacedText);
    setReplacedText(null);
    // El botón "Deshacer" desaparece: el foco vuelve al texto restaurado.
    textareaRef.current?.focus();
  };

  const hasValidNumber = isValidWhatsappNumber(settings.whatsappNumber);
  const finalMessage = message.trim();
  const href =
    hasValidNumber && finalMessage ? buildWhatsappUrl(settings.whatsappNumber, finalMessage) : null;

  return (
    <div className="grid gap-4">
      {service && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">¿Qué querés hacer?</legend>
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            {(Object.keys(WHATSAPP_INTENT_LABELS) as WhatsappIntent[]).map((option) => {
              const Icon = INTENT_ICONS[option];
              return (
                <label
                  key={option}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                >
                  <input
                    type="radio"
                    name={`${id}-intent`}
                    value={option}
                    checked={intent === option}
                    onChange={() => changeIntent(option)}
                    className="sr-only"
                  />
                  <Icon className="size-4" aria-hidden="true" />
                  {WHATSAPP_INTENT_LABELS[option]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-message`}>Mensaje</Label>
        <Textarea
          ref={textareaRef}
          id={`${id}-message`}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setReplacedText(null);
          }}
          rows={5}
          maxLength={1000}
          aria-describedby={`${id}-hint`}
          className="max-h-64 min-h-32"
        />
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {finalMessage
            ? 'Al confirmar se abre WhatsApp en una pestaña nueva con este texto.'
            : 'Escribí un mensaje para continuar.'}
        </p>
        <div aria-live="polite">
          {replacedText !== null && (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              Se reemplazó el texto que habías escrito.
              <Button
                type="button"
                variant="link"
                className="h-auto min-h-10 px-0"
                onClick={undoReplace}
              >
                Deshacer
              </Button>
            </p>
          )}
        </div>
      </div>

      {!hasValidNumber && (
        <p role="alert" className="text-sm font-medium text-destructive">
          El número de WhatsApp todavía no está configurado. Probá más tarde.
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" className="min-h-11">
            Cancelar
          </Button>
        </DialogClose>
        {href ? (
          <Button asChild variant="whatsapp" className="min-h-11">
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={onSent}>
              <MessageCircle aria-hidden="true" />
              Abrir WhatsApp
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </Button>
        ) : (
          <Button variant="whatsapp" className="min-h-11" disabled aria-describedby={`${id}-hint`}>
            <MessageCircle aria-hidden="true" />
            Abrir WhatsApp
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
