import { query } from '../../../config/db.js';

/**
 * Data access operations for accounts failed logins, recovery, and role-based profiles.
 */
export class AuthRepository {
  /**
   * Ensure failed attempt limit table exists.
   * @async
   */
  async ensureLoginAttemptTable() {
    await query(
      `CREATE TABLE IF NOT EXISTS DANG_NHAP_THAT_BAI (
        ten_tai_khoan VARCHAR(100) NOT NULL,
        ngay DATE NOT NULL,
        so_lan INT NOT NULL DEFAULT 0,
        PRIMARY KEY (ten_tai_khoan, ngay)
      )`
    );
  }

  /**
   * Get login failures count for username today.
   * @async
   * @param {string} ten_tai_khoan 
   * @returns {Promise<number>}
   */
  async countLoginFailuresToday(ten_tai_khoan) {
    await this.ensureLoginAttemptTable();
    const rows = await query(
      'SELECT so_lan FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = :ten_tai_khoan AND ngay = CURDATE()',
      { ten_tai_khoan }
    );
    return Number(rows[0]?.so_lan || 0);
  }

  /**
   * Record a new login failure for username.
   * @async
   * @param {string} ten_tai_khoan 
   * @returns {Promise<number>} Updated failure count.
   */
  async recordLoginFailure(ten_tai_khoan) {
    await this.ensureLoginAttemptTable();
    await query(
      `INSERT INTO DANG_NHAP_THAT_BAI (ten_tai_khoan, ngay, so_lan)
       VALUES (:ten_tai_khoan, CURDATE(), 1)
       ON DUPLICATE KEY UPDATE so_lan = so_lan + 1`,
      { ten_tai_khoan }
    );
    return this.countLoginFailuresToday(ten_tai_khoan);
  }

  /**
   * Wipe failure logs for username today.
   * @async
   * @param {string} ten_tai_khoan 
   */
  async clearLoginFailures(ten_tai_khoan) {
    await this.ensureLoginAttemptTable();
    await query(
      'DELETE FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = :ten_tai_khoan AND ngay = CURDATE()',
      { ten_tai_khoan }
    );
  }

  /**
   * Find credentials account by username.
   * @async
   * @param {string} ten_tai_khoan 
   * @returns {Promise<Object|null>}
   */
  async findByUsername(ten_tai_khoan) {
    const rows = await query(
      'SELECT * FROM TAI_KHOAN WHERE ten_tai_khoan = :ten_tai_khoan',
      { ten_tai_khoan }
    );
    return rows[0] || null;
  }

  /**
   * Find credentials account by ID.
   * @async
   * @param {string} ma_tai_khoan 
   * @returns {Promise<Object|null>}
   */
  async findById(ma_tai_khoan) {
    const rows = await query(
      'SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id',
      { id: ma_tai_khoan }
    );
    return rows[0] || null;
  }

  /**
   * Find credentials account by email.
   * @async
   * @param {string} email 
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const rows = await query(
      'SELECT * FROM TAI_KHOAN WHERE email = :email',
      { email }
    );
    return rows[0] || null;
  }

  /**
   * Update credentials password.
   * @async
   * @param {string} ma_tai_khoan 
   * @param {string} hashedPassword 
   */
  async updatePassword(ma_tai_khoan, hashedPassword) {
    await query(
      'UPDATE TAI_KHOAN SET mat_khau = :hashed, da_doi_mk = true WHERE ma_tai_khoan = :id',
      { hashed: hashedPassword, id: ma_tai_khoan }
    );
  }

  /**
   * Load the role profile linked to the credentials.
   * @async
   * @param {Object} account 
   * @returns {Promise<Object>}
   */
  async loadProfile(account) {
    let rows;
    if (account.loai_tai_khoan === 'admin') {
      rows = await query('SELECT ma_admin, ho_va_ten FROM QUAN_TRI_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
      return rows[0] || {};
    }
    if (account.loai_tai_khoan === 'ctsv') {
      rows = await query('SELECT ma_nhan_vien, ho_va_ten FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
      return rows[0] || {};
    }
    if (account.loai_tai_khoan === 'khoa') {
      rows = await query('SELECT ma_nhan_vien, ma_khoa, ho_va_ten FROM TRUONG_KHOA WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
      return rows[0] || {};
    }
    if (account.loai_tai_khoan === 'covan') {
      rows = await query('SELECT ma_co_van, ma_khoa, ho_va_ten FROM CVHT WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
      return rows[0] || {};
    }
    if (account.loai_tai_khoan === 'sinhvien') {
      rows = await query('SELECT ma_sinh_vien, ma_lop, ho_va_ten FROM SINH_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
      return rows[0] || {};
    }
    return {};
  }
}
