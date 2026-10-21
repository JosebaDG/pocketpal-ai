import {Platform} from 'react-native';

import {base64ToBytes} from './base64Bytes';
import {MAX_SPREADSHEET_BYTES} from './coachSpreadsheetFile';
import type {SpreadsheetFileAccess} from './coachSpreadsheetFile';

const XLSX_UTI = 'org.openxmlformats.spreadsheetml.sheet';

/**
 * Device implementation. Modules load lazily so registering the feature does not
 * pull native modules into tests. NOT verified on a device yet: the picker result
 * shape, iOS UTI filtering and Android providers need a physical check.
 */
export const nativeSpreadsheetFileAccess: SpreadsheetFileAccess = {
  async pickSpreadsheet() {
    const [{pick, types}, RNFS] = await Promise.all([
      import('@react-native-documents/picker'),
      import('@dr.pogodin/react-native-fs'),
    ]);
    let results;
    try {
      results = await pick({
        type: Platform.OS === 'ios' ? XLSX_UTI : [types.allFiles],
        allowMultiSelection: false,
      });
    } catch (error) {
      if ((error as {code?: string}).code === 'OPERATION_CANCELED') {
        return null;
      }
      throw error;
    }
    const file = results[0];
    if (!file) {
      return null;
    }
    if (typeof file.size === 'number' && file.size > MAX_SPREADSHEET_BYTES) {
      throw new Error('File exceeds size limit');
    }
    const base64 = await RNFS.readFile(file.uri, 'base64');
    return {
      name: file.name ?? '',
      bytes: base64ToBytes(base64, MAX_SPREADSHEET_BYTES),
    };
  },
};
