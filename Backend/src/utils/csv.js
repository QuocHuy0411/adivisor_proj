import { parse } from 'csv-parse/sync';
import { badRequest } from './httpError.js';

export function parseCsv(buffer) {
  try {
    return parse(buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });
  } catch {
    throw badRequest('File CSV không đúng định dạng. Vui lòng kiểm tra dòng tiêu đề và dấu phẩy phân tách cột.');
  }
}
