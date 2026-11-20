import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@sch/shared';
import { useState, type ComponentProps } from 'react';
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
  return (
    <Tabs value={hasError ? 'write' : tab} onValueChange={setTab} className="gap-2">
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
