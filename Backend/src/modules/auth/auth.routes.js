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

router.post('/forgot-password', (req, res) => {
  res.status(501).json({ message: 'Chuc nang OTP se duoc tich hop khi cau hinh email server' });
});

router.post('/reset-password', (req, res) => {
  res.status(501).json({ message: 'Chuc nang OTP se duoc tich hop khi cau hinh email server' });
});

export default router;
