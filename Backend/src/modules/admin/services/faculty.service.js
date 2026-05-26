/**
 * Service managing KHOA (Faculty) operations.
 */
export class FacultyService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/faculty.repository.js').FacultyRepository} dependencies.facultyRepository
   */
  constructor({ facultyRepository }) {
    this.facultyRepository = facultyRepository;
  }

  /**
   * List all faculties.
   * @async
   * @returns {Promise<Array>}
   */
  async listFaculties() {
    return this.facultyRepository.listFaculties();
  }
}
