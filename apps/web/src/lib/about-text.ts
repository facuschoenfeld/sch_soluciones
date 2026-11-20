/** Texto de "Sobre mí" mientras no se cargue uno propio desde Configuración. */
export const DEFAULT_ABOUT_TEXT =
  'Trabajo de forma independiente en dos líneas: desarrollo de páginas web y aplicaciones de ' +
  'escritorio a medida, y servicio técnico de PC (mantenimiento, reparación, diagnóstico e ' +
  'instalación de software). Atención personalizada y presupuestos claros.';

/** "Sobre mí" es texto plano: los párrafos se separan con una línea en blanco. */
export function aboutParagraphs(aboutText: string | null): string[] {
  const paragraphs = (aboutText ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : [DEFAULT_ABOUT_TEXT];
}
