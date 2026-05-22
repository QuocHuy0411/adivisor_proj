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
      throw badRequest(`Ten tai khoan hoac email da ton tai: ${ten_tai_khoan}, ${email}`);
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
    throw badRequest('Ưu tiên cố vấn học tập phải là số nguyên từ 1 đến 3');
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

export async function listEmployeeGroups() {
  const faculties = await query(
    `SELECT ma_khoa AS ma_don_vi,
            ten_khoa AS ten_don_vi
     FROM KHOA
     ORDER BY ten_khoa`
  );
  return [
    ...faculties,
    { ma_don_vi: 'CTSV', ten_don_vi: 'Cong tac sinh vien' }
  ];
}

export async function listEmployeeGroupAccounts(ma_don_vi) {
  if (ma_don_vi === 'CTSV') {
    return query(
      `SELECT nv.ma_nhan_vien AS ma,
              nv.ho_va_ten,
              NULL AS so_dien_thoai,
              NULL AS chuyen_nganh,
              acc.email,
              acc.ten_tai_khoan,
              acc.loai_tai_khoan,
              'Nhan vien CTSV' AS vai_tro,
              acc.is_active,
              acc.ma_tai_khoan
       FROM NHAN_VIEN_CTSV nv
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = nv.ma_tai_khoan
       ORDER BY acc.is_active DESC, nv.ma_nhan_vien ASC`
    );
  }

  return query(
    `SELECT *
     FROM (
       SELECT tk.ma_nhan_vien AS ma,
              tk.ho_va_ten,
              NULL AS so_dien_thoai,
              NULL AS chuyen_nganh,
              acc.email,
              acc.ten_tai_khoan,
              acc.loai_tai_khoan,
              'Truong Khoa' AS vai_tro,
              acc.is_active,
              acc.ma_tai_khoan
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE tk.ma_khoa = :ma_don_vi
       UNION ALL
       SELECT cv.ma_co_van AS ma,
              cv.ho_va_ten,
              cv.so_dien_thoai,
              cv.chuyen_nganh,
              acc.email,
              acc.ten_tai_khoan,
              acc.loai_tai_khoan,
              'Co van hoc tap' AS vai_tro,
              acc.is_active,
              acc.ma_tai_khoan
       FROM CVHT cv
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
       WHERE cv.ma_khoa = :ma_don_vi
     ) employees
     ORDER BY
       CASE
         WHEN loai_tai_khoan = 'khoa' AND is_active = true THEN 0
         WHEN is_active = true THEN 1
         ELSE 2
       END,
       ma ASC`,
    { ma_don_vi }
  );
}

export async function listAdvisorInfo(ma_khoa) {
  const filter = ma_khoa ? 'WHERE cv.ma_khoa = :ma_khoa' : '';
  return query(
    `SELECT cv.ma_co_van,
            cv.ho_va_ten,
            acc.email,
            cv.so_dien_thoai,
            cv.chuyen_nganh,
            cv.uu_tien,
            cv.ma_khoa,
            k.ten_khoa
     FROM CVHT cv
     JOIN KHOA k ON k.ma_khoa = cv.ma_khoa
     LEFT JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
     ${filter}
     ORDER BY COALESCE(acc.is_active, false) DESC, cv.ma_co_van ASC`,
    { ma_khoa }
  );
}

export async function updateEmployeeAccount(ma_tai_khoan, payload) {
  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :ma_tai_khoan', { ma_tai_khoan });
  const account = rows[0];
  if (!account) throw notFound('Không tìm thấy tài khoản');
  if (account.loai_tai_khoan === 'admin') throw forbidden('Admin không sửa tài khoản Admin ở danh sách này');
  if (account.loai_tai_khoan === 'covan') throw forbidden('Admin không sửa tài khoản cố vấn học tập tại danh sách tài khoản');

  const ho_va_ten = String(payload.ho_va_ten || '').trim();
  const email = String(payload.email || '').trim();
  if (!ho_va_ten || !email) throw badRequest('Vui lòng nhập họ tên và email');

  await transaction(async (connection) => {
    const [duplicates] = await connection.execute(
      'SELECT ma_tai_khoan FROM TAI_KHOAN WHERE email = ? AND ma_tai_khoan <> ? LIMIT 1',
      [email, ma_tai_khoan]
    );
    if (duplicates[0]) throw badRequest(`Email ${email} đã tồn tại`);

    await connection.execute('UPDATE TAI_KHOAN SET email = ? WHERE ma_tai_khoan = ?', [email, ma_tai_khoan]);
    if (account.loai_tai_khoan === 'ctsv') {
      await connection.execute('UPDATE NHAN_VIEN_CTSV SET ho_va_ten = ? WHERE ma_tai_khoan = ?', [ho_va_ten, ma_tai_khoan]);
    } else if (account.loai_tai_khoan === 'khoa') {
      await connection.execute('UPDATE TRUONG_KHOA SET ho_va_ten = ? WHERE ma_tai_khoan = ?', [ho_va_ten, ma_tai_khoan]);
    }
  });

  return { message: 'Cập nhật tài khoản nhân viên thành công' };
}

