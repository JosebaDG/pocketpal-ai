import {decodeXlsxTables} from '../SheetJsRosterDecoder';
import type {SheetJsReader} from '../SheetJsRosterDecoder';

const bytes = new Uint8Array([0x50, 0x4b, 3, 4]);
const workbook = () => ({SheetNames: ['Demo'], Sheets: {Demo: {
  '!ref': 'C3:D4', C3: {t: 's', v: 'Código'}, D3: {t: 's', v: 'Alumno'},
  C4: {t: 'n', v: 123, w: '00123'}, D4: {t: 's', v: 'Persona Demo', f: 'A1'},
}}});

// Reader mocks verify the bridge, not parsing of actual XLSX ZIP bytes.
describe('injected spreadsheet reader', () => {
  it('preserves coordinates, numeric identity and formula flags', () => {
    const read = jest.fn(() => workbook());
    const tables = decodeXlsxTables(bytes, {read});
    expect(tables[0].sourceFirstRow).toBe(2);
    expect(tables[0].sourceFirstColumn).toBe(2);
    expect(tables[0].rows[1][0]).toEqual({text: '00123', kind: 'number'});
    expect(tables[0].rows[1][1].kind).toBe('formula');
    expect(read).toHaveBeenCalledWith(bytes, expect.objectContaining({cellFormula: true, bookVBA: false}));
  });

  it('rejects invalid containers before invoking a reader', () => {
    const read = jest.fn(() => workbook());
    expect(() => decodeXlsxTables(new Uint8Array([1, 2]), {read})).toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects oversized sheet ranges', () => {
    const reader: SheetJsReader = {read: () => ({SheetNames: ['Demo'], Sheets: {Demo: {'!ref': 'A1:A10001'}}})};
    expect(() => decodeXlsxTables(bytes, reader)).toThrow('dimensions');
  });
});
