import PDFDocument from 'pdfkit';

// Tabla simple en PDF (A4 apaisado) para exportar listados del panel. Usa Helvetica, una de las
// fuentes estándar de PDF: no hace falta embeber archivos de fuentes.

export interface PdfColumn {
  header: string;
  /** Peso relativo del ancho de la columna. */
  weight: number;
  align?: 'left' | 'right';
}

export interface PdfTableOptions {
  title: string;
  subtitle: string;
  columns: readonly PdfColumn[];
  rows: readonly (readonly string[])[];
  emptyMessage: string;
}

// Caracteres de WinAnsi (la codificación de las fuentes estándar) fuera de Latin-1.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
/** Tope por celda: una nota larguísima no debe ocupar más de una página. */
const CELL_MAX_LENGTH = 300;

/**
 * Las fuentes estándar solo tienen los caracteres de WinAnsi (español completo, con tildes, ñ,
 * ¿ y ¡). El resto (emojis, otros alfabetos) se reemplaza por "?" en lugar de salir ilegible.
 */
export function pdfText(value: string): string {
  const text = Array.from(value.normalize('NFC'), (char) => {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return char;
    // Los saltos de línea se aplanan: con muchos, una celda ocuparía varias páginas.
    if (char === '\n' || char === '\t' || char === '\r') return ' ';
    return WIN_ANSI_EXTRA.has(char) ? char : '?';
  }).join('');
  return text.length > CELL_MAX_LENGTH ? `${text.slice(0, CELL_MAX_LENGTH - 1)}…` : text;
}

const FONT_SIZE = 8;
const PADDING = 4;
const FOOTER_SPACE = 18;

export function renderTablePdf({
  title,
  subtitle,
  columns,
  rows,
  emptyMessage,
}: PdfTableOptions): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36,
    bufferPages: true,
    info: { Title: pdfText(title) },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const { left, top, right, bottom } = doc.page.margins;
  const usableWidth = doc.page.width - left - right;
  const maxY = doc.page.height - bottom - FOOTER_SPACE;
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const widths = columns.map((column) => (column.weight / totalWeight) * usableWidth);

  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(14).text(pdfText(title), left, top);
  doc.fillColor('#555555').font('Helvetica').fontSize(9).text(pdfText(subtitle));
  let y = doc.y + 10;

  const rowHeight = (cells: readonly string[], font: string) => {
    doc.font(font).fontSize(FONT_SIZE);
    const heights = cells.map((cell, index) =>
      doc.heightOfString(cell, { width: (widths[index] ?? 0) - PADDING * 2 }),
    );
    return Math.max(FONT_SIZE, ...heights) + PADDING * 2;
  };

  const drawRow = (cells: readonly string[], font: string, height: number, fill?: string) => {
    if (fill) doc.rect(left, y, usableWidth, height).fill(fill);
    doc.fillColor('#111111').font(font).fontSize(FONT_SIZE);
    let x = left;
    cells.forEach((cell, index) => {
      const width = widths[index] ?? 0;
      doc.text(cell, x + PADDING, y + PADDING, {
        width: width - PADDING * 2,
        align: columns[index]?.align ?? 'left',
      });
      x += width;
    });
    doc
      .moveTo(left, y + height)
      .lineTo(left + usableWidth, y + height)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();
    y += height;
  };

  const header = columns.map((column) => pdfText(column.header));
  const headerHeight = rowHeight(header, 'Helvetica-Bold');
  const drawHeader = () => drawRow(header, 'Helvetica-Bold', headerHeight, '#eeeeee');
  drawHeader();

  if (rows.length === 0) {
    doc
      .fillColor('#555555')
      .font('Helvetica')
      .fontSize(9)
      .text(pdfText(emptyMessage), left, y + 8);
  }
  for (const row of rows) {
    const cells = row.map(pdfText);
    // La altura se mide una sola vez por fila (es lo más costoso de pdfkit).
    const height = rowHeight(cells, 'Helvetica');
    if (y + height > maxY) {
      doc.addPage();
      y = top;
      drawHeader();
    }
    drawRow(cells, 'Helvetica', height);
  }

  // Numeración al pie. Sin margen inferior mientras se escribe: si no, pdfkit agregaría una
  // página nueva al escribir debajo del área de contenido.
  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index++) {
    doc.switchToPage(index);
    doc.page.margins.bottom = 0;
    doc
      .fillColor('#555555')
      .font('Helvetica')
      .fontSize(8)
      .text(`Página ${index + 1} de ${pages.count}`, left, doc.page.height - bottom - 10, {
        width: usableWidth,
        align: 'right',
        lineBreak: false,
      });
  }

  doc.end();
  return done;
}
