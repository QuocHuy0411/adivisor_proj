/**
 * @file admin.interface.js
 * @description
 * Interface declarations using JSDoc. This file acts as a structural contract
 * defining the method signatures, parameters, and return types expected for
 * repositories and services in the Admin Module.
 */

/**
 * @interface IAccountRepository
 */
export const IAccountRepository = {
  /**
   * List all accounts in the system.
   * @async
   * @returns {Promise<Array>} List of accounts.
   */
  listAccounts: async () => {},

  /**
   * Find an account by its ID.
   * @async
   * @param {string} ma_tai_khoan
   * @returns {Promise<Object|null>} Account details or null.
   */
  findById: async (ma_tai_khoan) => {},

  /**
   * Check if a username or email is already taken.
   * @async
   * @param {Object} connection - Transaction connection (optional).
   * @param {string} ten_tai_khoan
   * @param {string} email
   * @returns {Promise<Object|null>} Match found or null.
   */
  findDuplicateAccount: async (connection, ten_tai_khoan, email) => {},

  /**
   * Create a new credentials account.
   * @async
   * @param {Object} connection
   * @param {Object} accountData
   * @returns {Promise<string>} Created account ID.
   */
  createAccount: async (connection, accountData) => {},

  /**
   * Update the email of a specified account.
   * @async
   * @param {Object} connection
   * @param {string} ma_tai_khoan
   * @param {string} email
   * @returns {Promise<void>}
   */
  updateEmail: async (connection, ma_tai_khoan, email) => {},

  /**
   * Delete credentials account by ID.
   * @async
   * @param {Object} connection
   * @param {string} ma_tai_khoan
   * @returns {Promise<void>}
   */
  deleteAccount: async (connection, ma_tai_khoan) => {},

  /**
   * Update internal CTSV staff profile.
   * @async
   * @param {Object} connection
   * @param {string} ma_tai_khoan
   * @param {string} ho_va_ten
   * @returns {Promise<void>}
   */
  updateCtsvProfile: async (connection, ma_tai_khoan, ho_va_ten) => {},

  /**
   * Update internal Faculty Head (TK) staff profile.
   * @async
   * @param {Object} connection
   * @param {string} ma_tai_khoan
   * @param {string} ho_va_ten
   * @returns {Promise<void>}
   */
  updateFacultyHeadProfile: async (connection, ma_tai_khoan, ho_va_ten) => {},

  /**
   * Delete internal CTSV staff profile.
   * @async
   * @param {Object} connection
   * @param {string} ma_tai_khoan
   * @returns {Promise<void>}
   */
  deleteCtsvProfile: async (connection, ma_tai_khoan) => {},

  /**
   * Delete internal Faculty Head profile.
   * @async
   * @param {Object} connection
   * @param {string} ma_tai_khoan
   * @returns {Promise<void>}
   */
  deleteFacultyHeadProfile: async (connection, ma_tai_khoan) => {},

  /**
   * Update active status of an account.
   * @async
   * @param {string} ma_tai_khoan
   * @param {boolean} is_active
   * @returns {Promise<number>} Number of affected rows.
   */
  updateStatus: async (ma_tai_khoan, is_active) => {},

  /**
   * Check if a Faculty Head profile already exists by employee ID.
   * @async
   * @param {Object} connection
   * @param {string} ma_nhan_vien
   * @returns {Promise<boolean>} True if exists.
   */
  existsFacultyHeadByEmployeeId: async (connection, ma_nhan_vien) => {},

  /**
   * Insert Faculty Head profile records.
   * @async
   * @param {Object} connection
   * @param {Object} data
   * @returns {Promise<void>}
   */
  createFacultyHeadProfile: async (connection, data) => {}
};

/**
 * @interface IAdvisorRepository
 */
export const IAdvisorRepository = {
  /**
   * Retrieve advisor profile list.
   * @async
   * @param {string} [ma_khoa] - Optional faculty filter.
   * @returns {Promise<Array>} List of advisors.
   */
  listAdvisorInfo: async (ma_khoa) => {},

  /**
   * Check if advisor profile exists by ID.
   * @async
   * @param {string} ma_co_van
   * @returns {Promise<Object|null>} Advisor profile or null.
   */
  findById: async (ma_co_van) => {},

  /**
   * Create general advisor profile.
   * @async
   * @param {Object} payload
   * @returns {Promise<void>}
   */
  createAdvisorInfo: async (payload) => {},

  /**
   * Update CVHT profile fields.
   * @async
   * @param {string} ma_co_van
   * @param {Object} fields
   * @returns {Promise<void>}
   */
  updateAdvisorInfo: async (ma_co_van, fields) => {},

  /**
   * Cascade-delete CVHT profile and associated account.
   * @async
   * @param {string} ma_co_van
   * @param {string|null} ma_tai_khoan
   * @returns {Promise<void>}
   */
  deleteAdvisorCascade: async (ma_co_van, ma_tai_khoan) => {},

  /**
   * Link account ID to an advisor profile in transactional connection.
   * @async
   * @param {Object} connection
   * @param {string} ma_co_van
   * @param {string} ma_tai_khoan
   * @returns {Promise<void>}
   */
  linkAccount: async (connection, ma_co_van, ma_tai_khoan) => {},

  /**
   * Create or update CVHT profile in transaction.
   * @async
   * @param {Object} connection
   * @param {Object} payload
   * @param {boolean} isExisting
   * @returns {Promise<void>}
   */
  saveAdvisorInTransaction: async (connection, payload, isExisting) => {}
};

/**
 * @interface IFacultyRepository
 */
export const IFacultyRepository = {
  /**
   * Get all faculties list.
   * @async
   * @returns {Promise<Array>} List of faculties.
   */
  listFaculties: async () => {},

  /**
   * Find a faculty by its name.
   * @async
   * @param {string} ten_khoa
   * @returns {Promise<Object|null>} Faculty details or null.
   */
  findByName: async (ten_khoa) => {},

  /**
   * Find a faculty by name inside an active transaction.
   * @async
   * @param {Object} connection
   * @param {string} ten_khoa
   * @returns {Promise<Object|null>} Faculty details or null.
   */
  findByNameWithConnection: async (connection, ten_khoa) => {}
};
