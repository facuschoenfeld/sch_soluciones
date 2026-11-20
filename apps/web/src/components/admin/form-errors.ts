import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { fieldErrors } from '@/lib/api-client';

/**
 * Pasa los errores por campo de la API (`details: [{ path, message }]`) al formulario y enfoca
 * el primero. Devuelve false si la API no marcó ninguno de esos campos (el error es general).
 */
export function applyFieldErrors<T extends FieldValues>(
  form: Pick<UseFormReturn<T, unknown, unknown>, 'setError'>,
  fields: readonly Path<T>[],
  error: unknown,
): boolean {
  const byField = fieldErrors(error);
  let applied = false;
  for (const field of fields) {
    const message = byField[field];
    if (!message) continue;
    form.setError(field, { message }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}