export async function deleteEmployeeAccount(currentUser, ma_tai_khoan) {
  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :ma_tai_khoan', { ma_tai_khoan });
  const account = rows[0];
  if (!account) throw notFound('Không tìm thấy tài khoản');
  if (account.loai_tai_khoan === 'admin') throw forbidden('Admin không thể xóa tài khoản Admin');
  if (account.loai_tai_khoan === 'covan') throw forbidden('Admin không xóa tài khoản cố vấn học tập tại danh sách tài khoản');
  if (currentUser.ma_tai_khoan === ma_tai_khoan) throw forbidden('Không thể tự xóa tài khoản đang đăng nhập');

  try {
    await transaction(async (connection) => {
      if (account.loai_tai_khoan === 'ctsv') {
        await connection.execute('DELETE FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = ?', [ma_tai_khoan]);
      } else if (account.loai_tai_khoan === 'khoa') {
        await connection.execute('DELETE FROM TRUONG_KHOA WHERE ma_tai_khoan = ?', [ma_tai_khoan]);
      }
      await connection.execute('DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?', [ma_tai_khoan]);
    });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      throw badRequest('Không thể xóa tài khoản vì đang được dữ liệu khác tham chiếu');
    }
    throw error;
  }

  return { message: 'Xóa tài khoản nhân viên thành công' };
}

export async function updateAdvisorInfo(ma_co_van, payload) {
  const rows = await query('SELECT * FROM CVHT WHERE ma_co_van = :ma_co_van', { ma_co_van });
  if (!rows[0]) throw notFound('Không tìm thấy thông tin cố vấn học tập');

  const next = {
    ho_va_ten: String(payload.ho_va_ten || '').trim(),
    so_dien_thoai: String(payload.so_dien_thoai || '').trim(),
    ma_khoa: String(payload.ma_khoa || '').trim(),
    chuyen_nganh: String(payload.chuyen_nganh || '').trim()
  };
  if (!next.ho_va_ten || !next.so_dien_thoai || !next.ma_khoa || !next.chuyen_nganh) {
    throw badRequest('Vui lòng nhập đầy đủ thông tin cố vấn học tập');
  }

  const faculties = await query('SELECT ma_khoa FROM KHOA WHERE ma_khoa = :ma_khoa', { ma_khoa: next.ma_khoa });
  if (!faculties[0]) throw badRequest('Khoa không tồn tại');

  await query(
    `UPDATE CVHT
     SET ho_va_ten = :ho_va_ten,
         so_dien_thoai = :so_dien_thoai,
         ma_khoa = :ma_khoa,
         chuyen_nganh = :chuyen_nganh
     WHERE ma_co_van = :ma_co_van`,
    { ...next, ma_co_van }
  );

  return { message: 'Cập nhật thông tin cố vấn học tập thành công' };
}

export async function deleteAdvisorInfo(ma_co_van) {
  const rows = await query('SELECT * FROM CVHT WHERE ma_co_van = :ma_co_van', { ma_co_van });
  const advisor = rows[0];
  if (!advisor) throw notFound('Không tìm thấy thông tin cố vấn học tập');

  await transaction(async (connection) => {
    await connection.execute('DELETE FROM YEU_CAU_THAY_THE WHERE ma_co_van = ?', [ma_co_van]);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = NULL WHERE ma_co_van = ?', [ma_co_van]);
    await connection.execute('UPDATE LOP SET ma_co_van = NULL WHERE ma_co_van = ?', [ma_co_van]);
    if (advisor.ma_tai_khoan) {
      await connection.execute('UPDATE CVHT SET ma_tai_khoan = NULL WHERE ma_co_van = ?', [ma_co_van]);
      await connection.execute('DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?', [advisor.ma_tai_khoan]);
    }
    await connection.execute('DELETE FROM CVHT WHERE ma_co_van = ?', [ma_co_van]);
  });

  return { message: 'Xóa thông tin cố vấn học tập và tài khoản tương ứng thành công' };
}

export async function listFacultyEmployees(ma_khoa) {
  return query(
    `SELECT tk.ma_khoa,
            tk.ma_nhan_vien AS ma,
            tk.ho_va_ten,
            NULL AS chuyen_nganh,
            acc.email,
            acc.ten_tai_khoan,
            'Truong Khoa' AS vai_tro,
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
            'Co van hoc tap' AS vai_tro,
            COALESCE(acc.is_active, false) AS is_active,
            acc.ma_tai_khoan
     FROM CVHT cv
     LEFT JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = cv.ma_tai_khoan
     WHERE cv.ma_khoa = :ma_khoa
     ORDER BY is_active DESC, ma ASC`,
    { ma_khoa }
  );
}

