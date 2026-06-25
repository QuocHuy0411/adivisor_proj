import { query, transaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';
import { defaultPasswordForRole, hashPassword } from '../../utils/passwords.js';
import { parseCsv } from '../../utils/csv.js';
import { assertTransition, LOP, PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';

// Tao tai khoan sinh vien tu ma sinh vien va mat khau mac dinh theo so dien thoai.
async function createStudentAccount(connection, student) {
  const [existingUsernames] = await connection.execute('SELECT ma_tai_khoan FROM TAI_KHOAN WHERE ten_tai_khoan = ?', [student.ma_sinh_vien]);
  if (existingUsernames[0]) throw badRequest(`Tài khoản sinh viên ${student.ma_sinh_vien} đã tồn tại`);

  if (student.email) {
    const [existingEmails] = await connection.execute('SELECT ten_tai_khoan FROM TAI_KHOAN WHERE email = ?', [student.email]);
    if (existingEmails[0]) throw badRequest(`Email ${student.email} đã tồn tại trong hệ thống`);
  }

  const password = await hashPassword(defaultPasswordForRole('sinhvien', student));
  const accountId = makeId('TK');
  await connection.execute(
    `INSERT INTO TAI_KHOAN
     (ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan, da_doi_mk, is_active)
     VALUES (?, ?, ?, ?, 'sinhvien', false, true)`,
    [accountId, student.ma_sinh_vien, password, student.email]
  );
  return accountId;
}

function readCsvValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

// Tinh nam hoc hien tai theo moc thang 9; dung dong nhat cho lop, phan cong va thay the.
function currentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function studentPayloadFromRow(row, ma_lop) {
  return {
    ma_sinh_vien: readCsvValue(row, ['ma_sinh_vien', 'Mã sinh viên', 'Ma sinh vien', 'MSSV', 'mssv']),
    ho_va_ten: readCsvValue(row, ['ho_va_ten', 'Họ và tên', 'Tên sinh viên', 'Ho va ten', 'Ten sinh vien']),
    email: readCsvValue(row, ['email', 'Email']),
    so_dien_thoai: readCsvValue(row, ['so_dien_thoai', 'Số điện thoại', 'So dien thoai']),
    ma_lop: readCsvValue(row, ['ma_lop', 'Mã lớp', 'Ma lop']) || ma_lop
  };
}

function classPayloadFromRow(row) {
  return {
    ma_lop: readCsvValue(row, ['ma_lop', 'Mã lớp', 'Ma lop']),
    ten_lop: readCsvValue(row, ['ten_lop', 'Tên lớp', 'Ten lop']),
    ma_khoa: readCsvValue(row, ['ma_khoa', 'Mã khoa', 'Ma khoa']),
    chuyen_nganh: readCsvValue(row, ['chuyen_nganh', 'Chuyên ngành', 'Chuyen nganh']),
    nam_hoc: currentAcademicYear(),
    so_luong_sv: 0
  };
}

async function countStudentsInClass(connection, ma_lop) {
  const [rows] = await connection.execute('SELECT COUNT(*) AS total FROM SINH_VIEN WHERE ma_lop = ?', [ma_lop]);
  return Number(rows[0].total);
}

// Dong bo lop khong con sinh vien ve trang thai Lop trong va xoa co van dang gan.
async function syncEmptyClassStatus(connection) {
  await connection.execute(
    `UPDATE LOP l
     SET l.ma_co_van = NULL, l.trang_thai_lop = ?
     WHERE NOT EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = l.ma_lop)`,
    [LOP.LOP_TRONG]
  );
}

function closedAdvisorClassStatuses() {
  return [PHAN_CONG.DA_DONG, LOP.DA_CO_CVHT, 'Đã có CVHT'];
}

export async function listStudents() {
  return query(
    `SELECT sv.*, tk.email, tk.is_active, tk.ten_tai_khoan, l.ten_lop, l.ten_lop AS ten_lop_hien_thi
     FROM SINH_VIEN sv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan
     JOIN LOP l ON l.ma_lop = sv.ma_lop
     ORDER BY tk.is_active DESC, sv.ma_sinh_vien ASC`
  );
}

// CTSV tao sinh vien moi: tao tai khoan dang nhap, them SINH_VIEN va cap nhat si so/trang thai lop.
export async function createStudent(payload) {
  const required = ['ma_sinh_vien', 'ho_va_ten', 'email', 'so_dien_thoai', 'ma_lop'];
  for (const field of required) if (!payload[field]) throw badRequest(`Thiếu trường ${field}`);

  return transaction(async (connection) => {
    const [existingStudents] = await connection.execute('SELECT ma_sinh_vien FROM SINH_VIEN WHERE ma_sinh_vien = ?', [payload.ma_sinh_vien]);
    if (existingStudents[0]) throw badRequest(`Sinh viên ${payload.ma_sinh_vien} đã tồn tại trong danh sách`);

    const accountId = await createStudentAccount(connection, payload);
    await connection.execute(
      `INSERT INTO SINH_VIEN (ma_sinh_vien, ma_tai_khoan, ma_lop, ho_va_ten, so_dien_thoai)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.ma_sinh_vien, accountId, payload.ma_lop, payload.ho_va_ten, payload.so_dien_thoai]
    );
    await connection.execute('UPDATE LOP SET so_luong_sv = so_luong_sv + 1 WHERE ma_lop = ?', [payload.ma_lop]);
    await connection.execute(
      'UPDATE LOP SET trang_thai_lop = ? WHERE ma_lop = ? AND trang_thai_lop = ?',
      [LOP.CHUA_CO_CVHT, payload.ma_lop, LOP.LOP_TRONG]
    );
    return { message: 'Tạo sinh viên thành công' };
  });
}

// Import sinh vien tu CSV; moi dong di qua createStudent de tu dong tao tai khoan va tang si so.
export async function importStudents(file, ma_lop) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const rows = parseCsv(file.buffer);
  let created = 0;
  for (const row of rows) {
    await createStudent(studentPayloadFromRow(row, ma_lop));
    created += 1;
  }
  return { message: 'Import sinh viên thành công', created };
}

// Cap nhat thong tin sinh vien; neu chuyen lop thi can lai si so lop cu/lop moi va trang thai lop.
export async function updateStudent(id, payload) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute('SELECT * FROM SINH_VIEN WHERE ma_sinh_vien = ?', [id]);
    const student = rows[0];
    if (!student) throw notFound('Không tìm thấy sinh viên');

    await connection.execute(
      `UPDATE SINH_VIEN sv
       JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan
       SET sv.ho_va_ten = COALESCE(?, sv.ho_va_ten),
           sv.so_dien_thoai = COALESCE(?, sv.so_dien_thoai),
           sv.ma_lop = COALESCE(?, sv.ma_lop),
           tk.email = COALESCE(?, tk.email)
       WHERE sv.ma_sinh_vien = ?`,
      [payload.ho_va_ten || null, payload.so_dien_thoai || null, payload.ma_lop || null, payload.email || null, id]
    );

    if (payload.ma_lop && payload.ma_lop !== student.ma_lop) {
      await connection.execute('UPDATE LOP SET so_luong_sv = GREATEST(so_luong_sv - 1, 0) WHERE ma_lop = ?', [student.ma_lop]);
      await connection.execute('UPDATE LOP SET so_luong_sv = so_luong_sv + 1 WHERE ma_lop = ?', [payload.ma_lop]);
      await syncEmptyClassStatus(connection);
      await connection.execute(
        'UPDATE LOP SET trang_thai_lop = ? WHERE ma_lop = ? AND trang_thai_lop = ?',
        [LOP.CHUA_CO_CVHT, payload.ma_lop, LOP.LOP_TRONG]
      );
    }
    return { message: 'Cập nhật sinh viên thành công' };
  });
}

// Xoa sinh vien kem tai khoan dang nhap, sau do giam si so va dong bo lop neu lop bi rong.
export async function deleteStudent(id) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute('SELECT ma_tai_khoan, ma_lop FROM SINH_VIEN WHERE ma_sinh_vien = ?', [id]);
    const student = rows[0];
    if (!student) throw notFound('Không tìm thấy sinh viên');
    await connection.execute('DELETE FROM SINH_VIEN WHERE ma_sinh_vien = ?', [id]);
    await connection.execute('DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?', [student.ma_tai_khoan]);
    await connection.execute('UPDATE LOP SET so_luong_sv = GREATEST(so_luong_sv - 1, 0) WHERE ma_lop = ?', [student.ma_lop]);
    await syncEmptyClassStatus(connection);
    return { message: 'Xóa sinh viên và tài khoản thành công' };
  });
}

// Khoa/mo khoa tai khoan sinh vien ma khong xoa ho so SINH_VIEN.
export async function updateStudentAccountStatus(id, is_active) {
  const rows = await query(
    `SELECT tk.ma_tai_khoan
     FROM SINH_VIEN sv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan
     WHERE sv.ma_sinh_vien = :id`,
    { id }
  );
  if (!rows[0]) throw notFound('Không tìm thấy sinh viên');
  await query('UPDATE TAI_KHOAN SET is_active = :is_active WHERE ma_tai_khoan = :ma_tai_khoan', {
    is_active: Boolean(is_active),
    ma_tai_khoan: rows[0].ma_tai_khoan
  });
  return { message: 'Cập nhật trạng thái tài khoản sinh viên thành công' };
}

export async function listClasses() {
  return query(
    `SELECT l.*, k.ten_khoa,
            tk.ho_va_ten AS ten_truong_khoa,
            CASE WHEN cvtk.ma_tai_khoan IS NULL THEN NULL ELSE cv.ho_va_ten END AS ten_co_van,
            (SELECT COUNT(*) FROM SINH_VIEN sv WHERE sv.ma_lop = l.ma_lop) AS so_sinh_vien_thuc_te
     FROM LOP l
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     LEFT JOIN (
       SELECT tk.ma_khoa, MIN(tk.ho_va_ten) AS ho_va_ten
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE acc.is_active = true
       GROUP BY tk.ma_khoa
     ) tk ON tk.ma_khoa = l.ma_khoa
     LEFT JOIN CVHT cv ON cv.ma_co_van = l.ma_co_van
     LEFT JOIN TAI_KHOAN cvtk ON cvtk.ma_tai_khoan = cv.ma_tai_khoan AND cvtk.is_active = true
     ORDER BY l.nam_hoc DESC, l.ma_khoa, l.ten_lop`
  );
}

export async function listClassGroups() {
  const rows = await query(
    `SELECT k.ma_khoa, k.ten_khoa, tk.ho_va_ten AS ten_truong_khoa,
            COUNT(l.ma_lop) AS so_lop,
            GROUP_CONCAT(DISTINCT l.trang_thai_lop ORDER BY l.trang_thai_lop SEPARATOR ', ') AS trang_thai
     FROM KHOA k
     LEFT JOIN (
       SELECT tk.ma_khoa, MIN(tk.ho_va_ten) AS ho_va_ten
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE acc.is_active = true
       GROUP BY tk.ma_khoa
     ) tk ON tk.ma_khoa = k.ma_khoa
     LEFT JOIN LOP l ON l.ma_khoa = k.ma_khoa
     GROUP BY k.ma_khoa, k.ten_khoa, tk.ho_va_ten
     ORDER BY k.ma_khoa`
  );
  return rows.map((row) => ({
    ...row,
    id: row.ma_khoa,
    so_lop: Number(row.so_lop),
    ten_truong_khoa: row.ten_truong_khoa || '-',
    trang_thai: row.so_lop ? (row.trang_thai || '-') : 'Chưa có lớp'
  }));
}

// CTSV tao lop moi o trang thai Lop trong; khi co sinh vien se chuyen sang Chua co CVHT.
export async function createClass(payload) {
  const required = ['ma_lop', 'ma_khoa', 'ten_lop', 'chuyen_nganh'];
  for (const field of required) if (!payload[field]) throw badRequest(`Thiếu trường ${field}`);
  const nam_hoc = payload.nam_hoc || currentAcademicYear();
  await query(
    `INSERT INTO LOP (ma_lop, ma_khoa, ten_lop, so_luong_sv, chuyen_nganh, nam_hoc, ma_co_van, trang_thai_lop)
     VALUES (:ma_lop, :ma_khoa, :ten_lop, :so_luong_sv, :chuyen_nganh, :nam_hoc, NULL, :trang_thai_lop)`,
    { ...payload, nam_hoc, so_luong_sv: Number(payload.so_luong_sv || 0), trang_thai_lop: LOP.LOP_TRONG }
  );
  return { message: 'Tạo lớp thành công' };
}

// Import danh sach lop tu CSV, mac dinh nam hoc theo currentAcademicYear va si so ban dau bang 0.
export async function importClasses(file) {
  if (!file) throw badRequest('Vui lòng tải lên file CSV');
  const rows = parseCsv(file.buffer);
  let created = 0;
  for (const row of rows) {
    await createClass(classPayloadFromRow(row));
    created += 1;
  }
  return { message: 'Import lớp thành công', created };
}

// Cap nhat lop khi chua co sinh vien; tranh sua khoa/nam hoc cua lop da phat sinh du lieu.
export async function updateClass(id, payload) {
  return transaction(async (connection) => {
    const total = await countStudentsInClass(connection, id);
    if (total > 0) throw badRequest('Không thể chỉnh sửa lớp đã có sinh viên');
    const [result] = await connection.execute(
      `UPDATE LOP SET
         ma_khoa = COALESCE(?, ma_khoa),
         ten_lop = COALESCE(?, ten_lop),
         so_luong_sv = COALESCE(?, so_luong_sv),
         chuyen_nganh = COALESCE(?, chuyen_nganh),
         nam_hoc = COALESCE(?, nam_hoc),
         trang_thai_lop = COALESCE(?, trang_thai_lop)
       WHERE ma_lop = ?`,
      [
        payload.ma_khoa || null,
        payload.ten_lop || null,
        payload.so_luong_sv ?? null,
        payload.chuyen_nganh || null,
        payload.nam_hoc || null,
        payload.trang_thai_lop || null,
        id
      ]
    );
    if (!result.affectedRows) throw notFound('Không tìm thấy lớp');
    return { message: 'Cập nhật lớp thành công' };
  });
}

// Xoa lop chi khi lop chua co sinh vien de khong lam mat du lieu hoc tap lien quan.
export async function deleteClass(id) {
  return transaction(async (connection) => {
    const total = await countStudentsInClass(connection, id);
    if (total > 0) throw badRequest('Không thể xóa lớp đã có sinh viên');
    const [result] = await connection.execute('DELETE FROM LOP WHERE ma_lop = ?', [id]);
    if (!result.affectedRows) throw notFound('Không tìm thấy lớp');
    return { message: 'Xóa lớp thành công' };
  });
}

// Xoa hang loat sinh vien trong mot lop, kem tai khoan dang nhap va dua lop ve trang thai rong.
export async function deleteStudentsByClass(ma_lop) {
  return transaction(async (connection) => {
    const [students] = await connection.execute('SELECT ma_tai_khoan FROM SINH_VIEN WHERE ma_lop = ?', [ma_lop]);
    if (!students.length) throw badRequest('Lớp chưa có sinh viên để xóa');
    await connection.execute('DELETE FROM SINH_VIEN WHERE ma_lop = ?', [ma_lop]);
    for (const student of students) {
      await connection.execute('DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?', [student.ma_tai_khoan]);
    }
    await connection.execute('UPDATE LOP SET so_luong_sv = 0 WHERE ma_lop = ?', [ma_lop]);
    await syncEmptyClassStatus(connection);
    return { message: `Đã xóa ${students.length} sinh viên và tài khoản của lớp` };
  });
}

// CTSV xem toan bo PHAN_CONG cua luong phan cong moi, tach khoi cac ban ghi phuc vu yeu cau thay the.
export async function listAssignments() {
  return query(
    `SELECT pc.*, l.ten_lop, l.ma_khoa, k.ten_khoa, l.chuyen_nganh, l.so_luong_sv,
            CASE WHEN cvtk.ma_tai_khoan IS NULL THEN NULL ELSE cv.ho_va_ten END AS ten_co_van,
            COALESCE(pc.ten_truong_khoa, tk.ho_va_ten) AS ten_truong_khoa
     FROM PHAN_CONG pc
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN cvtk ON cvtk.ma_tai_khoan = cv.ma_tai_khoan AND cvtk.is_active = true
     LEFT JOIN (
       SELECT tk.ma_khoa, MIN(tk.ho_va_ten) AS ho_va_ten
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE acc.is_active = true
       GROUP BY tk.ma_khoa
     ) tk ON tk.ma_khoa = l.ma_khoa
     WHERE pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
     ORDER BY pc.nam_hoc DESC, l.ma_khoa, pc.trang_thai`
  );
}

// CTSV lap mot yeu cau phan cong cho lop co sinh vien: tao PHAN_CONG o trang thai Cho phan cong.
export async function createAssignmentRequest(payload) {
  if (!payload.ma_lop) throw badRequest('Cần chọn lớp');
  const studentRows = await query('SELECT COUNT(*) AS total FROM SINH_VIEN WHERE ma_lop = :ma_lop', { ma_lop: payload.ma_lop });
  if (Number(studentRows[0]?.total || 0) === 0) throw badRequest('Lớp trống không thể phân công cố vấn học tập');
  const ma_phan_cong = makeId('PC');
  const nam_hoc = currentAcademicYear();
  await query(
    `INSERT INTO PHAN_CONG (ma_phan_cong, ma_lop, ma_co_van, nam_hoc, trang_thai, ngay_phan_cong)
     VALUES (:ma_phan_cong, :ma_lop, NULL, :nam_hoc, :trang_thai, NULL)`,
    { ma_phan_cong, ma_lop: payload.ma_lop, nam_hoc, trang_thai: PHAN_CONG.CHO_PHAN_CONG }
  );
  await query('UPDATE LOP SET ma_co_van = NULL, trang_thai_lop = :status WHERE ma_lop = :ma_lop', {
    status: PHAN_CONG.CHO_PHAN_CONG,
    ma_lop: payload.ma_lop
  });
  return { message: 'Lập danh sách lớp cần cố vấn học tập thành công', ma_phan_cong };
}

// Gui mot yeu cau phan cong sang Khoa; chi chap nhan ban ghi dang o trang thai Cho phan cong.
export async function sendAssignmentToFaculty(id) {
  const rows = await query(
    `SELECT pc.*, EXISTS(SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = pc.ma_lop) AS has_students
     FROM PHAN_CONG pc
     WHERE pc.ma_phan_cong = :id`,
    { id }
  );
  const assignment = rows[0];
  if (!assignment) throw notFound('Không tìm thấy phân công');
  if (!Number(assignment.has_students)) throw badRequest('Lớp trống không thể phân công cố vấn học tập');
  if (assignment.trang_thai !== PHAN_CONG.CHO_PHAN_CONG) {
    throw badRequest('Chỉ gửi yêu cầu đang ở trạng thái chờ phân công');
  }
  await query('UPDATE PHAN_CONG SET trang_thai = :next WHERE ma_phan_cong = :id', {
    next: PHAN_CONG.CHO_PHAN_CONG,
    id
  });
  return { message: 'Đã gửi yêu cầu phân công cho Khoa' };
}

// Lam moi chu ky phan cong khi tat ca lop co sinh vien da dong chu trinh va khong con request dang xu ly.
export async function resetClassAdvisors() {
  return transaction(async (connection) => {
    await syncEmptyClassStatus(connection);
    const [nonEmptyClasses] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM LOP l
       WHERE EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = l.ma_lop)`
    );
    if (!Number(nonEmptyClasses[0]?.total || 0)) {
      throw badRequest('Không có lớp có sinh viên để làm mới phân công');
    }
    const closedStatuses = closedAdvisorClassStatuses();
    const [unfinishedClasses] = await connection.execute(
      `SELECT ma_lop
       FROM LOP l
       WHERE EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = l.ma_lop)
         AND (l.ma_co_van IS NULL OR l.trang_thai_lop NOT IN (?, ?, ?))
       LIMIT 1`,
      closedStatuses
    );
    if (unfinishedClasses.length) {
      throw badRequest('Chỉ làm mới khi tất cả lớp có sinh viên đã có cố vấn và ở trạng thái đã đóng');
    }
    const [pendingAssignments] = await connection.execute(
      `SELECT ma_phan_cong
       FROM PHAN_CONG
       WHERE trang_thai IN (?, ?, ?, ?)
         AND ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
         AND EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = PHAN_CONG.ma_lop)
       LIMIT 1`,
      [PHAN_CONG.CHO_PHAN_CONG, PHAN_CONG.DA_PHAN_CONG, PHAN_CONG.CHO_GIAM_DOC_DUYET, PHAN_CONG.BI_TU_CHOI]
    );
    if (pendingAssignments.length) {
      throw badRequest('Chỉ được làm mới khi không còn phân công đang xử lý hoặc bị từ chối');
    }
    await connection.execute(
      `DELETE FROM PHAN_CONG
       WHERE trang_thai IN (?, ?, ?, ?)
         AND ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
         AND EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = PHAN_CONG.ma_lop)`,
      [PHAN_CONG.CHO_PHAN_CONG, PHAN_CONG.DA_PHAN_CONG, PHAN_CONG.CHO_GIAM_DOC_DUYET, PHAN_CONG.BI_TU_CHOI]
    );
    const [classResult] = await connection.execute(
      `UPDATE LOP
       SET ma_co_van = NULL, trang_thai_lop = ?
       WHERE EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = LOP.ma_lop)`,
      [PHAN_CONG.CHO_PHAN_CONG]
    );
    return { message: `Đã làm mới ${classResult.affectedRows} lớp cần phân công` };
  });
}

// Gui hang loat lop chua co CVHT cho cac Khoa: chi tao PHAN_CONG moi khi chua co request active.
export async function sendClassRequestsToFaculties() {
  return transaction(async (connection) => {
    await syncEmptyClassStatus(connection);
    const [classes] = await connection.execute(
      `SELECT l.ma_lop
       FROM LOP l
       WHERE l.ma_co_van IS NULL AND l.trang_thai_lop IN (?, ?)
         AND EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = l.ma_lop)
       ORDER BY l.ma_khoa, l.ten_lop`,
      [LOP.CHUA_CO_CVHT, PHAN_CONG.CHO_PHAN_CONG]
    );
    if (!classes.length) throw badRequest('Không có lớp chưa có cố vấn để gửi Khoa');

    let sent = 0;
    for (const row of classes) {
      const nam_hoc = currentAcademicYear();
      const [existingRows] = await connection.execute(
        `SELECT pc.ma_phan_cong, pc.trang_thai
         FROM PHAN_CONG pc
         WHERE pc.ma_lop = ? AND pc.trang_thai IN (?, ?, ?)
           AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
         ORDER BY FIELD(trang_thai, ?, ?, ?)
         LIMIT 1`,
        [
          row.ma_lop,
          PHAN_CONG.CHO_PHAN_CONG,
          PHAN_CONG.DA_PHAN_CONG,
          PHAN_CONG.CHO_GIAM_DOC_DUYET,
          PHAN_CONG.CHO_PHAN_CONG,
          PHAN_CONG.DA_PHAN_CONG,
          PHAN_CONG.CHO_GIAM_DOC_DUYET
        ]
      );
      const existing = existingRows[0];
      if (existing) {
        continue;
      }

      await connection.execute(
        `INSERT INTO PHAN_CONG (ma_phan_cong, ma_lop, ma_co_van, nam_hoc, trang_thai, ngay_phan_cong)
         VALUES (?, ?, NULL, ?, ?, NULL)`,
        [makeId('PC'), row.ma_lop, nam_hoc, PHAN_CONG.CHO_PHAN_CONG]
      );
      await connection.execute(
        'UPDATE LOP SET trang_thai_lop = ? WHERE ma_lop = ?',
        [PHAN_CONG.CHO_PHAN_CONG, row.ma_lop]
      );
      sent += 1;
    }

    if (!sent) throw badRequest('Không có yêu cầu phân công mới cần gửi');
    return { message: `Đã gửi ${sent} yêu cầu phân công đến các Khoa` };
  });
}

// Tao thong bao va danh sach nguoi nhan, tu dong loai trung role/doi tuong trong cung mot lan gui.
async function createNotification(connection, ma_nhan_vien, { tieu_de, noi_dung, recipients }) {
  const ma_thong_bao = makeId('TB');
  await connection.execute(
    'INSERT INTO THONG_BAO (ma_thong_bao, ma_nhan_vien, tieu_de, noi_dung, ngay_gui) VALUES (?, ?, ?, ?, CURDATE())',
    [ma_thong_bao, ma_nhan_vien, tieu_de, noi_dung]
  );
  const uniqueRecipients = Array.from(
    new Map(recipients.map((recipient) => [`${recipient.loai_nguoi_nhan}:${recipient.ma_doi_tuong}`, recipient])).values()
  );
  for (const recipient of uniqueRecipients) {
    await connection.execute(
      `INSERT INTO THONG_BAO_NGUOI_NHAN
       (nguoi_nhan_id, ma_thong_bao, loai_nguoi_nhan, ma_doi_tuong)
       VALUES (?, ?, ?, ?)`,
      [makeId('NN'), ma_thong_bao, recipient.loai_nguoi_nhan, recipient.ma_doi_tuong]
    );
  }
  return ma_thong_bao;
}

// Kiem tra gioi han toi da 2 lop/CVHT truoc khi CTSV dong phan cong hoac thay the.
async function assertAdvisorCapacity(connection, ma_co_van, ma_lop) {
  const [rows] = await connection.execute(
    'SELECT COUNT(*) AS total FROM LOP WHERE ma_co_van = ? AND ma_lop <> ?',
    [ma_co_van, ma_lop]
  );
  if (Number(rows[0].total) >= 2) {
    throw badRequest('Cố vấn học tập đã phụ trách tối đa 2 lớp');
  }
}

// CTSV/Giam doc duyet cuoi phan cong: chuyen PHAN_CONG sang Da dong, gan CVHT vao LOP va gui thong bao ket qua.
async function approveAssignmentWithConnection(connection, user, id, { notify = true } = {}) {
  const nam_hoc = currentAcademicYear();
  const [rows] = await connection.execute(
    `SELECT pc.*, l.ma_khoa, l.ten_lop,
            EXISTS(SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = pc.ma_lop) AS has_students,
            cv.ho_va_ten AS ten_co_van, cvtk.is_active AS co_van_dang_hoat_dong
     FROM PHAN_CONG pc
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN cvtk ON cvtk.ma_tai_khoan = cv.ma_tai_khoan
     WHERE pc.ma_phan_cong = ?`,
    [id]
  );
  const assignment = rows[0];
  if (!assignment) throw notFound('Không tìm thấy phân công');
  if (!Number(assignment.has_students)) throw badRequest('Lớp trống không thể phân công cố vấn học tập');
  assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.DA_DONG);
  if (!assignment.ma_co_van) throw badRequest('Khoa chưa chọn cố vấn học tập');
  if (!assignment.co_van_dang_hoat_dong) throw badRequest('Cố vấn học tập được phân công phải có tài khoản đang hoạt động');
  await assertAdvisorCapacity(connection, assignment.ma_co_van, assignment.ma_lop);

  await connection.execute(
    'UPDATE LOP SET ma_co_van = ?, trang_thai_lop = ? WHERE ma_lop = ?',
    [assignment.ma_co_van, PHAN_CONG.DA_DONG, assignment.ma_lop]
  );
  await connection.execute(
    'UPDATE PHAN_CONG SET trang_thai = ?, nam_hoc = ?, ngay_phan_cong = CURDATE() WHERE ma_phan_cong = ?',
    [PHAN_CONG.DA_DONG, nam_hoc, id]
  );
  const notification = {
    tieu_de: 'Thông báo phân công cố vấn học tập',
    noi_dung: `Đã phân công cố vấn học tập cho năm học ${nam_hoc}.`,
    recipients: [
      { loai_nguoi_nhan: 'lop', ma_doi_tuong: assignment.ma_lop },
      { loai_nguoi_nhan: 'khoa', ma_doi_tuong: assignment.ma_khoa },
      { loai_nguoi_nhan: 'covan', ma_doi_tuong: assignment.ma_co_van }
    ]
  };
  if (notify) await createNotification(connection, user.ma_nhan_vien, notification);
  return { ...assignment, nam_hoc, notification };
}

// API duyet mot phan cong dang cho Giam doc duyet.
export async function approveAssignment(user, id) {
  return transaction(async (connection) => {
    await approveAssignmentWithConnection(connection, user, id);
    return { message: 'Duyệt và đóng phân công thành công' };
  });
}

// CTSV tu choi phan cong: tra ve Cho phan cong de Khoa chon lai CVHT, dong thoi thong bao cho Khoa.
export async function rejectAssignment(user, id) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT pc.*, l.ma_khoa, l.ten_lop,
              EXISTS(SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = pc.ma_lop) AS has_students
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE pc.ma_phan_cong = ?`,
      [id]
    );
    const assignment = rows[0];
    if (!assignment) throw notFound('Không tìm thấy phân công');
    if (!Number(assignment.has_students)) throw badRequest('Lớp trống không thể phân công cố vấn học tập');
    if (assignment.trang_thai !== PHAN_CONG.CHO_GIAM_DOC_DUYET) throw badRequest('Chỉ từ chối phân công đang chờ giám đốc duyệt');
    await connection.execute('UPDATE PHAN_CONG SET trang_thai = ?, ma_co_van = NULL WHERE ma_phan_cong = ?', [
      PHAN_CONG.CHO_PHAN_CONG,
      id
    ]);
    await connection.execute('UPDATE LOP SET ma_co_van = NULL, trang_thai_lop = ? WHERE ma_lop = ?', [
      PHAN_CONG.CHO_PHAN_CONG,
      assignment.ma_lop
    ]);
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Phòng CTSV đã từ chối phân công cố vấn',
      noi_dung: `Phòng CTSV đã từ chối phân công cố vấn cho lớp ${assignment.ten_lop}.`,
      recipients: [{ loai_nguoi_nhan: 'khoa', ma_doi_tuong: assignment.ma_khoa }]
    });
    return { message: 'Đã từ chối phân công' };
  });
}

// Duyet hang loat cac phan cong dang cho Giam doc, gom thong bao thanh mot lan gui.
export async function approveAllAssignments(user) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT pc.ma_phan_cong
       FROM PHAN_CONG pc
       WHERE pc.trang_thai = ?
         AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
         AND EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = pc.ma_lop)
       ORDER BY pc.ma_phan_cong`,
      [PHAN_CONG.CHO_GIAM_DOC_DUYET]
    );
    if (!rows.length) throw badRequest('Không có phân công nào cần duyệt');
    const notifications = [];
    for (const row of rows) {
      const result = await approveAssignmentWithConnection(connection, user, row.ma_phan_cong, { notify: false });
      notifications.push(result.notification);
    }
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Thông báo phân công cố vấn học tập',
      noi_dung: notifications[0].noi_dung,
      recipients: notifications.flatMap((notification) => notification.recipients)
    });
    return { message: `Đã duyệt ${rows.length} phân công` };
  });
}

