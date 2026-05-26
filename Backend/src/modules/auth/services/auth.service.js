import { verifyPassword, hashPassword } from '../../../utils/passwords.js';
import { AuthException } from '../exceptions/auth.exception.js';
import { LoginDto, ChangePasswordDto } from '../dtos/auth.dto.js';

/**
 * Service managing credentials, security lock checking, and password modifications.
 */
export class AuthService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/auth.repository.js').AuthRepository} dependencies.authRepository
   * @param {import('./session.service.js').SessionService} dependencies.sessionService
   */
  constructor({ authRepository, sessionService }) {
    this.authRepository = authRepository;
    this.sessionService = sessionService;
  }

  /**
   * Performs standard account login check with 5 times attempt limits.
   * @async
   * @param {Object} rawPayload 
   * @returns {Promise<import('../entities/session.entity.js').SessionEntity>} Active session.
   */
  async login(rawPayload) {
    const payload = new LoginDto(rawPayload);
    const failures = await this.authRepository.countLoginFailuresToday(payload.ten_tai_khoan);

    if (failures >= 5) {
      AuthException.tooManyRequests(
        'Tài khoản đã nhập sai mật khẩu 5 lần trong ngày. Vui lòng thử lại vào ngày mai.'
      );
    }

    const account = await this.authRepository.findByUsername(payload.ten_tai_khoan);
    if (!account) {
      const nextFailures = await this.authRepository.recordLoginFailure(payload.ten_tai_khoan);
      AuthException.unauthorized(
        `Sai tên tài khoản hoặc mật khẩu. Còn ${Math.max(0, 5 - nextFailures)} lần thử trong ngày.`
      );
    }

    if (!account.is_active) {
      AuthException.forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    const ok = await verifyPassword(payload.mat_khau, account.mat_khau);
    if (!ok) {
      const nextFailures = await this.authRepository.recordLoginFailure(payload.ten_tai_khoan);
      AuthException.unauthorized(
        `Sai tên tài khoản hoặc mật khẩu. Còn ${Math.max(0, 5 - nextFailures)} lần thử trong ngày.`
      );
    }

    await this.authRepository.clearLoginFailures(payload.ten_tai_khoan);
    return this.sessionService.buildSession(account);
  }

  /**
   * Modify existing credentials password inside authenticate wrapper.
   * @async
   * @param {Object} user 
   * @param {Object} rawPayload 
   * @returns {Promise<Object>} Status message.
   */
  async changePassword(user, rawPayload) {
    const payload = new ChangePasswordDto(rawPayload);

    const account = await this.authRepository.findById(user.ma_tai_khoan);
    if (!account) {
      AuthException.notFound('Không tìm thấy tài khoản');
    }

    const ok = await verifyPassword(payload.mat_khau_cu, account.mat_khau);
    if (!ok) {
      AuthException.badRequest('Mật khẩu cũ không đúng');
    }

    const hashed = await hashPassword(payload.mat_khau_moi);
    await this.authRepository.updatePassword(user.ma_tai_khoan, hashed);

    return { message: 'Doi mat khau thanh cong' };
  }
}
