/**
 * Controller handling all incoming HTTP requests for Admin tasks
 * and routing them to the appropriate services.
 */
export class AdminController {
  /**
   * @param {Object} dependencies
   * @param {import('../services/faculty.service.js').FacultyService} dependencies.facultyService
   * @param {import('../services/account.service.js').AccountService} dependencies.accountService
   * @param {import('../services/employee.service.js').EmployeeService} dependencies.employeeService
   * @param {import('../services/advisor.service.js').AdvisorService} dependencies.advisorService
   */
  constructor({ facultyService, accountService, employeeService, advisorService }) {
    this.facultyService = facultyService;
    this.accountService = accountService;
    this.employeeService = employeeService;
    this.advisorService = advisorService;
  }

  listFaculties = async (req, res) => {
    const result = await this.facultyService.listFaculties();
    res.json(result);
  };

  listEmployeeGroups = async (req, res) => {
    const result = await this.employeeService.listEmployeeGroups();
    res.json(result);
  };

  listEmployeeGroupAccounts = async (req, res) => {
    const result = await this.employeeService.listEmployeeGroupAccounts(req.params.id);
    res.json(result);
  };

  updateEmployeeAccount = async (req, res) => {
    const result = await this.employeeService.updateEmployeeAccount(req.params.id, req.body);
    res.json(result);
  };

  deleteEmployeeAccount = async (req, res) => {
    const result = await this.employeeService.deleteEmployeeAccount(req.user, req.params.id);
    res.json(result);
  };

  listFacultyEmployees = async (req, res) => {
    const result = await this.employeeService.listFacultyEmployees(req.params.id);
    res.json(result);
  };

  listAdvisorInfo = async (req, res) => {
    const result = await this.advisorService.listAdvisorInfo(req.params.id);
    res.json(result);
  };

  updateAdvisorInfo = async (req, res) => {
    const result = await this.advisorService.updateAdvisorInfo(req.params.id, req.body);
    res.json(result);
  };

  deleteAdvisorInfo = async (req, res) => {
    const result = await this.advisorService.deleteAdvisorInfo(req.params.id);
    res.json(result);
  };

  listAccounts = async (req, res) => {
    const result = await this.accountService.listAccounts();
    res.json(result);
  };

  updateAccountStatus = async (req, res) => {
    const result = await this.accountService.updateAccountStatus(req.user, req.params.id, req.body.is_active);
    res.json(result);
  };

  importFacultyHeadAccounts = async (req, res) => {
    const result = await this.employeeService.importFacultyHeadAccounts(req.file);
    res.status(201).json(result);
  };

  importAdvisorInfo = async (req, res) => {
    const result = await this.advisorService.importAdvisorInfo(req.file);
    res.status(201).json(result);
  };

  importAdvisorAccounts = async (req, res) => {
    const result = await this.advisorService.importAdvisorAccounts(req.file);
    res.status(201).json(result);
  };

  importAdvisorInfoAndAccounts = async (req, res) => {
    const result = await this.advisorService.importAdvisorInfoAndAccounts(req.file);
    res.status(201).json(result);
  };
}
