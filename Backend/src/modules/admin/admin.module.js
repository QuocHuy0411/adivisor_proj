import { FacultyRepository } from './repositories/faculty.repository.js';
import { AccountRepository } from './repositories/account.repository.js';
import { AdvisorRepository } from './repositories/advisor.repository.js';
import { FacultyService } from './services/faculty.service.js';
import { AccountService } from './services/account.service.js';
import { EmployeeService } from './services/employee.service.js';
import { AdvisorService } from './services/advisor.service.js';
import { AdminController } from './controllers/admin.controller.js';

// 1. Instantiate Repositories
const facultyRepository = new FacultyRepository();
const accountRepository = new AccountRepository();
const advisorRepository = new AdvisorRepository();

// 2. Instantiate Services (with Dependency Injection)
const facultyService = new FacultyService({ facultyRepository });
const accountService = new AccountService({ accountRepository });
const employeeService = new EmployeeService({ accountRepository, facultyRepository });
const advisorService = new AdvisorService({ advisorRepository, accountRepository, facultyRepository });

// 3. Instantiate Controller
const adminController = new AdminController({
  facultyService,
  accountService,
  employeeService,
  advisorService
});

// Export all instantiated singletons for ease of usage
export {
  facultyRepository,
  accountRepository,
  advisorRepository,
  facultyService,
  accountService,
  employeeService,
  advisorService,
  adminController
};
