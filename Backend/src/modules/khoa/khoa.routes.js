import { Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './khoa.service.js';

const router = Router();

router.use(authenticate, requirePasswordChanged, requireRole('khoa'));

router.get('/assignments', asyncHandler(async (req, res) => res.json(await service.listAssignments(req.user))));
router.get('/advisors', asyncHandler(async (req, res) => res.json(await service.listAdvisors(req.user))));
router.patch('/advisors/:id/priority', asyncHandler(async (req, res) => {
  res.json(await service.updateAdvisorPriority(req.user, req.params.id, req.body.uu_tien));
}));
router.post('/assignments/auto-assign', asyncHandler(async (req, res) => {
  res.json(await service.autoAssignAdvisors(req.user));
}));
router.post('/assignments/submit-all', asyncHandler(async (req, res) => {
  res.json(await service.submitAllAssignments(req.user));
}));
router.post('/assignments/:id/assign', asyncHandler(async (req, res) => {
  res.json(await service.assignAdvisor(req.user, req.params.id, req.body.ma_co_van));
}));
router.post('/assignments/:id/submit', asyncHandler(async (req, res) => {
  res.json(await service.submitAssignment(req.user, req.params.id));
}));

router.get('/replacement-requests', asyncHandler(async (req, res) => {
  res.json(await service.listReplacementRequests(req.user));
}));
router.post('/replacement-requests/:id/start-step-1', asyncHandler(async (req, res) => {
  res.json(await service.startReplacementStep1(req.user, req.params.id));
}));
router.post('/replacement-requests/:id/approve-step-1', asyncHandler(async (req, res) => {
  res.json(await service.approveReplacementStep1(req.user, req.params.id, req.body.ma_co_van_moi));
}));
router.post('/replacement-requests/:id/reject-step-1', asyncHandler(async (req, res) => {
  res.json(await service.rejectReplacementStep1(req.user, req.params.id));
}));

export default router;
