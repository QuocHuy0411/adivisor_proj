import { AuthException } from '../exceptions/auth.exception.js';

/**
 * Validator helpers for sanitizing and validating payloads in the Auth module.
 */
export class AuthValidator {
  /**
   * Validates standard login credentials structure.
   * @param {Object} payload 
   */
  static validateLoginPayload(payload) {
    if (!payload.ten_tai_khoan || !payload.mat_khau) {
      AuthException.badRequest('Vui lòng nhập tên tài khoản và mật khẩu');
    }
  }

  /**
   * Validates standard password changes payload.
   * @param {Object} payload 
   */
  static validateChangePasswordPayload(payload) {
    if (!payload.mat_khau_cu || !payload.mat_khau_moi) {
      AuthException.badRequest('Vui lòng nhập đầy đủ thông tin');
    }
    if (payload.mat_khau_moi !== payload.nhap_lai_mat_khau_moi) {
      AuthException.badRequest('Mật khẩu mới không khớp');
    }
    if (String(payload.mat_khau_moi).length < 6) {
      AuthException.badRequest('Mật khẩu mới cần tối thiểu 6 ký tự');
    }
  }

  /**
   * Validates recovery reset passwords.
   * @param {Object} payload 
   */
  static validateNewPassword(payload) {
    if (!payload.mat_khau_moi || !payload.nhap_lai_mat_khau_moi) {
      AuthException.badRequest('Vui lòng nhập đầy đủ mật khẩu mới');
    }
    if (payload.mat_khau_moi !== payload.nhap_lai_mat_khau_moi) {
      AuthException.badRequest('Mật khẩu mới không khớp');
    }
    if (String(payload.mat_khau_moi).length < 6) {
      AuthException.badRequest('Mật khẩu mới cần tối thiểu 6 ký tự');
    }
  }
}