// Tu choi hang loat phan cong dang cho Giam doc va tra toan bo ve Khoa xu ly lai.
export async function rejectAllAssignments(user) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT pc.ma_phan_cong, pc.ma_lop, l.ma_khoa, l.ten_lop
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE pc.trang_thai = ?
         AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
         AND EXISTS (SELECT 1 FROM SINH_VIEN sv WHERE sv.ma_lop = pc.ma_lop)`,
      [PHAN_CONG.CHO_GIAM_DOC_DUYET]
    );
    if (!rows.length) throw badRequest('Không có phân công nào cần từ chối');

    const recipients = [];
    for (const row of rows) {
      await connection.execute(
        'UPDATE PHAN_CONG SET trang_thai = ?, ma_co_van = NULL WHERE ma_phan_cong = ?',
        [PHAN_CONG.CHO_PHAN_CONG, row.ma_phan_cong]
      );
      await connection.execute(
        'UPDATE LOP SET ma_co_van = NULL, trang_thai_lop = ? WHERE ma_lop = ?',
        [PHAN_CONG.CHO_PHAN_CONG, row.ma_lop]
      );
      recipients.push({ loai_nguoi_nhan: 'khoa', ma_doi_tuong: row.ma_khoa });
    }
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Phòng CTSV đã từ chối phân công cố vấn',
      noi_dung: 'Phòng CTSV đã từ chối danh sách phân công cố vấn học tập.',
      recipients
    });
    return { message: `Đã từ chối ${rows.length} phân công` };
  });
}

// CTSV xem yeu cau thay the toan truong, gom lich su va cac request Khoa da duyet buoc 1.
export async function listReplacementRequests() {
  return query(
    `SELECT yc.*, pc.ma_lop, pc.nam_hoc, pc.ma_co_van AS ma_co_van_moi, l.ten_lop, l.ma_khoa,
            cu.ho_va_ten AS ten_co_van_cu,
            CASE WHEN moi_tk.ma_tai_khoan IS NULL THEN NULL ELSE moi.ho_va_ten END AS ten_co_van_moi,
            k.ten_khoa, COALESCE(yc.ten_truong_khoa, tk.ho_va_ten) AS ten_truong_khoa
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     JOIN CVHT cu ON cu.ma_co_van = yc.ma_co_van
     LEFT JOIN CVHT moi ON moi.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN moi_tk ON moi_tk.ma_tai_khoan = moi.ma_tai_khoan AND moi_tk.is_active = true
     LEFT JOIN (
       SELECT tk.ma_khoa, MIN(tk.ho_va_ten) AS ho_va_ten
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE acc.is_active = true
       GROUP BY tk.ma_khoa
     ) tk ON tk.ma_khoa = l.ma_khoa
     ORDER BY yc.ngay_yeu_cau DESC, yc.ma_yeu_cau DESC`
  );
}


// CTSV/Giam doc duyet buoc 2 thay the: cap nhat CVHT moi vao LOP, dong PHAN_CONG/YEU_CAU_THAY_THE va gui thong bao.
async function approveReplacementWithConnection(connection, user, id, { notify = true } = {}) {
  const nam_hoc = currentAcademicYear();
  const [rows] = await connection.execute(
    `SELECT yc.*, pc.ma_lop, pc.ma_co_van AS ma_co_van_moi, l.ten_lop, l.ma_khoa,
            cv.ho_va_ten AS ten_co_van_moi, cvtk.is_active AS co_van_moi_dang_hoat_dong
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN cvtk ON cvtk.ma_tai_khoan = cv.ma_tai_khoan
     WHERE yc.ma_yeu_cau = ?`,
    [id]
  );
  const request = rows[0];
  if (!request) throw notFound('Không tìm thấy yêu cầu');
  assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.GIAM_DOC_DA_DUYET);
  if (!request.ma_co_van_moi) throw badRequest('Khoa chưa phân công cố vấn học tập mới');
  if (!request.co_van_moi_dang_hoat_dong) throw badRequest('Cố vấn học tập mới phải có tài khoản đang hoạt động');
  await assertAdvisorCapacity(connection, request.ma_co_van_moi, request.ma_lop);
  await connection.execute('UPDATE LOP SET ma_co_van = ?, trang_thai_lop = ? WHERE ma_lop = ?', [
    request.ma_co_van_moi,
    PHAN_CONG.DA_DONG,
    request.ma_lop
  ]);
  await connection.execute('UPDATE PHAN_CONG SET trang_thai = ?, nam_hoc = ?, ngay_phan_cong = CURDATE() WHERE ma_phan_cong = ?', [
    PHAN_CONG.DA_DONG,
    nam_hoc,
    request.ma_phan_cong
  ]);
  await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
    YEU_CAU_THAY_THE.DA_DONG,
    id
  ]);
  const notification = {
    tieu_de: 'Giám đốc đã duyệt thay đổi cố vấn học tập',
    noi_dung: `Giám đốc đã duyệt yêu cầu thay thế cố vấn học tập cho năm học ${nam_hoc}.`,
    recipients: [
      { loai_nguoi_nhan: 'lop', ma_doi_tuong: request.ma_lop },
      { loai_nguoi_nhan: 'khoa', ma_doi_tuong: request.ma_khoa },
      { loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van },
      { loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van_moi }
    ]
  };
  if (notify) await createNotification(connection, user.ma_nhan_vien, notification);
  return { ...request, nam_hoc, notification };
}

// API duyet mot yeu cau thay the da qua Khoa duyet buoc 1.
export async function approveReplacement(user, id) {
  return transaction(async (connection) => {
    await approveReplacementWithConnection(connection, user, id);
    return { message: 'Duyệt thay thế cố vấn học tập và gửi thông báo thành công' };
  });
}

// CTSV/Giam doc tu choi yeu cau thay the o buoc 2 va bao lai Khoa, CVHT cu.
export async function rejectReplacement(user, id) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT yc.*, pc.ma_lop, pc.ma_co_van AS ma_co_van_moi, l.ten_lop, l.ma_khoa,
              cv.ho_va_ten AS ten_co_van_moi
       FROM YEU_CAU_THAY_THE yc
       JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
       WHERE yc.ma_yeu_cau = ?`,
      [id]
    );
    const request = rows[0];
    if (!request) throw notFound('Không tìm thấy yêu cầu');
    assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.BI_TU_CHOI);
    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.BI_TU_CHOI,
      id
    ]);
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Giám đốc đã từ chối yêu cầu thay thế cố vấn',
      noi_dung: `Yêu cầu dừng cố vấn lớp ${request.ten_lop} đã bị Giám đốc từ chối.`,
      recipients: [
        { loai_nguoi_nhan: 'khoa', ma_doi_tuong: request.ma_khoa },
        { loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van }
      ]
    });
    return { message: 'Đã từ chối yêu cầu thay thế' };
  });
}