export async function importFacultyHeadAccounts(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    const payload = {
      ma_nhan_vien: valueOf(row, ['ma_nhan_vien', 'Ma nhan vien', 'Mã nhân viên']),
      ho_va_ten: valueOf(row, ['ho_va_ten', 'Ho ten', 'Ho va ten', 'Họ tên', 'Họ và tên', 'Ten truong khoa', 'Tên trưởng khoa']),
      email: valueOf(row, ['email', 'Email']),
      ten_khoa: valueOf(row, ['ten_khoa', 'Ten khoa', 'Tên khoa', 'Khoa'])
    };
    if (!payload.ma_nhan_vien || !payload.ho_va_ten || !payload.email || !payload.ten_khoa) {
      throw badRequest('CSV Trưởng Khoa cần có: mã nhân viên, họ và tên, email, tên khoa');
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
  if (existing[0]) throw badRequest(`Cố vấn học tập ${payload.ma_co_van} đã tồn tại`);

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
  return { message: 'Tạo thông tin cố vấn học tập thành công' };
}

export async function importAdvisorInfo(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    await createAdvisorInfo({
      ma_co_van: valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']),
      ho_va_ten: valueOf(row, ['ho_va_ten', 'Ten CVHT', 'Tên CVHT', 'Ho va ten', 'Họ và tên', 'Ho ten', 'Họ tên']),
      so_dien_thoai: valueOf(row, ['so_dien_thoai', 'So dien thoai', 'Số điện thoại']),
      ten_khoa: valueOf(row, ['ten_khoa', 'Ten khoa', 'Tên khoa', 'Khoa']),
      chuyen_nganh: valueOf(row, ['chuyen_nganh', 'Chuyen nganh', 'Chuyên ngành']),
      uu_tien: valueOf(row, ['uu_tien', 'Uu tien', 'Ưu tiên', 'Do uu tien', 'Độ ưu tiên']) || 2
    });
    created += 1;
  }

  return { message: 'Import thông tin cố vấn học tập thành công', created };
}

export async function importAdvisorAccounts(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    const ma_co_van = valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']);
    const email = valueOf(row, ['email', 'Email']);
    if (!ma_co_van || !email) throw badRequest('CSV tài khoản cố vấn học tập cần có: mã nhân viên, email');

    await transaction(async (connection) => {
      const [advisors] = await connection.execute('SELECT * FROM CVHT WHERE ma_co_van = ?', [ma_co_van]);
      const advisor = advisors[0];
      if (!advisor) throw badRequest(`Chưa có thông tin cố vấn học tập ${ma_co_van}, cần import thông tin trước`);
      if (advisor.ma_tai_khoan) throw badRequest(`Cố vấn học tập ${ma_co_van} đã có tài khoản`);
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

  return { message: 'Import tài khoản cố vấn học tập thành công', created };
}

export async function importAdvisorInfoAndAccounts(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const records = parseCsv(file.buffer);
  let created = 0;

  for (const row of records) {
    const payload = {
      ma_co_van: valueOf(row, ['ma_nhan_vien', 'Mã nhân viên', 'Ma nhan vien']),
      ho_va_ten: valueOf(row, ['ho_va_ten', 'Ten CVHT', 'Tên CVHT', 'Ho va ten', 'Họ và tên', 'Ho ten', 'Họ tên']),
      so_dien_thoai: valueOf(row, ['so_dien_thoai', 'So dien thoai', 'Số điện thoại']),
      email: valueOf(row, ['email', 'Email']),
      ten_khoa: valueOf(row, ['ten_khoa', 'Ten khoa', 'Tên khoa', 'Khoa']),
      chuyen_nganh: valueOf(row, ['chuyen_nganh', 'Chuyen nganh', 'Chuyên ngành']),
      uu_tien: valueOf(row, ['uu_tien', 'Uu tien', 'Ưu tiên', 'Do uu tien', 'Độ ưu tiên']) || 2
    };
    if (!payload.ma_co_van || !payload.ho_va_ten || !payload.so_dien_thoai || !payload.email || !payload.ten_khoa || !payload.chuyen_nganh) {
      throw badRequest('CSV cố vấn học tập cần có: Mã nhân viên, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên');
    }

    await transaction(async (connection) => {
      const faculty = await findFacultyByFullNameWithConnection(connection, payload.ten_khoa);
      const [existingRows] = await connection.execute('SELECT * FROM CVHT WHERE ma_co_van = ?', [payload.ma_co_van]);
      const existing = existingRows[0];
      if (existing?.ma_tai_khoan) throw badRequest(`Cố vấn học tập ${payload.ma_co_van} đã có tài khoản`);
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

  return { message: 'Import thông tin và tài khoản cố vấn học tập thành công', created };
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
     FROM TAI_KHOAN
     ORDER BY is_active DESC, ten_tai_khoan ASC`
  );
}
