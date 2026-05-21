import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePasswordChanged, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './ctsv.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate, requirePasswordChanged, requireRole('ctsv'));

router.get('/students', asyncHandler(async (req, res) => res.json(await service.listStudents())));
router.post('/students', asyncHandler(async (req, res) => res.status(201).json(await service.createStudent(req.body))));
router.post('/students/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importStudents(req.file, req.body.ma_lop));
}));
router.patch('/students/:id', asyncHandler(async (req, res) => res.json(await service.updateStudent(req.params.id, req.body))));
router.patch('/students/:id/account-status', asyncHandler(async (req, res) => {
  res.json(await service.updateStudentAccountStatus(req.params.id, req.body.is_active));
}));
router.delete('/students/:id', asyncHandler(async (req, res) => res.json(await service.deleteStudent(req.params.id))));

router.get('/class-groups', asyncHandler(async (req, res) => res.json(await service.listClassGroups())));
router.get('/classes', asyncHandler(async (req, res) => res.json(await service.listClasses())));
router.post('/classes', asyncHandler(async (req, res) => res.status(201).json(await service.createClass(req.body))));
router.post('/classes/import', upload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await service.importClasses(req.file));
}));
router.post('/classes/reset-advisors', asyncHandler(async (req, res) => res.json(await service.resetClassAdvisors())));
router.post('/classes/send-to-faculties', asyncHandler(async (req, res) => res.json(await service.sendClassRequestsToFaculties())));
router.delete('/classes/:id/students', asyncHandler(async (req, res) => res.json(await service.deleteStudentsByClass(req.params.id))));
router.patch('/classes/:id', asyncHandler(async (req, res) => res.json(await service.updateClass(req.params.id, req.body))));
router.delete('/classes/:id', asyncHandler(async (req, res) => res.json(await service.deleteClass(req.params.id))));

router.get('/assignments', asyncHandler(async (req, res) => res.json(await service.listAssignments())));
router.post('/assignments', asyncHandler(async (req, res) => res.status(201).json(await service.createAssignmentRequest(req.body))));
router.post('/assignments/approve-all', asyncHandler(async (req, res) => res.json(await service.approveAllAssignments(req.user))));
router.post('/assignments/reject-all', asyncHandler(async (req, res) => res.json(await service.rejectAllAssignments())));
router.post('/assignments/:id/send', asyncHandler(async (req, res) => res.json(await service.sendAssignmentToFaculty(req.params.id))));
router.post('/assignments/:id/approve', asyncHandler(async (req, res) => res.json(await service.approveAssignment(req.user, req.params.id))));
router.post('/assignments/:id/reject', asyncHandler(async (req, res) => res.json(await service.rejectAssignment(req.params.id))));

router.get('/replacement-requests', asyncHandler(async (req, res) => res.json(await service.listReplacementRequests())));
router.post('/replacement-requests/approve-all', asyncHandler(async (req, res) => res.json(await service.approveAllReplacements(req.user))));
router.post('/replacement-requests/reject-all', asyncHandler(async (req, res) => res.json(await service.rejectAllReplacements())));
router.post('/replacement-requests/:id/start-step-2', asyncHandler(async (req, res) => res.json(await service.startReplacementStep2(req.params.id))));
router.post('/replacement-requests/:id/approve', asyncHandler(async (req, res) => res.json(await service.approveReplacement(req.user, req.params.id))));
router.post('/replacement-requests/:id/reject', asyncHandler(async (req, res) => res.json(await service.rejectReplacement(req.params.id))));

export default router;
