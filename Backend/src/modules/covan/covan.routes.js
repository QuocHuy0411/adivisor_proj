import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './covan.service.js';

const router = Router();

router.use(authenticate, requirePasswordChanged, requireRole('covan'));

router.get('/me', asyncHandler(async (req, res) => res.json(await service.advisorInfo(req.user))));
router.get('/classes', asyncHandler(async (req, res) => res.json(await service.myClasses(req.user))));
router.get('/classes/:id/students', asyncHandler(async (req, res) => {
  res.json(await service.classStudents(req.user, req.params.id));
}));
router.post('/replacement-requests', asyncHandler(async (req, res) => {
  res.status(201).json(await service.createReplacementRequest(req.user, req.body));
}));
router.get('/replacement-requests', asyncHandler(async (req, res) => {
  res.json(await service.myReplacementRequests(req.user));
}));

export default router;
