import { query } from '../../../config/db.js';
import { AccountEntity } from '../entities/account.entity.js';

/**
 * Data access operations for TAI_KHOAN, NHAN_VIEN_CTSV, and TRUONG_KHOA tables.
 */
export class AccountRepository {
  /**
   * List all accounts in the system.
   * @async
   * @returns {Promise<Array<AccountEntity>>}
   */
  async listAccounts() {
    const rows = await query(
      `SELECT ma_tai_khoan, ten_tai_khoan, email, loai_tai_khoan, da_doi_mk, is_active
       FROM TAI_KHOAN
       ORDER BY is_active DESC, ten_tai_khoan ASC`
    );
    return rows.map(r => new AccountEntity(r));
  }

  /**
   * Get an account profile by ID.
   * @async
   * @param {string} ma_tai_khoan 
   * @returns {Promise<AccountEntity|null>}
   */
  async findById(ma_tai_khoan) {
    const rows = await query(
      'SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :ma_tai_khoan',
      { ma_tai_khoan }
    );
    return rows[0] ? new AccountEntity(rows[0]) : null;
  }

  /**
   * Find any account with matching username or email.
   * @async
   * @param {Object} connection 
   * @param {string} ten_tai_khoan 
   * @param {string} email 
   * @returns {Promise<Object|null>}
   */
  async findDuplicateAccount(connection, ten_tai_khoan, email) {
    const [rows] = await connection.execute(
      `SELECT ten_tai_khoan, email, loai_tai_khoan
       FROM TAI_KHOAN
       WHERE ten_tai_khoan = ? OR email = ?
       LIMIT 1`,
      [ten_tai_khoan, email]
    );
    return rows[0] || null;
  }

  /**
   * Find duplicate email ignoring the current account.
   * @async
   * @param {Object} connection 
   * @param {string} email 
   * @param {string} ma_tai_khoan 
   * @returns {Promise<boolean>} True if another account is already using it.
   */
  async hasEmailDuplicate(connection, email, ma_tai_khoan) {
    const [rows] = await connection.execute(
      'SELECT ma_tai_khoan FROM TAI_KHOAN WHERE email = ? AND ma_tai_khoan <> ? LIMIT 1',
      [email, ma_tai_khoan]
    );
    return Boolean(rows[0]);
  }

  /**
   * Insert new credentials account.
   * @async
   * @param {Object} connection 
   * @param {Object} accountData 
   * @returns {Promise<void>}
   */
  async createAccount(connection, { ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan }) {
    await connection.execute(
      `INSERT INTO TAI_KHOAN
       (ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan, da_doi_mk, is_active)
       VALUES (?, ?, ?, ?, ?, false, true)`,
      [ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan]
    );
  }

  /**
   * Update credentials email.
   * @async
   * @param {Object} connection 
   * @param {string} ma_tai_khoan 
   * @param {string} email 
   */
  async updateEmail(connection, ma_tai_khoan, email) {
    await connection.execute(
      'UPDATE TAI_KHOAN SET email = ? WHERE ma_tai_khoan = ?',
      [email, ma_tai_khoan]
    );
  }

  /**
   * Update CTSV profile name.
   * @async
   * @param {Object} connection 
   * @param {string} ma_tai_khoan 
   * @param {string} ho_va_ten 
   */
  async updateCtsvProfile(connection, ma_tai_khoan, ho_va_ten) {
    await connection.execute(
      'UPDATE NHAN_VIEN_CTSV SET ho_va_ten = ? WHERE ma_tai_khoan = ?',
      [ho_va_ten, ma_tai_khoan]
    );
  }

  /**
   * Update Faculty Head profile name.
   * @async
   * @param {Object} connection 
   * @param {string} ma_tai_khoan 
   * @param {string} ho_va_ten 
   */
  async updateFacultyHeadProfile(connection, ma_tai_khoan, ho_va_ten) {
    await connection.execute(
      'UPDATE TRUONG_KHOA SET ho_va_ten = ? WHERE ma_tai_khoan = ?',
      [ho_va_ten, ma_tai_khoan]
    );
  }

  /**
   * Delete CTSV profile record.
   * @async
   * @param {Object} connection 
   * @param {string} ma_tai_khoan 
   */
  async deleteCtsvProfile(connection, ma_tai_khoan) {
    await connection.execute(
      'DELETE FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = ?',
      [ma_tai_khoan]
    );
  }

  /**
   * Delete Faculty Head profile record.
   * @async
   * @param {Object} connection 
   * @param {string} ma_tai_khoan 
   */
  async deleteFacultyHeadProfile(connection, ma_tai_khoan) {
    await connection.execute(
      'DELETE FROM TRUONG_KHOA WHERE ma_tai_khoan = ?',
      [ma_tai_khoan]
    );
  }

  /**
   * Delete credentials account record.
   * @async
   * @param {Object} connection 
   * @param {string} ma_tai_khoan 
   */
  async deleteAccount(connection, ma_tai_khoan) {
    await connection.execute(
      'DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?',
      [ma_tai_khoan]
    );
  }

