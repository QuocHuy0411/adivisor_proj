import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.js';
import { authController } from './auth.module.js';

const router = Router();

// Authentication and credential routes
router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.post('/refresh-token', asyncHandler(authController.refreshAccessToken));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/change-password', authenticate, asyncHandler(authController.changePassword));

// Password recovery / OTP routes
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/verify-reset-otp', asyncHandler(authController.verifyResetOtp));
router.post('/reset-password', asyncHandler(authController.resetPassword));

export default router;
