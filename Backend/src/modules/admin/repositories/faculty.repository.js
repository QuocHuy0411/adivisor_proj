import { query } from '../../../config/db.js';
import { FacultyEntity } from '../entities/faculty.entity.js';

/**
 * Data access operations for KHOA (Faculty) table.
 */
export class FacultyRepository {
  /**
   * List all faculties, ordered by name.
   * @async
   * @returns {Promise<Array<FacultyEntity>>}
   */
  async listFaculties() {
    const rows = await query('SELECT ma_khoa, ten_khoa FROM KHOA ORDER BY ten_khoa');
    return rows.map(r => new FacultyEntity(r));
  }

  /**
   * Find a faculty by its name (case insensitive).
   * @async
   * @param {string} ten_khoa 
   * @returns {Promise<FacultyEntity|null>}
   */
  async findByName(ten_khoa) {
    const value = String(ten_khoa || '').trim();
    if (!value) return null;
    const rows = await query(
      'SELECT ma_khoa, ten_khoa FROM KHOA WHERE LOWER(ten_khoa) = LOWER(:value)',
      { value }
    );
    return rows[0] ? new FacultyEntity(rows[0]) : null;
  }

  /**
   * Find faculty inside an active transaction.
   * @async
   * @param {Object} connection 
   * @param {string} ten_khoa 
   * @returns {Promise<FacultyEntity|null>}
   */
  async findByNameWithConnection(connection, ten_khoa) {
    const value = String(ten_khoa || '').trim();
    if (!value) return null;
    const [rows] = await connection.execute(
      'SELECT ma_khoa, ten_khoa FROM KHOA WHERE LOWER(ten_khoa) = LOWER(?)',
      [value]
    );
    return rows[0] ? new FacultyEntity(rows[0]) : null;
  }
}
