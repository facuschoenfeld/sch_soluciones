// Contratos de respuesta comunes entre la API y el front.

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Envoltorio de las respuestas no paginadas. */
export interface DataResponse<T> {
  data: T;
}

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface DbHealthResponse extends HealthResponse {
  database: 'up';
}
