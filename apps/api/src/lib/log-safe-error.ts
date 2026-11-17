/**
 * Reduce un error a lo que es seguro registrar en logs.
 * Los errores de Prisma y del driver adapter incluyen en `message` la consulta o valores
 * enviados (nombres, teléfonos, etc.), así que de ellos solo se guardan nombre y códigos
 * (Ley 25.326).
 */
export function toLogSafeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: typeof error === 'string' ? error : typeof error };
  }

  if (error.name.startsWith('PrismaClient')) {
    const { code, meta } = error as Error & { code?: unknown; meta?: { modelName?: unknown } };
    return { name: error.name, code, modelName: meta?.modelName };
  }

  if (error.name === 'DriverAdapterError') {
    const { cause } = error as Error & { cause?: { kind?: unknown; code?: unknown } };
    return { name: error.name, kind: cause?.kind, code: cause?.code };
  }

  return { name: error.name, message: error.message, stack: error.stack };
}
