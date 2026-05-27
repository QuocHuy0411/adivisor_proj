import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as controller from './controllers/covan.controller.js';

const router = Router();

router.use(authenticate, requirePasswordChanged, requireRole('covan'));

router.get('/me', asyncHandler(async (req, res) => res.json(await controller.advisorInfo(req.user))));
router.get('/classes', asyncHandler(async (req, res) => res.json(await controller.myClasses(req.user))));
router.get('/classes/:id/students', asyncHandler(async (req, res) => {
  res.json(await controller.classStudents(req.user, req.params.id));
}));
router.post('/replacement-requests', asyncHandler(async (req, res) => {
  res.status(201).json(await controller.createReplacementRequest(req.user, req.body));
}));
router.get('/replacement-requests', asyncHandler(async (req, res) => {
  res.json(await controller.myReplacementRequests(req.user));
}));

export default router;
