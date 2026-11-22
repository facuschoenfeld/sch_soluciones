import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@sch/shared';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Markdown } from '@/components/markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface MarkdownEditorProps {
  value: string;
  /** Con un error de validación se vuelve a "Escribir": el campo y su mensaje quedan a la vista. */
  hasError?: boolean;
  /** Props del textarea (register de React Hook Form + atributos aria del FormField). */
  textareaProps: ComponentProps<typeof Textarea>;
}

/**
 * Descripción en markdown con pestañas "Escribir" / "Vista previa". La vista previa usa el
 * mismo componente que el detalle público, así se ve igual que en el sitio.
 */
export function MarkdownEditor({ value, hasError = false, textareaProps }: MarkdownEditorProps) {
  const [tab, setTab] = useState('write');
  // Al aparecer un error se pasa a "Escribir" una vez (después se puede volver a la vista
  // previa). Ajuste de estado durante el render, sin efecto: patrón recomendado por React.
  const [hadError, setHadError] = useState(hasError);
  if (hasError !== hadError) {
    setHadError(hasError);
    if (hasError) setTab('write');
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaId = textareaProps.id;

  // El formulario intenta enfocar el campo con error antes de que se vea (seguía oculto en la
  // vista previa). Una vez visible, si el foco quedó en las pestañas o se perdió, va al campo.
  useEffect(() => {
    if (!hasError || !textareaId) return;
    const active = document.activeElement;
    if (active === document.body || containerRef.current?.contains(active)) {
      document.getElementById(textareaId)?.focus();
    }
  }, [hasError, textareaId]);

  return (
    <Tabs ref={containerRef} value={tab} onValueChange={setTab} className="gap-2">
      <TabsList className="h-11">
        <TabsTrigger value="write" className="h-9 px-4">
          Escribir
        </TabsTrigger>
        <TabsTrigger value="preview" className="h-9 px-4">
          Vista previa
        </TabsTrigger>
      </TabsList>
      {/* forceMount: el textarea sigue montado (y registrado en el formulario) en la vista previa. */}
      <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
        <Textarea
          rows={10}
          maxLength={SERVICE_DESCRIPTION_MAX_LENGTH}
          className="font-mono text-sm"
          {...textareaProps}
        />
      </TabsContent>
      <TabsContent value="preview" className="min-h-40 rounded-md border px-4 py-3 focus-ring">
        {value.trim() ? (
          <Markdown>{value}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay descripción.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
