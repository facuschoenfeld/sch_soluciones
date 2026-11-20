/**
 * Lee un monto escrito a mano en formato argentino: "25000", "25.000", "1.500,50", "$ 2.000",
 * "-1.000". El punto es separador de miles solo si separa grupos de 3 cifras ("25.000"); si
 * no, se toma como decimal ("1500.5"), por si se pega un número en formato inglés.
 * Vacío → null. Texto que no es un número → NaN (el esquema de Zod lo marca como inválido).
 */
export function parseAmountInput(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[\s$]/g, '').replace(/^US/i, '');
  if (text === '') return null;

  let normalized = text;
  if (text.includes(',')) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '');
  }
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Monto para precargar un input: 25000 → "25000"; 1500.5 → "1500,5". */
export function formatAmountInput(amount: number | null): string {
  return amount === null ? '' : String(amount).replace('.', ',');
}