  /**
   * Update active status of credentials.
   * @async
   * @param {string} ma_tai_khoan 
   * @param {boolean} is_active 
   * @returns {Promise<Object>} affectedRows details.
   */
  async updateStatus(ma_tai_khoan, is_active) {
    return query(
      'UPDATE TAI_KHOAN SET is_active = :is_active WHERE ma_tai_khoan = :ma_tai_khoan',
      { ma_tai_khoan, is_active }
    );
  }

  /**
   * Fetch internal employee accounts grouped by unit (CTSV or Faculty).
   * @async
   * @param {string} ma_don_vi 
   * @returns {Promise<Array>}
   */
  async listEmployeeGroupAccounts(ma_don_vi) {
    if (ma_don_vi === 'CTSV') {
      return query(
        `SELECT nv.ma_nhan_vien AS ma,
                nv.ho_va_ten,
                NULL AS so_dien_thoai,
                NULL AS chuyen_nganh,
                acc.email,
                acc.ten_tai_khoan,
                acc.loai_tai_khoan,
                'Nhan vien CTSV' AS vai_tro,
                acc.is_active,
                acc.ma_tai_khoan
         FROM NHAN_VIEN_CTSV nv
         JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = nv.ma_tai_khoan
         ORDER BY acc.is_active DESC, nv.ma_nhan_vien ASC`
      );
    }

    return query(
      `SELECT *
       FROM (
         SELECT tk.ma_nhan_vien AS ma,
                tk.ho_va_ten,
                NULL AS so_dien_thoai,
                NULL AS chuyen_nganh,
                acc.email,
                acc.ten_tai_khoan,
                acc.loai_tai_khoan,
                'Truong Khoa' AS vai_tro,
                acc.is_active,
                acc.ma_tai_khoan
         FROM TRUONG_KHOA tk
         JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
         WHERE tk.ma_khoa = :ma_don_vi
         UNION ALL
         SELECT cv.ma_co_van AS ma,
                cv.ho_va_ten,
                cv.so_dien_thoai,
                cv.chuyen_nganh,
                acc.email,
                acc.ten_tai_khoan,
                acc.loai_tai_khoan,
                'Co van hoc tap' AS vai_tro,
                acc.is_active,
                acc.ma_tai_khoan
         FROM CVHT cv
         JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
         WHERE cv.ma_khoa = :ma_don_vi
       ) employees
       ORDER BY
         CASE
           WHEN loai_tai_khoan = 'khoa' AND is_active = true THEN 0
           WHEN is_active = true THEN 1
           ELSE 2
         END,
         ma ASC`,
      { ma_don_vi }
    );
  }

  /**
   * Get employee staff of a specific faculty.
   * @async
   * @param {string} ma_khoa 
   * @returns {Promise<Array>}
   */
  async listFacultyEmployees(ma_khoa) {
    return query(
      `SELECT tk.ma_khoa,
              tk.ma_nhan_vien AS ma,
              tk.ho_va_ten,
              NULL AS chuyen_nganh,
              acc.email,
              acc.ten_tai_khoan,
              'Truong Khoa' AS vai_tro,
              acc.is_active,
              acc.ma_tai_khoan
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE tk.ma_khoa = :ma_khoa
       UNION ALL
       SELECT cv.ma_khoa,
              cv.ma_co_van AS ma,
              cv.ho_va_ten,
              cv.chuyen_nganh,
              acc.email,
              acc.ten_tai_khoan,
              'Co van hoc tap' AS vai_tro,
              COALESCE(acc.is_active, false) AS is_active,
              acc.ma_tai_khoan
       FROM CVHT cv
       LEFT JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
       WHERE cv.ma_khoa = :ma_khoa
       ORDER BY is_active DESC, ma ASC`,
      { ma_khoa }
    );
  }

  /**
   * Checks if Faculty Head already exists.
   * @async
   * @param {Object} connection 
   * @param {string} ma_nhan_vien 
   * @returns {Promise<boolean>}
   */
  async existsFacultyHeadByEmployeeId(connection, ma_nhan_vien) {
    const [rows] = await connection.execute(
      'SELECT ma_nhan_vien FROM TRUONG_KHOA WHERE ma_nhan_vien = ?',
      [ma_nhan_vien]
    );
    return Boolean(rows[0]);
  }

  /**
   * Create Faculty Head profile.
   * @async
   * @param {Object} connection 
   * @param {Object} profile 
   */
  async createFacultyHeadProfile(connection, { ma_nhan_vien, ma_tai_khoan, ma_khoa, ho_va_ten }) {
    await connection.execute(
      'INSERT INTO TRUONG_KHOA (ma_nhan_vien, ma_tai_khoan, ma_khoa, ho_va_ten) VALUES (?, ?, ?, ?)',
      [ma_nhan_vien, ma_tai_khoan, ma_khoa, ho_va_ten]
    );
  }
}
