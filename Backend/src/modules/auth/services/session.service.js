import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';
import { AuthException } from '../exceptions/auth.exception.js';
import { SessionEntity } from '../entities/session.entity.js';

/**
 * Service managing access and refresh token sessions, validation, and rotation.
 */
export class SessionService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/session.repository.js').SessionRepository} dependencies.sessionRepository
   * @param {import('../repositories/auth.repository.js').AuthRepository} dependencies.authRepository
   */
  constructor({ sessionRepository, authRepository }) {
    this.sessionRepository = sessionRepository;
    this.authRepository = authRepository;
  }

  /**
   * Build JWT session (accessToken, refreshToken, profile data) and save it.
   * @async
   * @param {Object} account 
   * @returns {Promise<SessionEntity>}
   */
  async buildSession(account) {
    const profile = await this.authRepository.loadProfile(account);
    if (!profile || Object.keys(profile).length === 0) {
      AuthException.forbidden('Tài khoản không còn hồ sơ vai trò hợp lệ');
    }

    const payload = {
      ma_tai_khoan: account.ma_tai_khoan,
      ten_tai_khoan: account.ten_tai_khoan,
      loai_tai_khoan: account.loai_tai_khoan,
      ...profile
    };

    const accessToken = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    const refreshToken = jwt.sign(
      { ma_tai_khoan: account.ma_tai_khoan, type: 'refresh' },
      env.jwtRefreshSecret,
      { expiresIn: env.jwtRefreshExpiresIn }
    );

    await this.sessionRepository.saveRefreshToken(account.ma_tai_khoan, refreshToken);

    return new SessionEntity({
      accessToken,
      refreshToken,
      user: {
        ma_tai_khoan: account.ma_tai_khoan,
        ten_tai_khoan: account.ten_tai_khoan,
        email: account.email,
        loai_tai_khoan: account.loai_tai_khoan,
        da_doi_mk: Boolean(account.da_doi_mk),
        is_active: Boolean(account.is_active),
        ...profile
      }
    });
  }

  /**
   * Delete refresh token session upon server logout request.
   * @async
   * @param {string} refreshToken 
   */
  async logoutServer(refreshToken) {
    if (!refreshToken) return;
    await this.sessionRepository.deleteRefreshToken(refreshToken);
  }

  /**
   * Rotate current refresh token session and return new active tokens.
   * @async
   * @param {string} refreshToken 
   * @returns {Promise<SessionEntity>}
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      AuthException.unauthorized('Không có refresh token');
    }

    const activeToken = await this.sessionRepository.findActiveRefreshToken(refreshToken);
    if (!activeToken) {
      AuthException.unauthorized('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    try {
      const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);
      const account = await this.authRepository.findById(decoded.ma_tai_khoan);

      if (!account || !account.is_active) {
        await this.sessionRepository.deleteRefreshToken(refreshToken);
        AuthException.forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');
      }

      // Rotation: delete used refresh token
      await this.sessionRepository.deleteRefreshToken(refreshToken);

      return await this.buildSession(account);
    } catch (error) {
      await this.sessionRepository.deleteRefreshToken(refreshToken);
      if (error.status) throw error;
      AuthException.unauthorized('Refresh token không hợp lệ');
    }
  }
}
