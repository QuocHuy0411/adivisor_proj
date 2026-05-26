/**
 * Represents a clean Advisor (CVHT) entity.
 */
export class AdvisorEntity {
  /**
   * @param {Object} data 
   * @param {string} data.ma_co_van
   * @param {string} [data.ma_tai_khoan]
   * @param {string} data.ma_khoa
   * @param {string} data.ho_va_ten
   * @param {string} data.so_dien_thoai
   * @param {number} data.uu_tien
   * @param {string} data.chuyen_nganh
   * @param {string} [data.email]
   * @param {string} [data.ten_khoa]
   */
  constructor({ ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh, email, ten_khoa }) {
    this.ma_co_van = ma_co_van;
    this.ma_tai_khoan = ma_tai_khoan || null;
    this.ma_khoa = ma_khoa;
    this.ho_va_ten = ho_va_ten;
    this.so_dien_thoai = so_dien_thoai;
    this.uu_tien = Number(uu_tien);
    this.chuyen_nganh = chuyen_nganh;
    this.email = email || null;
    this.ten_khoa = ten_khoa || null;
  }

  toJSON() {
    return {
      ma_co_van: this.ma_co_van,
      ma_tai_khoan: this.ma_tai_khoan,
      ma_khoa: this.ma_khoa,
      ho_va_ten: this.ho_va_ten,
      so_dien_thoai: this.so_dien_thoai,
      uu_tien: this.uu_tien,
      chuyen_nganh: this.chuyen_nganh,
      email: this.email,
      ten_khoa: this.ten_khoa
    };
  }
}
