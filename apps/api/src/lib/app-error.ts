/** Error de dominio con código estable (inglés) y mensaje visible para el usuario (es-AR). */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  /**
   * @param details se envía al cliente: no incluir datos internos.
   * @param cause error original; solo se registra en logs, nunca se envía al cliente.
   */
  constructor(status: number, code: string, message: string, details?: unknown, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
