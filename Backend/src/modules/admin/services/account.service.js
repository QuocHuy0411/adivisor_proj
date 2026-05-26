import { AdminException } from '../exceptions/admin.exception.js';

/**
 * Service managing user credentials accounts (TAI_KHOAN).
 */
export class AccountService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/account.repository.js').AccountRepository} dependencies.accountRepository
   */
  constructor({ accountRepository }) {
    this.accountRepository = accountRepository;
  }

  /**
   * List all accounts in the database.
   * @async
   * @returns {Promise<Array>}
   */
  async listAccounts() {
    return this.accountRepository.listAccounts();
  }

  /**
   * Update active status of an account, guarding admin and self locks.
   * @async
   * @param {Object} currentUser 
   * @param {string} ma_tai_khoan 
   * @param {boolean} is_active 
   * @returns {Promise<Object>} Status message.
   */
  async updateAccountStatus(currentUser, ma_tai_khoan, is_active) {
    const account = await this.accountRepository.findById(ma_tai_khoan);
    if (!account) {
      AdminException.notFound('Không tìm thấy tài khoản');
    }
    if (account.loai_tai_khoan === 'admin') {
      AdminException.forbidden('Admin không thể khóa tài khoản Admin');
    }
    if (currentUser.ma_tai_khoan === ma_tai_khoan) {
      AdminException.forbidden('Không thể tự khóa tài khoản đang đăng nhập');
    }

    const result = await this.accountRepository.updateStatus(ma_tai_khoan, Boolean(is_active));
    if (!result.affectedRows) {
      AdminException.notFound('Không tìm thấy tài khoản');
    }

    return { message: 'Cập nhật trạng thái tài khoản thành công' };
  }
}
