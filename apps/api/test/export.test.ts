import { describe, expect, it } from 'vitest';
import { csvAmount, csvDigits, toCsv } from '../src/lib/export.js';
import { pdfText, renderTablePdf } from '../src/lib/pdf-table.js';

const BOM = String.fromCharCode(0xfeff);

describe('toCsv', () => {
  it('separa con ";", usa CRLF y antepone el BOM', () => {
    const csv = toCsv(['Nombre', 'Total'], [['Ana', 10]]);
    expect(csv).toBe(`${BOM}Nombre;Total\r\nAna;10\r\n`);
  });

  it('null queda como celda vacía y conserva tildes y ñ', () => {
    expect(toCsv(['a', 'b'], [[null, 'Peña']])).toBe(`${BOM}a;b\r\n;Peña\r\n`);
  });

  it('entrecomilla celdas con ;, comillas o saltos de línea (y duplica las comillas)', () => {
    const csv = toCsv(['x'], [['a;b'], ['dice "hola"'], ['l1\nl2'], ['l1\r\nl2']]);
    expect(csv).toBe(`${BOM}x\r\n"a;b"\r\n"dice ""hola"""\r\n"l1\nl2"\r\n"l1\r\nl2"\r\n`);
  });

  it('una coma no obliga a entrecomillar (el separador es ";")', () => {
    expect(toCsv(['x'], [['1,5']])).toBe(`${BOM}x\r\n1,5\r\n`);
  });

  it.each(['=1+1', '+54 11', '-5', '@SUMA(A1)', '\tcelda', '\rcelda'])(
    'protege contra inyección de fórmulas: %j',
    (text) => {
      const csv = toCsv(['x'], [[text]]);
      // La celda no puede quedar con el disparador como primer carácter.
      const cell = csv.slice(BOM.length).split('\r\n')[1] ?? '';
      expect(cell.replace(/^"/, '')[0]).toBe("'");
    },
  );

  it('no antepone apóstrofo a números negativos (solo a strings)', () => {
    expect(toCsv(['x'], [[-5]])).toBe(`${BOM}x\r\n-5\r\n`);
  });

  it('no toca textos que solo contienen el disparador en el medio', () => {
    expect(toCsv(['x'], [['a=b'], ['mail@x.com']])).toBe(`${BOM}x\r\na=b\r\nmail@x.com\r\n`);
  });

  it('el encabezado también se escapa; sin filas queda solo el encabezado', () => {
    expect(toCsv(['a;b'], [])).toBe(`${BOM}"a;b"\r\n`);
  });
});

describe('csvAmount', () => {
  it('coma decimal, 2 decimales y sin separador de miles', () => {
    expect(csvAmount(25000)).toBe('25000,00');
    expect(csvAmount(1500.5)).toBe('1500,50');
    expect(csvAmount(0)).toBe('0,00');
    expect(csvAmount(1234567.89)).toBe('1234567,89');
  });
});

describe('csvDigits', () => {
  const line = (text: string) => text.slice(BOM.length).split('\r\n')[1];

  it('dígitos: celda de texto para Excel (="…")', () => {
    expect(csvDigits('5491122334455')).toEqual({ excelText: '5491122334455' });
    expect(toCsv(['Tel'], [[csvDigits('5491122334455')]])).toBe(
      `${BOM}Tel\r\n"=""5491122334455"""\r\n`,
    );
  });

  it('conserva los ceros a la izquierda', () => {
    expect(line(toCsv(['Tel'], [[csvDigits('01122334455')]]))).toBe('"=""01122334455"""');
  });

  it.each(['+5491122', '=1+1', '549 11', '12a', 'abc'])(
    'otro texto (%j) sale igual y conserva la protección anti-fórmulas',
    (text) => {
      expect(csvDigits(text)).toBe(text);
      const cell = line(toCsv(['x'], [[csvDigits(text)]]));
      expect(cell).toBe(line(toCsv(['x'], [[text]])));
      if (/^[=+]/.test(text)) expect(cell?.replace(/^"/, '')[0]).toBe("'");
    },
  );
});

describe('pdfText', () => {
  it('conserva tildes, ñ, ¿ y ¡', () => {
    expect(pdfText('Reparación ñandú ¿qué? ¡hola!')).toBe('Reparación ñandú ¿qué? ¡hola!');
  });

  it('conserva caracteres de WinAnsi fuera de Latin-1 (€, comillas tipográficas)', () => {
    expect(pdfText('10 € “ok”')).toBe('10 € “ok”');
  });

  it('reemplaza emojis y otros alfabetos por "?"', () => {
    expect(pdfText('PC 😀 lista')).toBe('PC ? lista');
    expect(pdfText('漢字')).toBe('??');
  });

  it('tabs, CR y saltos de línea pasan a espacio (una celda no ocupa varias páginas)', () => {
    expect(pdfText('a\tb\rc\nd')).toBe('a b c d');
  });

  it('normaliza a NFC (e + tilde combinada queda como un carácter)', () => {
    expect(pdfText('é')).toBe('é');
  });

  it('trunca a 300 caracteres con "…"', () => {
    const out = pdfText('a'.repeat(500));
    expect(out).toHaveLength(300);
    expect(out.endsWith('…')).toBe(true);
    expect(pdfText('a'.repeat(300))).toHaveLength(300);
    expect(pdfText('a'.repeat(300)).endsWith('…')).toBe(false);
  });
});

describe('renderTablePdf', () => {
  const columns = [
    { header: 'Nombre', weight: 2 },
    { header: 'Total', weight: 1, align: 'right' as const },
  ];

  it('devuelve un Buffer PDF', async () => {
    const pdf = await renderTablePdf({
      title: 'Clientes',
      subtitle: 'Generado hoy',
      columns,
      rows: [['Ana Peña 😀', '$ 10']],
      emptyMessage: 'Nada',
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.subarray(-10).toString('latin1')).toContain('%%EOF');
  });

  it('sin filas igual genera un PDF válido', async () => {
    const pdf = await renderTablePdf({
      title: 'Vacío',
      subtitle: '',
      columns,
      rows: [],
      emptyMessage: 'No hay datos',
    });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('con muchas filas pagina (más de una página)', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => [`Cliente ${i}`, String(i)]);
    const pdf = await renderTablePdf({
      title: 'Muchos',
      subtitle: 's',
      columns,
      rows,
      emptyMessage: '',
    });
    const text = pdf.toString('latin1');
    const pages = text.match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(1);
  });
});
