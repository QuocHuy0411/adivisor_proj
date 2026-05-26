/**
 * @file auth.interface.js
 * @description
 * Interface declarations using JSDoc. This file acts as a structural contract
 * defining the method signatures, parameters, and return types expected for
 * repositories and services in the Auth Module.
 */

/**
 * @interface IAuthRepository
 */
export const IAuthRepository = {
  /**
   * Ensure the failed login attempts table exists.
   * @async
   * @returns {Promise<void>}
   */
  ensureLoginAttemptTable: async () => {},

  /**
   * Count login failures for a specific username today.
   * @async
   * @param {string} ten_tai_khoan
   * @returns {Promise<number>} Number of failed attempts.
   */
  countLoginFailuresToday: async (ten_tai_khoan) => {},

  /**
   * Record a new login failure for a username today.
   * @async
   * @param {string} ten_tai_khoan
   * @returns {Promise<void>}
   */
  recordLoginFailure: async (ten_tai_khoan) => {},

  /**
   * Clear all recorded failed logins for a username today.
   * @async
   * @param {string} ten_tai_khoan
   * @returns {Promise<void>}
   */
  clearLoginFailures: async (ten_tai_khoan) => {},

  /**
   * Find account by username.
   * @async
   * @param {string} ten_tai_khoan
   * @returns {Promise<Object|null>} Account profile or null.
   */
  findByUsername: async (ten_tai_khoan) => {},

  /**
   * Find account by ID.
   * @async
   * @param {string} ma_tai_khoan
   * @returns {Promise<Object|null>} Account profile or null.
   */
  findById: async (ma_tai_khoan) => {},

  /**
   * Find account by Email.
   * @async
   * @param {string} email
   * @returns {Promise<Object|null>} Account profile or null.
   */
  findByEmail: async (email) => {},

  /**
   * Update password and da_doi_mk flag.
   * @async
   * @param {string} ma_tai_khoan
   * @param {string} hashedPassword
   * @returns {Promise<void>}
   */
  updatePassword: async (ma_tai_khoan, hashedPassword) => {},

  /**
   * Load profile of role-based entity associated with the account.
   * @async
   * @param {Object} account
   * @returns {Promise<Object>} Role-based profile data.
   */
  loadProfile: async (account) => {}
};

/**
 * @interface ISessionRepository
 */
export const ISessionRepository = {
  /**
   * Ensure the refresh tokens table exists.
   * @async
   * @returns {Promise<void>}
   */
  ensureRefreshTokensTable: async () => {},

  /**
   * Insert a new refresh token session.
   * @async
   * @param {string} ma_tai_khoan
   * @param {string} token
   * @returns {Promise<void>}
   */
  saveRefreshToken: async (ma_tai_khoan, token) => {},

  /**
   * Get an active refresh token session.
   * @async
   * @param {string} token
   * @returns {Promise<Object|null>} Refresh token details or null.
   */
  findActiveRefreshToken: async (token) => {},

  /**
   * Delete specific refresh token.
   * @async
   * @param {string} token
   * @returns {Promise<void>}
   */
  deleteRefreshToken: async (token) => {}
};
