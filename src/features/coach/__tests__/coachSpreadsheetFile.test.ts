import * as XLSX from 'xlsx';

import {
  MAX_SPREADSHEET_BYTES,
  readSpreadsheetTables,
} from '../coachSpreadsheetFile';
import type {PickedSpreadsheet} from '../coachSpreadsheetFile';

const workbookBytes = () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Código', 'Alumno'],
    ['P01', 'Persona Demo'],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Demo');
  return XLSX.write(book, {type: 'buffer', bookType: 'xlsx'}) as Uint8Array;
};
const access = (value: PickedSpreadsheet | null) => ({
  pickSpreadsheet: jest.fn(async () => value),
});

// Synthetic files only; the native picker is injected and not exercised here.
describe('spreadsheet file reading', () => {
  it('returns tables for review from a real generated workbook', async () => {
    const preview = await readSpreadsheetTables(
      access({name: 'listado-demo.xlsx', bytes: workbookBytes()}),
    );
    expect(preview?.fileName).toBe('listado-demo.xlsx');
    expect(preview?.tables[0].title).toBe('Demo');
    expect(preview?.tables[0].rows[1][1].text).toBe('Persona Demo');
  });

  it('returns null when the person cancels the picker', async () => {
    expect(await readSpreadsheetTables(access(null))).toBeNull();
  });

  it('rejects other formats instead of guessing', async () => {
    for (const name of ['a.xls', 'a.xlsm', 'a.docx', 'a.xlsx.exe', 'a']) {
      await expect(
        readSpreadsheetTables(access({name, bytes: workbookBytes()})),
      ).rejects.toThrow('Only .xlsx');
    }
  });

  it('rejects a renamed file that is not a workbook', async () => {
    await expect(
      readSpreadsheetTables(
        access({name: 'falso.xlsx', bytes: new Uint8Array([1, 2, 3, 4])}),
      ),
    ).rejects.toThrow();
  });

  it('rejects oversized files before parsing', async () => {
    await expect(
      readSpreadsheetTables(
        access({
          name: 'grande.xlsx',
          bytes: new Uint8Array(MAX_SPREADSHEET_BYTES + 1),
        }),
      ),
    ).rejects.toThrow('size limit');
  });
});
