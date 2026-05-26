import { query } from '../../../config/db.js';

/**
 * Data access operations for active Refresh Tokens table.
 */
export class SessionRepository {
  /**
   * Ensure refresh token session storage table exists.
   * @async
   */
  async ensureRefreshTokensTable() {
    await query(
      `CREATE TABLE IF NOT EXISTS REFRESH_TOKENS (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_tai_khoan VARCHAR(100) NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan) ON DELETE CASCADE
      )`
    );
  }

  /**
   * Save a newly generated refresh token.
   * @async
   * @param {string} ma_tai_khoan 
   * @param {string} token 
   */
  async saveRefreshToken(ma_tai_khoan, token) {
    await this.ensureRefreshTokensTable();
    await query(
      'INSERT INTO REFRESH_TOKENS (ma_tai_khoan, token, expires_at) VALUES (:ma_tai_khoan, :token, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      { ma_tai_khoan, token }
    );
  }

  /**
   * Fetch active refresh token if unexpired.
   * @async
   * @param {string} token 
   * @returns {Promise<Object|null>}
   */
  async findActiveRefreshToken(token) {
    await this.ensureRefreshTokensTable();
    const rows = await query(
      'SELECT * FROM REFRESH_TOKENS WHERE token = :token AND expires_at > NOW()',
      { token }
    );
    return rows[0] || null;
  }

  /**
   * Remove specified refresh token session.
   * @async
   * @param {string} token 
   */
  async deleteRefreshToken(token) {
    await this.ensureRefreshTokensTable();
    await query(
      'DELETE FROM REFRESH_TOKENS WHERE token = :token',
      { token }
    );
  }
}
