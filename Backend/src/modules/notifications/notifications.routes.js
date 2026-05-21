import { Router } from 'express';
import { authenticate, requirePasswordChanged } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './notifications.service.js';

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', asyncHandler(async (req, res) => res.json(await service.listNotifications(req.user))));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createNotification(req.user, req.body))));

export default router;
