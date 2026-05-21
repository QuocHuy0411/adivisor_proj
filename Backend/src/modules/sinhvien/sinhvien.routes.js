import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './sinhvien.service.js';

const router = Router();

router.use(authenticate, requirePasswordChanged, requireRole('sinhvien'));

router.get('/me', asyncHandler(async (req, res) => res.json(await service.myProfile(req.user))));
router.get('/advisor', asyncHandler(async (req, res) => res.json(await service.myAdvisor(req.user))));

export default router;
