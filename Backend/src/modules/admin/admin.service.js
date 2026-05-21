import { query, transaction } from '../../config/db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';
import { defaultPasswordForRole, hashPassword } from '../../utils/passwords.js';
import { parseCsv } from '../../utils/csv.js';

async function createAccount(connection, { ten_tai_khoan, email, role, defaultPassword, ma_tai_khoan }) {
  const password = await hashPassword(defaultPassword);
  const accountId = ma_tai_khoan || makeId('TK');
  try {
    await connection.execute(
      `INSERT INTO TAI_KHOAN
       (ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan, da_doi_mk, is_active)
       VALUES (?, ?, ?, ?, ?, false, true)`,
      [accountId, ten_tai_khoan, password, email, role]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw badRequest(`Tên tài khoản hoặc email đã tồn tại: ${ten_tai_khoan}, ${email}`);
    }
    throw error;
  }
  return accountId;
}

function valueOf(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function normalizePriority(input) {
  const value = input === undefined || input === null || String(input).trim() === '' ? 2 : Number(input);
  if (!Number.isInteger(value) || value < 1 || value > 3) {
    throw badRequest('Ưu tiên CVHT phải là số nguyên từ 1 đến 3');
  }
  return value;
}

async function assertAccountAvailable(connection, { ten_tai_khoan, email }) {
  const [rows] = await connection.execute(
    `SELECT ten_tai_khoan, email, loai_tai_khoan
     FROM TAI_KHOAN
     WHERE ten_tai_khoan = ? OR email = ?
     LIMIT 1`,
    [ten_tai_khoan, email]
  );
  const existing = rows[0];
  if (!existing) return;

  if (existing.ten_tai_khoan === ten_tai_khoan) {
    throw badRequest(`Tên tài khoản ${ten_tai_khoan} đã tồn tại`);
  }
  throw badRequest(`Email ${email} đã tồn tại trong tài khoản ${existing.ten_tai_khoan}`);
}

async function findFacultyByFullName(input) {
  const value = String(input || '').trim();
  if (!value) throw badRequest('Thiếu tên khoa');
  const rows = await query(
    'SELECT ma_khoa, ten_khoa FROM KHOA WHERE LOWER(ten_khoa) = LOWER(:value)',
    { value }
  );
  if (!rows[0]) throw badRequest(`Không tìm thấy khoa "${value}". CSV phải ghi tên khoa đầy đủ.`);
  return rows[0];
}

async function findFacultyByFullNameWithConnection(connection, input) {
  const value = String(input || '').trim();
  if (!value) throw badRequest('Thiếu tên khoa');
  const [rows] = await connection.execute(
    'SELECT ma_khoa, ten_khoa FROM KHOA WHERE LOWER(ten_khoa) = LOWER(?)',
    [value]
  );
  if (!rows[0]) throw badRequest(`Không tìm thấy khoa "${value}". CSV phải ghi tên khoa đầy đủ.`);
  return rows[0];
}

export async function listFaculties() {
  return query('SELECT ma_khoa, ten_khoa FROM KHOA ORDER BY ten_khoa');
}

export async function listFacultyEmployees(ma_khoa) {
  return query(
    `SELECT tk.ma_khoa,
            tk.ma_nhan_vien AS ma,
            tk.ho_va_ten,
            NULL AS chuyen_nganh,
            acc.email,
            acc.ten_tai_khoan,
            'Trưởng Khoa' AS vai_tro,
            acc.is_active,
            acc.ma_tai_khoan
     FROM TRUONG_KHOA tk
     JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
     WHERE tk.ma_khoa = :ma_khoa
     UNION ALL
     SELECT cv.ma_khoa,
            cv.ma_co_van AS ma,
            cv.ho_va_ten,
            cv.chuyen_nganh,
            acc.email,
            acc.ten_tai_khoan,
            'Cố vấn học tập' AS vai_tro,
            COALESCE(acc.is_active, false) AS is_active,
            acc.ma_tai_khoan
     FROM CVHT cv
     LEFT JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
     WHERE cv.ma_khoa = :ma_khoa
     ORDER BY vai_tro DESC, ho_va_ten`,
    { ma_khoa }
  );
}

export async function importFacultyHeadAccounts(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    const payload = {
      ma_nhan_vien: valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']),
      ho_va_ten: valueOf(row, ['ho_va_ten', 'Họ tên', 'Họ và tên', 'Ho ten', 'Ho va ten', 'Tên trưởng khoa', 'Ten truong khoa']),
      email: valueOf(row, ['email', 'Email']),
      ten_khoa: valueOf(row, ['ten_khoa', 'Tên khoa', 'Ten khoa', 'Khoa'])
    };
    if (!payload.ma_nhan_vien || !payload.ho_va_ten || !payload.email || !payload.ten_khoa) {
      throw badRequest('CSV Trưởng Khoa cần có: ma_nhan_vien, ho_va_ten, email, ten_khoa');
    }

    await transaction(async (connection) => {
      const faculty = await findFacultyByFullNameWithConnection(connection, payload.ten_khoa);
      const [existingHeads] = await connection.execute(
        'SELECT ma_nhan_vien FROM TRUONG_KHOA WHERE ma_nhan_vien = ?',
        [payload.ma_nhan_vien]
      );
      if (existingHeads[0]) throw badRequest(`Trưởng Khoa ${payload.ma_nhan_vien} đã tồn tại`);
      await assertAccountAvailable(connection, {
        ten_tai_khoan: payload.ma_nhan_vien,
        email: payload.email
      });

      const accountId = await createAccount(connection, {
        ten_tai_khoan: payload.ma_nhan_vien,
        email: payload.email,
        role: 'khoa',
        defaultPassword: defaultPasswordForRole('khoa', { ma_khoa: faculty.ma_khoa })
      });
      await connection.execute(
        'INSERT INTO TRUONG_KHOA (ma_nhan_vien, ma_tai_khoan, ma_khoa, ho_va_ten) VALUES (?, ?, ?, ?)',
        [payload.ma_nhan_vien, accountId, faculty.ma_khoa, payload.ho_va_ten]
      );
    });
    created += 1;
  }

  return { message: 'Import tài khoản Trưởng Khoa thành công', created };
}

