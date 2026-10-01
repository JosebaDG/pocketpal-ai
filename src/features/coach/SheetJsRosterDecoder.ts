import type {ImportCell, ImportTable} from './CoachTableImport';

type SheetCell = {
  t?: string;
  v?: string | number | boolean;
  w?: string;
  f?: string;
};
type Worksheet = Record<string, SheetCell | string | undefined>;
export interface SheetJsReader {
  read(
    data: Uint8Array,
    options: {
      type: 'array';
      cellFormula: boolean;
      cellDates: boolean;
      cellHTML: boolean;
      cellStyles: boolean;
      bookVBA: boolean;
      dense: boolean;
    },
  ): {
    SheetNames: string[];
    Sheets: Record<string, Worksheet>;
  };
}

function coordinate(address: string) {
  const match = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/.exec(address);
  if (!match) {
    throw new Error('Invalid spreadsheet range');
  }
  let column = 0;
  for (const char of match[1]) {
    column = column * 26 + char.charCodeAt(0) - 64;
  }
  const row = Number(match[2]) - 1;
  if (column > 16384 || row > 1048575) {
    throw new Error('Spreadsheet range out of bounds');
  }
  return {row, column: column - 1};
}

function address(row: number, column: number) {
  let value = column + 1;
  let letters = '';
  while (value > 0) {
    value -= 1;
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26);
  }
  return `${letters}${row + 1}`;
}

function cell(value: SheetCell | string | undefined): ImportCell {
  if (value === undefined) {
    return {text: '', kind: 'text'};
  }
  if (typeof value !== 'object') {
    throw new Error('Invalid spreadsheet cell');
  }
  const text = value.w ?? String(value.v ?? '');
  if (text.length > 2000) {
    throw new Error('Spreadsheet cell exceeds size limit');
  }
  if (value.f !== undefined) {
    return {text, kind: 'formula'};
  }
  return {
    text,
    kind:
      value.t === 'n'
        ? 'number'
        : value.t === 's' ||
            value.t === 'str' ||
            value.t === 'z' ||
            value.v === undefined
          ? 'text'
          : 'unsupported',
  };
}

/** Inject a bundled reader; this module does not download or import SheetJS. */
export function decodeXlsxTables(
  bytes: Uint8Array,
  reader: SheetJsReader,
): ImportTable[] {
  if (
    bytes.byteLength > 10 * 1024 * 1024 ||
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  ) {
    throw new Error('Expected a bounded XLSX ZIP container');
  }
  const workbook = reader.read(bytes, {
    type: 'array',
    cellFormula: true,
    cellDates: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
    dense: false,
  });
  if (
    workbook.SheetNames.length === 0 ||
    workbook.SheetNames.length > 20 ||
    new Set(workbook.SheetNames).size !== workbook.SheetNames.length
  ) {
    throw new Error('Invalid workbook sheet count');
  }
  let totalCells = 0;
  return workbook.SheetNames.map((title, index) => {
    const sheet = workbook.Sheets[title];
    if (!sheet || title.length > 200) {
      throw new Error('Invalid workbook sheet');
    }
    const table: ImportTable = {
      id: `sheet-${index}`,
      title,
      format: 'xlsx',
      sourceFirstRow: 0,
      sourceFirstColumn: 0,
      rows: [],
    };
    const ref = sheet['!ref'];
    if (ref === undefined) {
      return table;
    }
    if (typeof ref !== 'string') {
      throw new Error('Invalid spreadsheet range');
    }
    const range = ref.split(':');
    if (range.length > 2) {
      throw new Error('Invalid spreadsheet range');
    }
    const first = coordinate(range[0]);
    const last = coordinate(range[1] ?? range[0]);
    const height = last.row - first.row + 1;
    const width = last.column - first.column + 1;
    totalCells += height * width;
    if (
      height < 1 ||
      width < 1 ||
      height > 10000 ||
      width > 100 ||
      totalCells > 100000
    ) {
      throw new Error('Spreadsheet dimensions exceed import limit');
    }
    table.sourceFirstRow = first.row;
    table.sourceFirstColumn = first.column;
    for (let row = first.row; row <= last.row; row += 1) {
      const cells: ImportCell[] = [];
      for (let column = first.column; column <= last.column; column += 1) {
        cells.push(cell(sheet[address(row, column)]));
      }
      table.rows.push(cells);
    }
    return table;
  });
}
