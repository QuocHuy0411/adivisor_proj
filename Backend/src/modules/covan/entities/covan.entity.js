// Entity representation for an Advisor (COVAN)
export class CovanEntity {
  /**
   * @param {Object} data
   * @param {string} data.ma_co_van
   * @param {string} data.ten_co_van
   * @param {string} data.email
   * @param {string} data.so_dien_thoai
   * @param {string} data.chuyen_nganh
   * @param {number} data.uu_tien
   */
  constructor({ ma_co_van, ten_co_van, email, so_dien_thoai, chuyen_nganh, uu_tien }) {
    this.ma_co_van = ma_co_van;
    this.ten_co_van = ten_co_van;
    this.email = email;
    this.so_dien_thoai = so_dien_thoai;
    this.chuyen_nganh = chuyen_nganh;
    this.uu_tien = uu_tien;
  }

  toJSON() {
    return {
      ma_co_van: this.ma_co_van,
      ten_co_van: this.ten_co_van,
      email: this.email,
      so_dien_thoai: this.so_dien_thoai,
      chuyen_nganh: this.chuyen_nganh,
      uu_tien: this.uu_tien,
    };
  }
}
