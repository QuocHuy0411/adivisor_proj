import { transaction } from '../../../config/db.js';
import { hashPassword, defaultPasswordForRole } from '../../../utils/passwords.js';
import { makeId } from '../../../utils/ids.js';
import { parseCsv } from '../../../utils/csv.js';
import { AdminException } from '../exceptions/admin.exception.js';
import { AdminValidator } from '../validators/admin.validator.js';
import { SaveAdvisorDto, UpdateAdvisorInfoDto } from '../dtos/advisor.dto.js';

/**
 * Service managing Advisor (CVHT) profiles, links, accounts, and CSV importing.
 */
export class AdvisorService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/advisor.repository.js').AdvisorRepository} dependencies.advisorRepository
   * @param {import('../repositories/account.repository.js').AccountRepository} dependencies.accountRepository
   * @param {import('../repositories/faculty.repository.js').FacultyRepository} dependencies.facultyRepository
   */
  constructor({ advisorRepository, accountRepository, facultyRepository }) {
    this.advisorRepository = advisorRepository;
    this.accountRepository = accountRepository;
    this.facultyRepository = facultyRepository;
  }

  /**
   * Helper to check account availability inside a transaction.
   * @private
   */
  async _assertAccountAvailable(connection, { ten_tai_khoan, email }) {
    const existing = await this.accountRepository.findDuplicateAccount(connection, ten_tai_khoan, email);
    if (!existing) return;

    if (existing.ten_tai_khoan === ten_tai_khoan) {
      AdminException.badRequest(`Tên tài khoản ${ten_tai_khoan} đã tồn tại`);
    }
    AdminException.badRequest(`Email ${email} đã tồn tại trong tài khoản ${existing.ten_tai_khoan}`);
  }

  /**
   * Helper to create credentials inside a transaction.
   * @private
   */
  async _createAccount(connection, { ten_tai_khoan, email, role, defaultPassword, ma_tai_khoan }) {
    const passwordHash = await hashPassword(defaultPassword);
    const accountId = ma_tai_khoan || makeId('TK');
    try {
      await this.accountRepository.createAccount(connection, {
        ma_tai_khoan: accountId,
        ten_tai_khoan,
        mat_khau: passwordHash,
        email,
        loai_tai_khoan: role
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        AdminException.badRequest(`Ten tai khoan hoac email da ton tai: ${ten_tai_khoan}, ${email}`);
      }
      throw error;
    }
    return accountId;
  }

  /**
   * Helper to find faculty metadata within transaction context.
   * @private
   */
  async _findFacultyByFullNameWithConnection(connection, input) {
    const value = String(input || '').trim();
    if (!value) AdminException.badRequest('Thiếu tên khoa');
    const faculty = await this.facultyRepository.findByNameWithConnection(connection, value);
    if (!faculty) {
      AdminException.badRequest(`Không tìm thấy khoa "${value}". CSV phải ghi tên khoa đầy đủ.`);
    }
    return faculty;
  }

  /**
   * Helper to find faculty metadata without transaction context.
   * @private
   */
  async _findFacultyByFullName(input) {
    const value = String(input || '').trim();
    if (!value) AdminException.badRequest('Thiếu tên khoa');
    const faculty = await this.facultyRepository.findByName(value);
    if (!faculty) {
      AdminException.badRequest(`Không tìm thấy khoa "${value}". CSV phải ghi tên khoa đầy đủ.`);
    }
    return faculty;
  }

  /**
   * List advisor info, optionally filtered by faculty code.
   * @async
   * @param {string} [ma_khoa] 
   * @returns {Promise<Array>}
   */
  async listAdvisorInfo(ma_khoa) {
    return this.advisorRepository.listAdvisorInfo(ma_khoa);
  }

  /**
   * Create an Advisor profile manually (no credentials account).
   * @async
   * @param {Object} rawPayload 
   * @returns {Promise<Object>} Status message.
   */
  async createAdvisorInfo(rawPayload) {
    const payload = new SaveAdvisorDto(rawPayload);
    const faculty = await this._findFacultyByFullName(payload.ten_khoa);

    const existing = await this.advisorRepository.findById(payload.ma_co_van);
    if (existing) {
      AdminException.badRequest(`Cố vấn học tập ${payload.ma_co_van} đã tồn tại`);
    }

    await this.advisorRepository.createAdvisorInfo({
      ma_co_van: payload.ma_co_van,
      ma_khoa: faculty.ma_khoa,
      ho_va_ten: payload.ho_va_ten,
      so_dien_thoai: payload.so_dien_thoai,
      uu_tien: payload.uu_tien,
      chuyen_nganh: payload.chuyen_nganh
    });

    return { message: 'Tạo thông tin cố vấn học tập thành công' };
  }

  /**
   * Update Advisor profile fields.
   * @async
   * @param {string} ma_co_van 
   * @param {Object} rawPayload 
   * @returns {Promise<Object>} Status message.
   */
  async updateAdvisorInfo(ma_co_van, rawPayload) {
    const existing = await this.advisorRepository.findById(ma_co_van);
    if (!existing) {
      AdminException.notFound('Không tìm thấy thông tin cố vấn học tập');
    }

    const payload = new UpdateAdvisorInfoDto(rawPayload);

    const faculties = await this.facultyRepository.listFaculties();
    const facultyExists = faculties.some(f => f.ma_khoa === payload.ma_khoa);
    if (!facultyExists) {
      AdminException.badRequest('Khoa không tồn tại');
    }

    await this.advisorRepository.updateAdvisorInfo(ma_co_van, {
      ho_va_ten: payload.ho_va_ten,
      so_dien_thoai: payload.so_dien_thoai,
      ma_khoa: payload.ma_khoa,
      chuyen_nganh: payload.chuyen_nganh
    });

    return { message: 'Cập nhật thông tin cố vấn học tập thành công' };
  }

  /**
   * Cascade-delete an Advisor and associated credentials account.
   * @async
   * @param {string} ma_co_van 
   * @returns {Promise<Object>} Status message.
   */
  async deleteAdvisorInfo(ma_co_van) {
    const advisor = await this.advisorRepository.findById(ma_co_van);
    if (!advisor) {
      AdminException.notFound('Không tìm thấy thông tin cố vấn học tập');
    }

    await transaction(async (connection) => {
      await this.advisorRepository.deleteAdvisorCascade(connection, ma_co_van, advisor.ma_tai_khoan);
    });

    return { message: 'Xóa thông tin cố vấn học tập và tài khoản tương ứng thành công' };
  }

  /**
   * Import Advisor profiles from CSV (no accounts).
   * @async
   * @param {Object} file 
   * @returns {Promise<Object>} Status message.
   */
  async importAdvisorInfo(file) {
    if (!file) AdminException.badRequest('Vui lòng tải lên file CSV');
    const records = parseCsv(file.buffer);
    let created = 0;

    for (const row of records) {
      await this.createAdvisorInfo({
        ma_co_van: AdminValidator.valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']),
        ho_va_ten: AdminValidator.valueOf(row, ['ho_va_ten', 'Ten CVHT', 'Tên CVHT', 'Ho va ten', 'Họ và tên', 'Ho ten', 'Họ tên']),
        so_dien_thoai: AdminValidator.valueOf(row, ['so_dien_thoai', 'So dien thoai', 'Số điện thoại']),
        ten_khoa: AdminValidator.valueOf(row, ['ten_khoa', 'Ten khoa', 'Tên khoa', 'Khoa']),
        chuyen_nganh: AdminValidator.valueOf(row, ['chuyen_nganh', 'Chuyen nganh', 'Chuyên ngành']),
        uu_tien: AdminValidator.valueOf(row, ['uu_tien', 'Uu tien', 'Ưu tiên', 'Do uu tien', 'Độ ưu tiên']) || 2
      });
      created += 1;
    }

    return { message: 'Import thông tin cố vấn học tập thành công', created };
  }

  /**
   * Create credentials accounts for existing Advisor profiles.
   * @async
   * @param {Object} file 
   * @returns {Promise<Object>} Status message.
   */
  async importAdvisorAccounts(file) {
    if (!file) AdminException.badRequest('Vui lòng tải lên file CSV');
    const records = parseCsv(file.buffer);
    let created = 0;

    for (const row of records) {
      const ma_co_van = AdminValidator.valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']);
      const email = AdminValidator.valueOf(row, ['email', 'Email']);
      if (!ma_co_van || !email) {
        AdminException.badRequest('CSV tài khoản cố vấn học tập cần có: mã nhân viên, email');
      }

      await transaction(async (connection) => {
        const advisor = await this.advisorRepository.findByIdWithConnection(connection, ma_co_van);
        if (!advisor) {
          AdminException.badRequest(`Chưa có thông tin cố vấn học tập ${ma_co_van}, cần import thông tin trước`);
        }
        if (advisor.ma_tai_khoan) {
          AdminException.badRequest(`Cố vấn học tập ${ma_co_van} đã có tài khoản`);
        }

        await this._assertAccountAvailable(connection, { ten_tai_khoan: ma_co_van, email });

        const accountId = await this._createAccount(connection, {
          ten_tai_khoan: ma_co_van,
          email,
          role: 'covan',
          defaultPassword: defaultPasswordForRole('covan')
        });

        await this.advisorRepository.linkAccount(connection, ma_co_van, accountId);
      });

      created += 1;
    }

    return { message: 'Import tài khoản cố vấn học tập thành công', created };
  }

  /**
   * Full profile + account creation import from CSV.
   * @async
   * @param {Object} file 
   * @returns {Promise<Object>} Status message.
   */
  async importAdvisorInfoAndAccounts(file) {
    if (!file) AdminException.badRequest('Vui lòng tải lên file CSV');
    const records = parseCsv(file.buffer);
    let created = 0;

    for (const row of records) {
      const payload = {
        ma_co_van: AdminValidator.valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']),
        ho_va_ten: AdminValidator.valueOf(row, ['ho_va_ten', 'Ten CVHT', 'Tên CVHT', 'Ho va ten', 'Họ và tên', 'Ho ten', 'Họ tên']),
        so_dien_thoai: AdminValidator.valueOf(row, ['so_dien_thoai', 'So dien thoai', 'Số điện thoại']),
        email: AdminValidator.valueOf(row, ['email', 'Email']),
        ten_khoa: AdminValidator.valueOf(row, ['ten_khoa', 'Ten khoa', 'Tên khoa', 'Khoa']),
        chuyen_nganh: AdminValidator.valueOf(row, ['chuyen_nganh', 'Chuyen nganh', 'Chuyên ngành']),
        uu_tien: AdminValidator.valueOf(row, ['uu_tien', 'Uu tien', 'Ưu tiên', 'Do uu tien', 'Độ ưu tiên']) || 2
      };

      if (!payload.ma_co_van || !payload.ho_va_ten || !payload.so_dien_thoai || !payload.email || !payload.ten_khoa || !payload.chuyen_nganh) {
        AdminException.badRequest('CSV cố vấn học tập cần có: Mã nhân viên, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên');
      }

      await transaction(async (connection) => {
        const faculty = await this._findFacultyByFullNameWithConnection(connection, payload.ten_khoa);
        const advisor = await this.advisorRepository.findByIdWithConnection(connection, payload.ma_co_van);
        if (advisor?.ma_tai_khoan) {
          AdminException.badRequest(`Cố vấn học tập ${payload.ma_co_van} đã có tài khoản`);
        }

        await this._assertAccountAvailable(connection, {
          ten_tai_khoan: payload.ma_co_van,
          email: payload.email
        });

        await this.advisorRepository.saveAdvisorInTransaction(
          connection,
          {
            ma_co_van: payload.ma_co_van,
            ma_khoa: faculty.ma_khoa,
            ho_va_ten: payload.ho_va_ten,
            so_dien_thoai: payload.so_dien_thoai,
            uu_tien: AdminValidator.normalizePriority(payload.uu_tien),
            chuyen_nganh: payload.chuyen_nganh
          },
          Boolean(advisor)
        );

        const accountId = await this._createAccount(connection, {
          ten_tai_khoan: payload.ma_co_van,
          email: payload.email,
          role: 'covan',
          defaultPassword: defaultPasswordForRole('covan')
        });

        await this.advisorRepository.linkAccount(connection, payload.ma_co_van, accountId);
      });

      created += 1;
    }

    return { message: 'Import thông tin và tài khoản cố vấn học tập thành công', created };
  }
}
