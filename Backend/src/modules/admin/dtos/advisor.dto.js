import { AdminValidator } from '../validators/admin.validator.js';

/**
 * Data Transfer Object for validating and cleaning Advisor (CVHT) creation/updating payloads.
 */
export class SaveAdvisorDto {
  /**
   * @param {Object} rawData 
   */
  constructor(rawData) {
    AdminValidator.validateAdvisorPayload(rawData);
    this.ma_co_van = String(rawData.ma_co_van).trim();
    this.ho_va_ten = String(rawData.ho_va_ten).trim();
    this.so_dien_thoai = String(rawData.so_dien_thoai).trim();
    this.ten_khoa = String(rawData.ten_khoa).trim();
    this.chuyen_nganh = String(rawData.chuyen_nganh).trim();
    this.uu_tien = AdminValidator.normalizePriority(rawData.uu_tien);
  }
}

/**
 * Data Transfer Object for validating and cleaning Advisor profile edits.
 */
export class UpdateAdvisorInfoDto {
  /**
   * @param {Object} rawData 
   */
  constructor(rawData) {
    this.ho_va_ten = String(rawData.ho_va_ten || '').trim();
    this.so_dien_thoai = String(rawData.so_dien_thoai || '').trim();
    this.ma_khoa = String(rawData.ma_khoa || '').trim();
    this.chuyen_nganh = String(rawData.chuyen_nganh || '').trim();

    if (!this.ho_va_ten || !this.so_dien_thoai || !this.ma_khoa || !this.chuyen_nganh) {
      throw new Error('Vui lòng nhập đầy đủ thông tin cố vấn học tập');
    }
  }
}
