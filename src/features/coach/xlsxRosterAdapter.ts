import * as XLSX from 'xlsx';
import type {ImportTable} from './CoachTableImport';
import {decodeXlsxTables} from './SheetJsRosterDecoder';

export function parseXlsxWorkbook(bytes: Uint8Array): ImportTable[] {
  return decodeXlsxTables(bytes, XLSX);
}
