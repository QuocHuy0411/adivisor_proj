import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';
import { hashPassword } from '../../../utils/passwords.js';
import { AuthException } from '../exceptions/auth.exception.js';
import { ResetPasswordDto } from '../dtos/auth.dto.js';

/**
 * Service managing OTP password recovery generation, verify token issues,
 * SMTP notifications dispatching, and secure password resetting.
 */
export class OtpService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/auth.repository.js').AuthRepository} dependencies.authRepository
   */
  constructor({ authRepository }) {
    this.authRepository = authRepository;
  }

  /**
   * @private
   */
  _resetSecret(account) {
    return `${env.jwtSecret}:${account.mat_khau}`;
  }

  /**
   * @private
   */
  _otpSecret(account) {
    return `${env.jwtSecret}:${account.mat_khau}:otp`;
  }

  /**
   * @private
   */
  _hashOtp(account, otp) {
    return crypto
      .createHash('sha256')
      .update(`${account.ma_tai_khoan}:${otp}:${env.jwtSecret}`)
      .digest('hex');
  }

  /**
   * @private
   */
  _generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
  }

  /**
   * @private
   */
  async _sendPasswordResetOtp(email, otp) {
    if (!env.smtp.host || !env.smtp.user || !env.smtp.password || !env.smtp.from) {
      AuthException.badRequest('Chưa cấu hình SMTP Gmail để gửi mã OTP');
    }

    const transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.password
      }
    });

    await transporter.sendMail({
      from: env.smtp.from,
      to: email,
      subject: 'Ma OTP dat lai mat khau Adivisor',
      text: `Ma OTP dat lai mat khau cua ban la ${otp}. Ma co hieu luc trong ${env.passwordResetOtpExpiresIn}. Neu ban khong yeu cau, vui long bo qua email nay.`
    });

    return true;
  }

  /**
   * Handles forgot password email submission and OTP issue.
   * @async
   * @param {Object} payload 
   * @returns {Promise<Object>} Status details with OTP token.
   */
  async forgotPassword({ email }) {
    if (!email) {
      AuthException.badRequest('Vui lòng nhập email');
    }

    const account = await this.authRepository.findByEmail(email);
    if (!account) {
      AuthException.badRequest('Email khong ton tai trong he thong');
    }
    if (!account.is_active) {
      AuthException.forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    const otp = this._generateOtp();
    const otp_token = jwt.sign(
      {
        purpose: 'password_reset_otp',
        ma_tai_khoan: account.ma_tai_khoan,
        otp_hash: this._hashOtp(account, otp)
      },
      this._otpSecret(account),
      { expiresIn: env.passwordResetOtpExpiresIn }
    );
    await this._sendPasswordResetOtp(account.email, otp);

    return {
      message: 'Mã OTP đã được gửi về email. Vui lòng kiểm tra hộp thư.',
      otp_token,
      expires_in: env.passwordResetOtpExpiresIn
    };
  }

  /**
   * Verifies reset OTP token and issues reset password token.
   * @async
   * @param {Object} payload 
   * @returns {Promise<Object>} Status and reset token.
   */
  async verifyResetOtp({ otp_token, otp }) {
    if (!otp_token || !otp) {
      AuthException.badRequest('Vui lòng nhập mã OTP');
    }

    const decoded = jwt.decode(otp_token);
    if (!decoded?.ma_tai_khoan || decoded?.purpose !== 'password_reset_otp') {
      AuthException.badRequest('Ma OTP khong hop le');
    }

    const account = await this.authRepository.findById(decoded.ma_tai_khoan);
    if (!account) {
      AuthException.badRequest('Ma OTP khong hop le');
    }
    if (!account.is_active) {
      AuthException.forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    let verified;
    try {
      verified = jwt.verify(otp_token, this._otpSecret(account));
    } catch {
      AuthException.badRequest('Ma OTP da het han hoac khong hop le');
    }

    if (verified.otp_hash !== this._hashOtp(account, otp)) {
      AuthException.badRequest('Ma OTP khong dung');
    }

    const reset_token = jwt.sign(
      {
        purpose: 'password_reset',
        ma_tai_khoan: account.ma_tai_khoan
      },
      this._resetSecret(account),
      { expiresIn: env.passwordResetExpiresIn }
    );

    return {
      message: 'Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.',
      reset_token,
      expires_in: env.passwordResetExpiresIn
    };
  }

  /**
   * Final password recovery reset using reset token.
   * @async
   * @param {Object} rawPayload 
   * @returns {Promise<Object>} Status message.
   */
  async resetPassword(rawPayload) {
    const payload = new ResetPasswordDto(rawPayload);

    const decoded = jwt.decode(payload.reset_token);
    if (!decoded?.ma_tai_khoan || decoded?.purpose !== 'password_reset') {
      AuthException.badRequest('Ma dat lai mat khau khong hop le');
    }

    const account = await this.authRepository.findById(decoded.ma_tai_khoan);
    if (!account) {
      AuthException.badRequest('Ma dat lai mat khau khong hop le');
    }
    if (!account.is_active) {
      AuthException.forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    try {
      jwt.verify(payload.reset_token, this._resetSecret(account));
    } catch {
      AuthException.badRequest('Ma dat lai mat khau da het han hoac khong hop le');
    }

    const hashed = await hashPassword(payload.mat_khau_moi);
    await this.authRepository.updatePassword(account.ma_tai_khoan, hashed);

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}
