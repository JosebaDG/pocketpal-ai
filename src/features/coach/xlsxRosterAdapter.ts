import type {ImportTable} from './CoachTableImport';
import {decodeXlsxTables} from './SheetJsRosterDecoder';

export async function parseXlsxWorkbook(bytes: Uint8Array): Promise<ImportTable[]> {
  const XLSX = await import('xlsx');
  return decodeXlsxTables(bytes, XLSX);
}
