/**
 * Represents a clean Faculty (KHOA) entity.
 */
export class FacultyEntity {
  /**
   * @param {Object} data 
   * @param {string} data.ma_khoa
   * @param {string} data.ten_khoa
   */
  constructor({ ma_khoa, ten_khoa }) {
    this.ma_khoa = ma_khoa;
    this.ten_khoa = ten_khoa;
  }

  toJSON() {
    return {
      ma_khoa: this.ma_khoa,
      ten_khoa: this.ten_khoa
    };
  }
}
