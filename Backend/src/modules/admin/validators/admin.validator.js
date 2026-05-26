import { AdminException } from '../exceptions/admin.exception.js';

/**
 * Validator helpers for sanitizing and validating payloads and CSV records
 * in the Admin module.
 */
export class AdminValidator {
  /**
   * Safely reads matching headers/keys from a CSV row.
   * @param {Object} row - Parsed CSV row.
   * @param {Array<string>} keys - Acceptable headers.
   * @returns {string} Cleaned value.
   */
  static valueOf(row, keys) {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  /**
   * Normalizes advisor priority between 1 and 3.
   * @param {any} input - Priority input (1, 2, or 3).
   * @returns {number} Normalized integer priority.
   */
  static normalizePriority(input) {
    const value = input === undefined || input === null || String(input).trim() === '' ? 2 : Number(input);
    if (!Number.isInteger(value) || value < 1 || value > 3) {
      AdminException.badRequest('Ưu tiên cố vấn học tập phải là số nguyên từ 1 đến 3');
    }
    return value;
  }

  /**
   * Validates structure of manual Advisor payload.
   * @param {Object} payload 
   */
  static validateAdvisorPayload(payload) {
    const required = ['ma_co_van', 'ho_va_ten', 'so_dien_thoai', 'ten_khoa', 'chuyen_nganh'];
    for (const field of required) {
      if (!payload[field]) {
        AdminException.badRequest(`Thiếu trường ${field}`);
      }
    }
  }

  /**
   * Validates standard employee profile updates.
   * @param {Object} payload 
   */
  static validateEmployeePayload(payload) {
    const ho_va_ten = String(payload.ho_va_ten || '').trim();
    const email = String(payload.email || '').trim();
    if (!ho_va_ten || !email) {
      AdminException.badRequest('Vui lòng nhập họ tên và email');
    }
    return { ho_va_ten, email };
  }
}
