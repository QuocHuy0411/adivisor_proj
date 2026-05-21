import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import * as service from './auth.service.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  res.json(await service.login(req.body));
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const session = await service.me(req.user);
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
