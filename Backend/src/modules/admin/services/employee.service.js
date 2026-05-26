import { transaction } from '../../../config/db.js';
import { hashPassword, defaultPasswordForRole } from '../../../utils/passwords.js';
import { makeId } from '../../../utils/ids.js';
import { parseCsv } from '../../../utils/csv.js';
import { AdminException } from '../exceptions/admin.exception.js';
import { AdminValidator } from '../validators/admin.validator.js';
import { UpdateAccountDto } from '../dtos/account.dto.js';

/**
 * Service managing operational staff, Faculty Heads, and CTSV personnel.
 */
export class EmployeeService {
  /**
   * @param {Object} dependencies
   * @param {import('../repositories/account.repository.js').AccountRepository} dependencies.accountRepository
   * @param {import('../repositories/faculty.repository.js').FacultyRepository} dependencies.facultyRepository
   */
  constructor({ accountRepository, facultyRepository }) {
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
   * List unit divisions for employee groups.
   * @async
   * @returns {Promise<Array>}
   */
  async listEmployeeGroups() {
    const faculties = await this.facultyRepository.listFaculties();
    const formattedFaculties = faculties.map(f => ({
      ma_don_vi: f.ma_khoa,
      ten_don_vi: f.ten_khoa
    }));
    return [
      ...formattedFaculties,
      { ma_don_vi: 'CTSV', ten_don_vi: 'Cong tac sinh vien' }
    ];
  }

  /**
   * Fetch accounts registered under an employee group division.
   * @async
   * @param {string} ma_don_vi 
   * @returns {Promise<Array>}
   */
  async listEmployeeGroupAccounts(ma_don_vi) {
    return this.accountRepository.listEmployeeGroupAccounts(ma_don_vi);
  }

  /**
   * Fetch staff profiles associated with a Faculty.
   * @async
   * @param {string} ma_khoa 
   * @returns {Promise<Array>}
   */
  async listFacultyEmployees(ma_khoa) {
    return this.accountRepository.listFacultyEmployees(ma_khoa);
  }

  /**
   * Update CTSV or Faculty Head account and details.
   * @async
   * @param {string} ma_tai_khoan 
   * @param {Object} rawPayload 
   * @returns {Promise<Object>} Status message.
   */
  async updateEmployeeAccount(ma_tai_khoan, rawPayload) {
    const account = await this.accountRepository.findById(ma_tai_khoan);
    if (!account) AdminException.notFound('Không tìm thấy tài khoản');
    if (account.loai_tai_khoan === 'admin') {
      AdminException.forbidden('Admin không sửa tài khoản Admin ở danh sách này');
    }
    if (account.loai_tai_khoan === 'covan') {
      AdminException.forbidden('Admin không sửa tài khoản cố vấn học tập tại danh sách tài khoản');
    }

    const payload = new UpdateAccountDto(rawPayload);

    await transaction(async (connection) => {
      const emailTaken = await this.accountRepository.hasEmailDuplicate(connection, payload.email, ma_tai_khoan);
      if (emailTaken) {
        AdminException.badRequest(`Email ${payload.email} đã tồn tại`);
      }

      await this.accountRepository.updateEmail(connection, ma_tai_khoan, payload.email);

      if (account.loai_tai_khoan === 'ctsv') {
        await this.accountRepository.updateCtsvProfile(connection, ma_tai_khoan, payload.ho_va_ten);
      } else if (account.loai_tai_khoan === 'khoa') {
        await this.accountRepository.updateFacultyHeadProfile(connection, ma_tai_khoan, payload.ho_va_ten);
      }
    });

    return { message: 'Cập nhật tài khoản nhân viên thành công' };
  }

  /**
   * Delete CTSV or Faculty Head profile and credentials.
   * @async
   * @param {Object} currentUser 
   * @param {string} ma_tai_khoan 
   * @returns {Promise<Object>} Status message.
   */
  async deleteEmployeeAccount(currentUser, ma_tai_khoan) {
    const account = await this.accountRepository.findById(ma_tai_khoan);
    if (!account) AdminException.notFound('Không tìm thấy tài khoản');
    if (account.loai_tai_khoan === 'admin') {
      AdminException.forbidden('Admin không thể xóa tài khoản Admin');
    }
    if (account.loai_tai_khoan === 'covan') {
      AdminException.forbidden('Admin không xóa tài khoản cố vấn học tập tại danh sách tài khoản');
    }
    if (currentUser.ma_tai_khoan === ma_tai_khoan) {
      AdminException.forbidden('Không thể tự xóa tài khoản đang đăng nhập');
    }

    try {
      await transaction(async (connection) => {
        if (account.loai_tai_khoan === 'ctsv') {
          await this.accountRepository.deleteCtsvProfile(connection, ma_tai_khoan);
        } else if (account.loai_tai_khoan === 'khoa') {
          await this.accountRepository.deleteFacultyHeadProfile(connection, ma_tai_khoan);
        }
        await this.accountRepository.deleteAccount(connection, ma_tai_khoan);
      });
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        AdminException.badRequest('Không thể xóa tài khoản vì đang được dữ liệu khác tham chiếu');
      }
      throw error;
    }

    return { message: 'Xóa tài khoản nhân viên thành công' };
  }

  /**
   * Import Faculty Head accounts via CSV upload.
   * @async
   * @param {Object} file 
   * @returns {Promise<Object>} Created count status.
   */
  async importFacultyHeadAccounts(file) {
    if (!file) AdminException.badRequest('Vui lòng tải lên file CSV');
    const records = parseCsv(file.buffer);
    let created = 0;

    for (const row of records) {
      const payload = {
        ma_nhan_vien: AdminValidator.valueOf(row, ['ma_nhan_vien', 'Ma nhan vien', 'Mã nhân viên']),
        ho_va_ten: AdminValidator.valueOf(row, ['ho_va_ten', 'Ho ten', 'Ho va ten', 'Họ tên', 'Họ và tên', 'Ten truong khoa', 'Tên trưởng khoa']),
        email: AdminValidator.valueOf(row, ['email', 'Email']),
        ten_khoa: AdminValidator.valueOf(row, ['ten_khoa', 'Ten khoa', 'Tên khoa', 'Khoa'])
      };

      if (!payload.ma_nhan_vien || !payload.ho_va_ten || !payload.email || !payload.ten_khoa) {
        AdminException.badRequest('CSV Trưởng Khoa cần có: mã nhân viên, họ và tên, email, tên khoa');
      }

      await transaction(async (connection) => {
        const faculty = await this._findFacultyByFullNameWithConnection(connection, payload.ten_khoa);
        const existsHead = await this.accountRepository.existsFacultyHeadByEmployeeId(connection, payload.ma_nhan_vien);
        if (existsHead) {
          AdminException.badRequest(`Trưởng Khoa ${payload.ma_nhan_vien} đã tồn tại`);
        }

        await this._assertAccountAvailable(connection, {
          ten_tai_khoan: payload.ma_nhan_vien,
          email: payload.email
        });

        const accountId = await this._createAccount(connection, {
          ten_tai_khoan: payload.ma_nhan_vien,
          email: payload.email,
          role: 'khoa',
          defaultPassword: defaultPasswordForRole('khoa', { ma_khoa: faculty.ma_khoa })
        });

        await this.accountRepository.createFacultyHeadProfile(connection, {
          ma_nhan_vien: payload.ma_nhan_vien,
          ma_tai_khoan: accountId,
          ma_khoa: faculty.ma_khoa,
          ho_va_ten: payload.ho_va_ten
        });
      });

      created += 1;
    }

    return { message: 'Import tài khoản Trưởng Khoa thành công', created };
  }
}
