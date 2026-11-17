import type { ApiErrorBody } from '@sch/shared';

/** Error de la API con el código y mensaje del formato uniforme `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
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

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  // `Headers` acepta cualquier forma de HeadersInit (objeto, array o instancia de Headers).
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');

  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', headers });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(response.status, body.error.code, body.error.message);
    }
    throw new ApiError(response.status, 'UNKNOWN', 'No se pudo completar la solicitud');
  }

  return body as T;
}
