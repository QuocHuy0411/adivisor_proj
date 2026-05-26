import { AuthValidator } from '../validators/auth.validator.js';

/**
 * DTO representing raw login credentials.
 */
export class LoginDto {
  /**
   * @param {Object} rawData 
   */
  constructor(rawData) {
    AuthValidator.validateLoginPayload(rawData);
    this.ten_tai_khoan = String(rawData.ten_tai_khoan).trim();
    this.mat_khau = String(rawData.mat_khau);
  }
}

/**
 * DTO representing standard password changes.
 */
export class ChangePasswordDto {
  /**
   * @param {Object} rawData 
   */
  constructor(rawData) {
    AuthValidator.validateChangePasswordPayload(rawData);
    this.mat_khau_cu = String(rawData.mat_khau_cu);
    this.mat_khau_moi = String(rawData.mat_khau_moi);
    this.nhap_lai_mat_khau_moi = String(rawData.nhap_lai_mat_khau_moi);
  }
}

/**
 * DTO representing password recovery updates.
 */
export class ResetPasswordDto {
  /**
   * @param {Object} rawData 
   */
  constructor(rawData) {
    AuthValidator.validateNewPassword(rawData);
    this.reset_token = String(rawData.reset_token || '').trim();
    this.mat_khau_moi = String(rawData.mat_khau_moi);
    this.nhap_lai_mat_khau_moi = String(rawData.nhap_lai_mat_khau_moi);
  }
}
