import { query } from '../../../config/db.js';
import { AdvisorEntity } from '../entities/advisor.entity.js';

/**
 * Data access operations for CVHT (Advisor) table.
 */
export class AdvisorRepository {
  /**
   * List all advisors, optionally filtered by faculty code.
   * @async
   * @param {string} [ma_khoa] 
   * @returns {Promise<Array<AdvisorEntity>>}
   */
  async listAdvisorInfo(ma_khoa) {
    const filter = ma_khoa ? 'WHERE cv.ma_khoa = :ma_khoa' : '';
    const rows = await query(
      `SELECT cv.ma_co_van,
              cv.ho_va_ten,
              acc.email,
              cv.so_dien_thoai,
              cv.chuyen_nganh,
              cv.uu_tien,
              cv.ma_khoa,
              k.ten_khoa
       FROM CVHT cv
       JOIN KHOA k ON k.ma_khoa = cv.ma_khoa
       LEFT JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
       ${filter}
       ORDER BY COALESCE(acc.is_active, false) DESC, cv.ma_co_van ASC`,
      { ma_khoa }
    );
    return rows.map(r => new AdvisorEntity(r));
  }

  /**
   * Find an advisor by their ID.
   * @async
   * @param {string} ma_co_van 
   * @returns {Promise<AdvisorEntity|null>}
   */
  async findById(ma_co_van) {
    const rows = await query('SELECT * FROM CVHT WHERE ma_co_van = :ma_co_van', { ma_co_van });
    return rows[0] ? new AdvisorEntity(rows[0]) : null;
  }

  /**
   * Find an advisor by ID inside an active transaction.
   * @async
   * @param {Object} connection 
   * @param {string} ma_co_van 
   * @returns {Promise<AdvisorEntity|null>}
   */
  async findByIdWithConnection(connection, ma_co_van) {
    const [rows] = await connection.execute('SELECT * FROM CVHT WHERE ma_co_van = ?', [ma_co_van]);
    return rows[0] ? new AdvisorEntity(rows[0]) : null;
  }

  /**
   * Manually create advisor profile with no credentials link.
   * @async
   * @param {Object} advisorData 
   * @returns {Promise<void>}
   */
  async createAdvisorInfo({ ma_co_van, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh }) {
    await query(
      `INSERT INTO CVHT
       (ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh)
       VALUES (:ma_co_van, NULL, :ma_khoa, :ho_va_ten, :so_dien_thoai, :uu_tien, :chuyen_nganh)`,
      { ma_co_van, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh }
    );
  }

  /**
   * Update advisor profile fields.
   * @async
   * @param {string} ma_co_van 
   * @param {Object} fields 
   */
  async updateAdvisorInfo(ma_co_van, { ho_va_ten, so_dien_thoai, ma_khoa, chuyen_nganh }) {
    await query(
      `UPDATE CVHT
       SET ho_va_ten = :ho_va_ten,
           so_dien_thoai = :so_dien_thoai,
           ma_khoa = :ma_khoa,
           chuyen_nganh = :chuyen_nganh
       WHERE ma_co_van = :ma_co_van`,
      { ho_va_ten, so_dien_thoai, ma_khoa, chuyen_nganh, ma_co_van }
    );
  }

  /**
   * Cascading delete of advisor profile, links, and credentials account.
   * @async
   * @param {Object} connection 
   * @param {string} ma_co_van 
   * @param {string|null} ma_tai_khoan 
   */
  async deleteAdvisorCascade(connection, ma_co_van, ma_tai_khoan) {
    await connection.execute('DELETE FROM YEU_CAU_THAY_THE WHERE ma_co_van = ?', [ma_co_van]);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = NULL WHERE ma_co_van = ?', [ma_co_van]);
    await connection.execute('UPDATE LOP SET ma_co_van = NULL WHERE ma_co_van = ?', [ma_co_van]);
    if (ma_tai_khoan) {
      await connection.execute('UPDATE CVHT SET ma_tai_khoan = NULL WHERE ma_co_van = ?', [ma_co_van]);
      await connection.execute('DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?', [ma_tai_khoan]);
    }
    await connection.execute('DELETE FROM CVHT WHERE ma_co_van = ?', [ma_co_van]);
  }

  /**
   * Link account ID to an advisor profile.
   * @async
   * @param {Object} connection 
   * @param {string} ma_co_van 
   * @param {string} ma_tai_khoan 
   */
  async linkAccount(connection, ma_co_van, ma_tai_khoan) {
    await connection.execute('UPDATE CVHT SET ma_tai_khoan = ? WHERE ma_co_van = ?', [ma_tai_khoan, ma_co_van]);
  }

  /**
   * Save advisor info inside a transaction (insert or update).
   * @async
   * @param {Object} connection 
   * @param {Object} data 
   * @param {boolean} isExisting 
   */
  async saveAdvisorInTransaction(connection, { ma_co_van, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh }, isExisting) {
    if (isExisting) {
      await connection.execute(
        `UPDATE CVHT
         SET ma_khoa = ?, ho_va_ten = ?, so_dien_thoai = ?, uu_tien = ?, chuyen_nganh = ?
         WHERE ma_co_van = ?`,
        [ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh, ma_co_van]
      );
    } else {
      await connection.execute(
        `INSERT INTO CVHT
         (ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`,
        [ma_co_van, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh]
      );
    }
  }
}