export async function createAdvisorInfo(payload) {
  const required = ['ma_co_van', 'ho_va_ten', 'so_dien_thoai', 'ten_khoa', 'chuyen_nganh'];
  for (const field of required) {
    if (!payload[field]) throw badRequest(`Thiếu trường ${field}`);
  }
  const faculty = await findFacultyByFullName(payload.ten_khoa);
  const existing = await query('SELECT ma_co_van FROM CVHT WHERE ma_co_van = :ma_co_van', {
    ma_co_van: payload.ma_co_van
  });
  if (existing[0]) throw badRequest(`CVHT ${payload.ma_co_van} đã tồn tại`);

  await query(
    `INSERT INTO CVHT
     (ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh)
     VALUES (:ma_co_van, NULL, :ma_khoa, :ho_va_ten, :so_dien_thoai, :uu_tien, :chuyen_nganh)`,
    {
      ma_co_van: payload.ma_co_van,
      ma_khoa: faculty.ma_khoa,
      ho_va_ten: payload.ho_va_ten,
      so_dien_thoai: payload.so_dien_thoai,
      uu_tien: normalizePriority(payload.uu_tien),
      chuyen_nganh: payload.chuyen_nganh
    }
  );
  return { message: 'Tạo thông tin CVHT thành công' };
}

export async function importAdvisorInfo(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    await createAdvisorInfo({
      ma_co_van: valueOf(row, ['ma_co_van', 'Mã cố vấn', 'Ma co van', 'Mã nhân viên', 'Ma nhan vien']),
      ho_va_ten: valueOf(row, ['ho_va_ten', 'Tên CVHT', 'Ten CVHT', 'Họ và tên', 'Ho va ten', 'Họ tên', 'Ho ten']),
      so_dien_thoai: valueOf(row, ['so_dien_thoai', 'Số điện thoại', 'số điện thoại', 'So dien thoai']),
      ten_khoa: valueOf(row, ['ten_khoa', 'Tên khoa', 'Ten khoa', 'Khoa']),
      chuyen_nganh: valueOf(row, ['chuyen_nganh', 'Chuyên ngành', 'Chuyen nganh']),
      uu_tien: valueOf(row, ['uu_tien', 'Ưu tiên', 'Uu tien', 'Độ ưu tiên', 'Do uu tien']) || 2
    });
    created += 1;
  }

  return { message: 'Import thông tin CVHT thành công', created };
}

export async function importAdvisorAccounts(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    const ma_co_van = valueOf(row, ['ma_co_van', 'Mã cố vấn', 'Ma co van', 'Mã nhân viên', 'Ma nhan vien']);
    const email = valueOf(row, ['email', 'Email']);
    if (!ma_co_van || !email) throw badRequest('CSV tài khoản CVHT cần có: ma_co_van, email');

    await transaction(async (connection) => {
      const [advisors] = await connection.execute('SELECT * FROM CVHT WHERE ma_co_van = ?', [ma_co_van]);
      const advisor = advisors[0];
      if (!advisor) throw badRequest(`Chưa có thông tin CVHT ${ma_co_van}, cần import thông tin trước`);
      if (advisor.ma_tai_khoan) throw badRequest(`CVHT ${ma_co_van} đã có tài khoản`);
      await assertAccountAvailable(connection, { ten_tai_khoan: ma_co_van, email });

      const accountId = await createAccount(connection, {
        ten_tai_khoan: ma_co_van,
        email,
        role: 'covan',
        defaultPassword: defaultPasswordForRole('covan')
      });
      await connection.execute('UPDATE CVHT SET ma_tai_khoan = ? WHERE ma_co_van = ?', [accountId, ma_co_van]);
    });
    created += 1;
  }

  return { message: 'Import tài khoản CVHT thành công', created };
}

