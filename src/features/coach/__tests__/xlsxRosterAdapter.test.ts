import * as XLSX from 'xlsx';
import {parseXlsxWorkbook} from '../xlsxRosterAdapter';

describe('real SheetJS integration with synthetic in-memory workbook', () => {
  it('decodes a real generated XLSX workbook into clean course tables', async () => {
    const wsData = [
      ['Código', 'Alumno', 'Contacto'],
      ['P01', 'Lía Ejemplo', 'privado@test.local'],
      ['P02', 'Teo Ejemplo', 'privado@test.local'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    // Excel sheet names strictly disallow colons: 'Lunes 17-00'
    XLSX.utils.book_append_sheet(wb, ws, 'Lunes 17-00');

    const u8 = XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'}) as Uint8Array;
    const tables = await parseXlsxWorkbook(u8);

    expect(tables).toHaveLength(1);
    expect(tables[0].title).toBe('Lunes 17-00');
    expect(tables[0].format).toBe('xlsx');
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[1][0]).toEqual({text: 'P01', kind: 'text'});
    expect(tables[0].rows[1][1]).toEqual({text: 'Lía Ejemplo', kind: 'text'});
  });

  it('rejects invalid or corrupted binaries safely', async () => {
    const corrupt = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(parseXlsxWorkbook(corrupt)).rejects.toThrow();
  });
});
