import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './admin.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate, requirePasswordChanged, requireRole('admin'));

router.get('/faculties', asyncHandler(async (req, res) => {
  res.json(await service.listFaculties());
}));

router.get('/employee-groups', asyncHandler(async (req, res) => {
  res.json(await service.listEmployeeGroups());
}));

router.get('/employee-groups/:id/accounts', asyncHandler(async (req, res) => {
  res.json(await service.listEmployeeGroupAccounts(req.params.id));
}));

router.patch('/employee-accounts/:id', asyncHandler(async (req, res) => {
  res.json(await service.updateEmployeeAccount(req.params.id, req.body));
}));

router.delete('/employee-accounts/:id', asyncHandler(async (req, res) => {
  res.json(await service.deleteEmployeeAccount(req.user, req.params.id));
}));

router.get('/faculties/:id/employees', asyncHandler(async (req, res) => {
  res.json(await service.listFacultyEmployees(req.params.id));
}));

router.get('/advisors/info', asyncHandler(async (req, res) => {
  res.json(await service.listAdvisorInfo());
}));

router.get('/advisor-groups/:id/advisors', asyncHandler(async (req, res) => {
  res.json(await service.listAdvisorInfo(req.params.id));
}));

router.patch('/advisors/info/:id', asyncHandler(async (req, res) => {
  res.json(await service.updateAdvisorInfo(req.params.id, req.body));
}));

router.delete('/advisors/info/:id', asyncHandler(async (req, res) => {
  res.json(await service.deleteAdvisorInfo(req.params.id));
}));

router.get('/accounts', asyncHandler(async (req, res) => {
  res.json(await service.listAccounts());
}));

router.patch('/accounts/:id/status', asyncHandler(async (req, res) => {
  res.json(await service.updateAccountStatus(req.user, req.params.id, req.body.is_active));
}));

router.post('/faculty-heads/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importFacultyHeadAccounts(req.file));
}));

router.post('/advisors/info/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importAdvisorInfo(req.file));
}));

router.post('/advisors/accounts/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importAdvisorAccounts(req.file));
}));

router.post('/advisors/full/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importAdvisorInfoAndAccounts(req.file));
}));

router.post('/staff', (req, res) => {
  res.status(410).json({ message: 'Admin không tạo thủ công. Vui lòng import CSV tài khoản Trưởng Khoa.' });
});

router.post('/advisors', (req, res) => {
  res.status(410).json({ message: 'Admin không tạo thủ công. Vui lòng import CSV thông tin CVHT.' });
});

router.post('/advisors/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importAdvisorInfo(req.file));
}));

export default router;
