/**
 * Devuelve la URL solo si es http(s). Las redes se cargan desde el panel: así un valor como
 * "javascript:..." nunca llega a un href.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
