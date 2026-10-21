import type {ImportTable} from './CoachTableImport';
import {parseXlsxWorkbook} from './xlsxRosterAdapter';

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

export type PickedSpreadsheet = {name: string; bytes: Uint8Array};
export type SpreadsheetPreview = {fileName: string; tables: ImportTable[]};

/** Injected so the picker and file system stay out of unit tests. */
export interface SpreadsheetFileAccess {
  /** Resolves null when the person cancels the system picker. */
  pickSpreadsheet(): Promise<PickedSpreadsheet | null>;
}

/**
 * Reads a workbook chosen by the person and returns its tables for review.
 * It never writes: persistence still requires the reviewed confirmation step.
 */
export async function readSpreadsheetTables(
  access: SpreadsheetFileAccess,
): Promise<SpreadsheetPreview | null> {
  const picked = await access.pickSpreadsheet();
  if (picked === null) {
    return null;
  }
  const fileName = picked.name.trim();
  if (!/\.xlsx$/i.test(fileName)) {
    throw new Error('Only .xlsx workbooks are supported');
  }
  if (picked.bytes.byteLength > MAX_SPREADSHEET_BYTES) {
    throw new Error('File exceeds size limit');
  }
  return {fileName, tables: parseXlsxWorkbook(picked.bytes)};
}
