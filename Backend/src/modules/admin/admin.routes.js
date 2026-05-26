import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { adminController } from './admin.module.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Authenticate and authorize all routes in this module for Admin only
router.use(authenticate, requirePasswordChanged, requireRole('admin'));

// Faculty management routes
router.get('/faculties', asyncHandler(adminController.listFaculties));

// Employee group management routes
router.get('/employee-groups', asyncHandler(adminController.listEmployeeGroups));
router.get('/employee-groups/:id/accounts', asyncHandler(adminController.listEmployeeGroupAccounts));
router.patch('/employee-accounts/:id', asyncHandler(adminController.updateEmployeeAccount));
router.delete('/employee-accounts/:id', asyncHandler(adminController.deleteEmployeeAccount));
router.get('/faculties/:id/employees', asyncHandler(adminController.listFacultyEmployees));

// Advisor profile management routes
router.get('/advisors/info', asyncHandler(adminController.listAdvisorInfo));
router.get('/advisor-groups/:id/advisors', asyncHandler(adminController.listAdvisorInfo));
router.patch('/advisors/info/:id', asyncHandler(adminController.updateAdvisorInfo));
router.delete('/advisors/info/:id', asyncHandler(adminController.deleteAdvisorInfo));

// Credentials accounts status management routes
router.get('/accounts', asyncHandler(adminController.listAccounts));
router.patch('/accounts/:id/status', asyncHandler(adminController.updateAccountStatus));

// CSV importing routes
router.post('/faculty-heads/import', upload.single('file'), asyncHandler(adminController.importFacultyHeadAccounts));
router.post('/advisors/info/import', upload.single('file'), asyncHandler(adminController.importAdvisorInfo));
router.post('/advisors/accounts/import', upload.single('file'), asyncHandler(adminController.importAdvisorAccounts));
router.post('/advisors/full/import', upload.single('file'), asyncHandler(adminController.importAdvisorInfoAndAccounts));

// Deprecated or informational placeholders matching legacy routing
router.post('/staff', (req, res) => {
  res.status(410).json({ message: 'Admin không tạo thủ công. Vui lòng import CSV tài khoản Trưởng Khoa.' });
});

router.post('/advisors', (req, res) => {
  res.status(410).json({ message: 'Admin không tạo thủ công. Vui lòng import CSV thông tin CVHT.' });
});

router.post('/advisors/import', upload.single('file'), asyncHandler(adminController.importAdvisorInfo));

export default router;
