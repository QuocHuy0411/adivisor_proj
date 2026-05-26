import { env } from '../../../config/env.js';

/**
 * Controller handling Express HTTP endpoints for Auth,
 * configuring secure session cookies, and returning payloads.
 */
export class AuthController {
  /**
   * @param {Object} dependencies
   * @param {import('../services/auth.service.js').AuthService} dependencies.authService
   * @param {import('../services/session.service.js').SessionService} dependencies.sessionService
   * @param {import('../services/otp.service.js').OtpService} dependencies.otpService
   */
  constructor({ authService, sessionService, otpService }) {
    this.authService = authService;
    this.sessionService = sessionService;
    this.otpService = otpService;

    this.cookieOptions = {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/'
    };
  }

  /**
   * Helper to attach tokens as HTTP-only cookies to the response.
   * @private
   */
  _attachSessionCookies(res, session) {
    console.log("Da vao day ne")
    res.cookie('accessToken', session.accessToken, {
      ...this.cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 mins
    });
    res.cookie('refreshToken', session.refreshToken, {
      ...this.cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  login = async (req, res) => {
    const session = await this.authService.login(req.body);
    this._attachSessionCookies(res, session);
    res.json(session.user);
  };

  logout = async (req, res) => {
    const { refreshToken } = req.cookies;
    await this.sessionService.logoutServer(refreshToken);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Đăng xuất thành công' });
  };

  refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.cookies;
    const session = await this.sessionService.refreshAccessToken(refreshToken);
    this._attachSessionCookies(res, session);
    res.json(session.user);
  };

  me = async (req, res) => {
    // me uses the buildSession helper on active req.user profile
    const session = await this.sessionService.buildSession(req.user);
    this._attachSessionCookies(res, session);
    res.json(session.user);
  };

  changePassword = async (req, res) => {
    const result = await this.authService.changePassword(req.user, req.body);
    res.json(result);
  };

  forgotPassword = async (req, res) => {
    const result = await this.otpService.forgotPassword(req.body);
    res.json(result);
  };

  verifyResetOtp = async (req, res) => {
    const result = await this.otpService.verifyResetOtp(req.body);
    res.json(result);
  };

  resetPassword = async (req, res) => {
    const result = await this.otpService.resetPassword(req.body);
    res.json(result);
  };
}
