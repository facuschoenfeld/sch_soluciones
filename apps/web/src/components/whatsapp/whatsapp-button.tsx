import type { PublicServiceSummary } from '@sch/shared';
import { useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import type { WhatsappIntent } from '@/lib/whatsapp';
import { WhatsappDialogContent } from './whatsapp-dialog';

interface WhatsappButtonProps extends Omit<ComponentProps<typeof Button>, 'asChild'> {
  /** Servicio sobre el que se consulta; sin servicio se usa la plantilla general. */
  service?: PublicServiceSummary | null;
  /** Opción rápida seleccionada al abrir el diálogo. */
  intent?: WhatsappIntent;
}

/** Botón que abre el diálogo de WhatsApp con el mensaje pre-cargado y editable. */
export function WhatsappButton({
  service = null,
  intent = 'booking',
  ...buttonProps
}: WhatsappButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...buttonProps} />
      </DialogTrigger>
      {/* El contenido se monta al abrir: cada apertura arranca con el texto de la plantilla. */}
      <WhatsappDialogContent
        service={service}
        initialIntent={intent}
        onSent={() => setOpen(false)}
      />
    </Dialog>
  );
}
