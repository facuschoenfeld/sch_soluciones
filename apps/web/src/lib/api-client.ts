import type { ApiErrorBody } from '@sch/shared';

/** Error de la API con el código y mensaje del formato uniforme `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Detalle de validación (ej. `[{ path, message }]`) para marcar campos del formulario. */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Errores por campo en el formato de la API: `details: [{ path: ['campo'], message }]`. */
export function fieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return result;
  for (const item of error.details as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { path, message } = item as { path?: unknown; message?: unknown };
    const field = Array.isArray(path) ? path[0] : undefined;
    if (typeof field === 'string' && typeof message === 'string' && !(field in result)) {
      result[field] = message;
    }
  }
  return result;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.message === 'string' &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // `Headers` acepta cualquier forma de HeadersInit (objeto, array o instancia de Headers).
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  // same-origin: la cookie de sesión viaja sola (el front y la API comparten origen).
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', headers });

  // 204 No Content (logout, cambio de contraseña) no trae body.
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(response.status, 'UNKNOWN', 'No se pudo completar la solicitud');
  }

  return body as T;
}

export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

/**
 * Escrituras (POST/PUT/PATCH/DELETE). Siempre con Content-Type JSON, aunque no haya body: la
 * API rechaza (415) las escrituras sin JSON como defensa CSRF.
 */
export function apiSend<T = void>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Nombre del archivo de `Content-Disposition: attachment; filename="x.pdf"`. */
function attachmentName(header: string | null, fallback: string): string {
  const match = header ? /filename="([^"]+)"/.exec(header) : null;
  return match?.[1] ?? fallback;
}

/**
 * Descarga un archivo de la API (exportaciones). Se pide con fetch y no con un link directo:
 * así un error (ej. demasiados registros) se muestra como aviso en vez de abrir una página con
 * el JSON del error.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<string> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (isApiErrorBody(body)) {
      throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(response.status, 'UNKNOWN', 'No se pudo descargar el archivo');
  }
  const url = URL.createObjectURL(await response.blob());
  const name = attachmentName(response.headers.get('Content-Disposition'), fallbackName);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Después de que el navegador tomó el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