export async function importAdvisorInfoAndAccounts(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    const payload = {
      ma_co_van: valueOf(row, ['ma_co_van', 'Mã cố vấn', 'Ma co van', 'Mã nhân viên', 'Ma nhan vien']),
      ho_va_ten: valueOf(row, ['ho_va_ten', 'Tên CVHT', 'Ten CVHT', 'Họ và tên', 'Ho va ten', 'Họ tên', 'Ho ten']),
      so_dien_thoai: valueOf(row, ['so_dien_thoai', 'Số điện thoại', 'số điện thoại', 'So dien thoai']),
      email: valueOf(row, ['email', 'Email']),
      ten_khoa: valueOf(row, ['ten_khoa', 'Tên khoa', 'Ten khoa', 'Khoa']),
      chuyen_nganh: valueOf(row, ['chuyen_nganh', 'Chuyên ngành', 'Chuyen nganh']),
      uu_tien: valueOf(row, ['uu_tien', 'Ưu tiên', 'Uu tien', 'Độ ưu tiên', 'Do uu tien']) || 2
    };
    if (!payload.ma_co_van || !payload.ho_va_ten || !payload.so_dien_thoai || !payload.email || !payload.ten_khoa || !payload.chuyen_nganh) {
      throw badRequest('CSV CVHT cần có: Mã cố vấn, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên');
    }

    await transaction(async (connection) => {
      const faculty = await findFacultyByFullNameWithConnection(connection, payload.ten_khoa);
      const [existingRows] = await connection.execute('SELECT * FROM CVHT WHERE ma_co_van = ?', [payload.ma_co_van]);
      const existing = existingRows[0];
      if (existing?.ma_tai_khoan) throw badRequest(`CVHT ${payload.ma_co_van} đã có tài khoản`);
      await assertAccountAvailable(connection, {
        ten_tai_khoan: payload.ma_co_van,
        email: payload.email
      });

      if (existing) {
        await connection.execute(
          `UPDATE CVHT
           SET ma_khoa = ?, ho_va_ten = ?, so_dien_thoai = ?, uu_tien = ?, chuyen_nganh = ?
           WHERE ma_co_van = ?`,
          [faculty.ma_khoa, payload.ho_va_ten, payload.so_dien_thoai, normalizePriority(payload.uu_tien), payload.chuyen_nganh, payload.ma_co_van]
        );
      } else {
        await connection.execute(
          `INSERT INTO CVHT
           (ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh)
           VALUES (?, NULL, ?, ?, ?, ?, ?)`,
          [payload.ma_co_van, faculty.ma_khoa, payload.ho_va_ten, payload.so_dien_thoai, normalizePriority(payload.uu_tien), payload.chuyen_nganh]
        );
      }

      const accountId = await createAccount(connection, {
        ten_tai_khoan: payload.ma_co_van,
        email: payload.email,
        role: 'covan',
        defaultPassword: defaultPasswordForRole('covan')
      });
      await connection.execute('UPDATE CVHT SET ma_tai_khoan = ? WHERE ma_co_van = ?', [accountId, payload.ma_co_van]);
    });
    created += 1;
  }

  return { message: 'Import thông tin và tài khoản CVHT thành công', created };
}

export async function updateAccountStatus(currentUser, ma_tai_khoan, is_active) {
  const rows = await query(
    'SELECT loai_tai_khoan FROM TAI_KHOAN WHERE ma_tai_khoan = :ma_tai_khoan',
    { ma_tai_khoan }
  );
  if (!rows[0]) throw notFound('Không tìm thấy tài khoản');
  if (rows[0].loai_tai_khoan === 'admin') throw forbidden('Admin không thể khóa tài khoản Admin');
  if (currentUser.ma_tai_khoan === ma_tai_khoan) throw forbidden('Không thể tự khóa tài khoản đang đăng nhập');

  const result = await query(
    'UPDATE TAI_KHOAN SET is_active = :is_active WHERE ma_tai_khoan = :ma_tai_khoan',
    { ma_tai_khoan, is_active: Boolean(is_active) }
  );
  if (!result.affectedRows) throw notFound('Không tìm thấy tài khoản');
  return { message: 'Cập nhật trạng thái tài khoản thành công' };
}

export async function listAccounts() {
  return query(
    `SELECT ma_tai_khoan, ten_tai_khoan, email, loai_tai_khoan, da_doi_mk, is_active
     FROM TAI_KHOAN ORDER BY loai_tai_khoan, ten_tai_khoan`
  );
}