// Duyet hang loat yeu cau thay the da duoc Khoa chuyen len CTSV/Giam doc.
export async function approveAllReplacements(user) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT ma_yeu_cau, trang_thai
       FROM YEU_CAU_THAY_THE
       WHERE trang_thai IN (?, ?)
       ORDER BY ma_yeu_cau`,
      [YEU_CAU_THAY_THE.KHOA_DA_DUYET, YEU_CAU_THAY_THE.GIAM_DOC_DANG_DUYET]
    );
    if (!rows.length) throw badRequest('Không có yêu cầu thay thế nào cần duyệt');
    const notifications = [];
    for (const row of rows) {
      const result = await approveReplacementWithConnection(connection, user, row.ma_yeu_cau, { notify: false });
      notifications.push(result.notification);
    }
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Giám đốc đã duyệt thay đổi cố vấn học tập',
      noi_dung: notifications[0].noi_dung,
      recipients: notifications.flatMap((notification) => notification.recipients)
    });
    return { message: `Đã duyệt ${rows.length} yêu cầu thay thế` };
  });
}

// Tu choi hang loat yeu cau thay the dang cho buoc duyet cuoi.
export async function rejectAllReplacements(user) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT yc.ma_yeu_cau, yc.ma_co_van, l.ma_khoa
       FROM YEU_CAU_THAY_THE yc
       JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE yc.trang_thai IN (?, ?)
       ORDER BY yc.ma_yeu_cau`,
      [YEU_CAU_THAY_THE.KHOA_DA_DUYET, YEU_CAU_THAY_THE.GIAM_DOC_DANG_DUYET]
    );
    if (!rows.length) throw badRequest('Không có yêu cầu thay thế nào cần từ chối');
    for (const row of rows) {
      await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
        YEU_CAU_THAY_THE.BI_TU_CHOI,
        row.ma_yeu_cau
      ]);
    }
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Giám đốc đã từ chối yêu cầu thay thế cố vấn',
      noi_dung: 'Giám đốc đã từ chối yêu cầu thay thế cố vấn học tập.',
      recipients: rows.flatMap((row) => [
        { loai_nguoi_nhan: 'khoa', ma_doi_tuong: row.ma_khoa },
        { loai_nguoi_nhan: 'covan', ma_doi_tuong: row.ma_co_van }
      ])
    });
    return { message: `Đã từ chối ${rows.length} yêu cầu thay thế` };
  });
}
