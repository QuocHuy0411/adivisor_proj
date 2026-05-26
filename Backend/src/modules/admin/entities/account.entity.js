/**
 * Represents a clean User Account entity.
 */
export class AccountEntity {
  /**
   * @param {Object} data 
   * @param {string} data.ma_tai_khoan
   * @param {string} data.ten_tai_khoan
   * @param {string} data.email
   * @param {string} data.loai_tai_khoan
   * @param {boolean} data.da_doi_mk
   * @param {boolean} data.is_active
   */
  constructor({ ma_tai_khoan, ten_tai_khoan, email, loai_tai_khoan, da_doi_mk, is_active }) {
    this.ma_tai_khoan = ma_tai_khoan;
    this.ten_tai_khoan = ten_tai_khoan;
    this.email = email;
    this.loai_tai_khoan = loai_tai_khoan;
    this.da_doi_mk = Boolean(da_doi_mk);
    this.is_active = Boolean(is_active);
  }

  /**
   * Format entity to JSON safe.
   */
  toJSON() {
    return {
      ma_tai_khoan: this.ma_tai_khoan,
      ten_tai_khoan: this.ten_tai_khoan,
      email: this.email,
      loai_tai_khoan: this.loai_tai_khoan,
      da_doi_mk: this.da_doi_mk,
      is_active: this.is_active
    };
  }
}
