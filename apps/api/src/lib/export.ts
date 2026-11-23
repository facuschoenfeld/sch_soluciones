import { EXPORT_MAX_ROWS, PDF_EXPORT_MAX_ROWS, type ExportFormat } from '@sch/shared';
import type { Response } from 'express';
import { AppError } from './app-error.js';

// Exportación de listados del panel (clientes y trabajos) a CSV y PDF.

/** `{ excelText }`: celda que Excel debe mantener como texto (ver `csvDigits`). */
export type CsvValue = string | number | null | { excelText: string };

/**
 * Una celda que empieza con =, +, -, @, tab o CR se ejecuta como fórmula al abrir el CSV en
 * Excel (inyección de fórmulas): se le antepone un apóstrofo. Solo a textos; los números van tal
 * cual.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const UTF8_BOM = String.fromCharCode(0xfeff);

function csvCell(value: CsvValue): string {
  if (value === null) return '';
  if (typeof value === 'object') return `"=""${value.excelText}"""`;
  let text = String(value);
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV para Excel en es-AR: separador ";" (la coma es el separador decimal), BOM para que tome
 * UTF-8 (tildes y ñ) y fin de línea CRLF.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(';'));
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * Número de solo dígitos (teléfono) que Excel convertiría en número: "5491122334455" se vería
 * como 5,49E+12 y "011…" perdería el 0. Se escribe como fórmula de texto (="5491122334455"),
 * algo seguro solo porque el valor son dígitos validados (cualquier otra cosa sale tal cual,
 * con la protección anti-fórmulas de siempre). Los N° de serie (texto libre) no pasan por acá.
 */
export function csvDigits(value: string): CsvValue {
  return /^\d+$/.test(value) ? { excelText: value } : value;
}

/** Monto para el CSV: sin separador de miles y con coma decimal ("25000,50"). */
export function csvAmount(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

/** Tope de filas según el formato (el PDF es mucho más costoso de generar). */
export function exportRowLimit(format: ExportFormat): number {
  return format === 'pdf' ? PDF_EXPORT_MAX_ROWS : EXPORT_MAX_ROWS;
}

/**
 * Las consultas de exportación piden `exportRowLimit + 1` filas: si vuelven más que el tope, se
 * pide filtrar (sin un count aparte, que además podría quedar desfasado del findMany).
 */
export function assertExportSize(rows: number, format: ExportFormat): void {
  const limit = exportRowLimit(format);
  if (rows > limit) {
    const hint = format === 'pdf' ? ' (o exportá a CSV)' : '';
    throw new AppError(
      400,
      'EXPORT_TOO_LARGE',
      `Hay más de ${limit.toLocaleString('es-AR')} registros: filtrá el listado para exportarlo${hint}`,
    );
  }
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
};

/** Envía el archivo como descarga. `baseName` es fijo (sin datos de entrada). */
export function sendExport(
  res: Response,
  format: ExportFormat,
  baseName: string,
  body: string | Buffer,
): void {
  res.setHeader('Content-Type', CONTENT_TYPES[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}.${format}"`);
  res.send(body);
}
