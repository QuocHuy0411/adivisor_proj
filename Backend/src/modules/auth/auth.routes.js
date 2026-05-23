import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import * as service from './auth.service.js';
import { env } from '../../config/env.js';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/'
};

router.post('/login', asyncHandler(async (req, res) => {
  const session = await service.login(req.body);
  // accessToken 15 mins, refreshToken 7 days
  res.cookie('accessToken', session.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', session.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json(session.user);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  await service.logoutServer(refreshToken);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Đăng xuất thành công' });
}));

router.post('/refresh-token', asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  const session = await service.refreshAccessToken(refreshToken);
  res.cookie('accessToken', session.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', session.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json(session.user);
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const session = await service.me(req.user);
  res.cookie('accessToken', session.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', session.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json(session.user);
}));

router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  res.json(await service.changePassword(req.user, req.body));
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  res.json(await service.forgotPassword(req.body));
}));

router.post('/verify-reset-otp', asyncHandler(async (req, res) => {
  res.json(await service.verifyResetOtp(req.body));
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  res.json(await service.resetPassword(req.body));
}));

export default router;
