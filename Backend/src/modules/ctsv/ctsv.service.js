import { query, transaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';
import { defaultPasswordForRole, hashPassword } from '../../utils/passwords.js';
import { parseCsv } from '../../utils/csv.js';
import { assertTransition, PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';

async function createStudentAccount(connection, student) {
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

export async function listStudents() {
  return query(
    `SELECT sv.*, tk.email, tk.is_active, l.ten_lop
     FROM SINH_VIEN sv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan
     JOIN LOP l ON l.ma_lop = sv.ma_lop
     ORDER BY sv.ma_lop, sv.ho_va_ten`
  );
}

export async function createStudent(payload) {
  const required = ['ma_sinh_vien', 'ho_va_ten', 'email', 'so_dien_thoai', 'ma_lop'];
  for (const field of required) if (!payload[field]) throw badRequest(`Thieu truong ${field}`);

  return transaction(async (connection) => {
    const accountId = await createStudentAccount(connection, payload);
    await connection.execute(
      `INSERT INTO SINH_VIEN (ma_sinh_vien, ma_tai_khoan, ma_lop, ho_va_ten, so_dien_thoai)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.ma_sinh_vien, accountId, payload.ma_lop, payload.ho_va_ten, payload.so_dien_thoai]
    );
    await connection.execute('UPDATE LOP SET so_luong_sv = so_luong_sv + 1 WHERE ma_lop = ?', [payload.ma_lop]);
    return { message: 'Tao sinh vien thanh cong' };
  });
}

export async function importStudents(file, ma_lop) {
  if (!file) throw badRequest('Vui long tai len file CSV');
  const rows = parseCsv(file.buffer);
  let created = 0;
  for (const row of rows) {
    await createStudent({
      ma_sinh_vien: row.ma_sinh_vien || row['Mã sinh viên'] || row['Ma sinh vien'],
      ho_va_ten: row.ho_va_ten || row['Tên sinh viên'] || row['Ten sinh vien'],
      email: row.email || row.Email,
      so_dien_thoai: row.so_dien_thoai || row['Số điện thoại'] || row['So dien thoai'],
      ma_lop: row.ma_lop || ma_lop
    });
    created += 1;
  }
  return { message: 'Import sinh vien thanh cong', created };
}

export async function updateStudent(id, payload) {
  const result = await query(
    `UPDATE SINH_VIEN sv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan
     SET sv.ho_va_ten = COALESCE(:ho_va_ten, sv.ho_va_ten),
         sv.so_dien_thoai = COALESCE(:so_dien_thoai, sv.so_dien_thoai),
         sv.ma_lop = COALESCE(:ma_lop, sv.ma_lop),
         tk.email = COALESCE(:email, tk.email)
     WHERE sv.ma_sinh_vien = :id`,
    { ...payload, id }
  );
  if (!result.affectedRows) throw notFound('Khong tim thay sinh vien');
  return { message: 'Cap nhat sinh vien thanh cong' };
}

export async function deleteStudent(id) {
  const rows = await query('SELECT ma_tai_khoan FROM SINH_VIEN WHERE ma_sinh_vien = :id', { id });
  if (!rows[0]) throw notFound('Khong tim thay sinh vien');
  await query('UPDATE TAI_KHOAN SET is_active = false WHERE ma_tai_khoan = :id', { id: rows[0].ma_tai_khoan });
  return { message: 'Da ngung hoat dong tai khoan sinh vien' };
}

export async function listClasses() {
  return query(
    `SELECT l.*, k.ten_khoa, cv.ho_va_ten AS ten_co_van
     FROM LOP l
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     LEFT JOIN CVHT cv ON cv.ma_co_van = l.ma_co_van
     ORDER BY l.nam_hoc DESC, l.ma_khoa, l.ten_lop`
  );
}

export async function createClass(payload) {
  const required = ['ma_lop', 'ma_khoa', 'ten_lop', 'chuyen_nganh', 'nam_hoc'];
  for (const field of required) if (!payload[field]) throw badRequest(`Thieu truong ${field}`);
  await query(
    `INSERT INTO LOP (ma_lop, ma_khoa, ten_lop, so_luong_sv, chuyen_nganh, nam_hoc, ma_co_van, trang_thai_lop)
     VALUES (:ma_lop, :ma_khoa, :ten_lop, :so_luong_sv, :chuyen_nganh, :nam_hoc, NULL, 'Chờ phân công')`,
    { ...payload, so_luong_sv: Number(payload.so_luong_sv || 0) }
  );
  return { message: 'Tao lop thanh cong' };
}

export async function updateClass(id, payload) {
  const result = await query(
    `UPDATE LOP SET
       ma_khoa = COALESCE(:ma_khoa, ma_khoa),
       ten_lop = COALESCE(:ten_lop, ten_lop),
       so_luong_sv = COALESCE(:so_luong_sv, so_luong_sv),
       chuyen_nganh = COALESCE(:chuyen_nganh, chuyen_nganh),
       nam_hoc = COALESCE(:nam_hoc, nam_hoc),
       trang_thai_lop = COALESCE(:trang_thai_lop, trang_thai_lop)
     WHERE ma_lop = :id`,
    { ...payload, id }
  );
  if (!result.affectedRows) throw notFound('Khong tim thay lop');
  return { message: 'Cap nhat lop thanh cong' };
}

export async function deleteClass(id) {
  const result = await query('DELETE FROM LOP WHERE ma_lop = :id', { id });
  if (!result.affectedRows) throw notFound('Khong tim thay lop');
  return { message: 'Xoa lop thanh cong' };
}

export async function listAssignments() {
  return query(
    `SELECT pc.*, l.ten_lop, l.ma_khoa, l.chuyen_nganh, l.so_luong_sv, cv.ho_va_ten AS ten_co_van
     FROM PHAN_CONG pc
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
     ORDER BY pc.nam_hoc DESC, l.ma_khoa, pc.trang_thai`
  );
}

export async function createAssignmentRequest(payload) {
  if (!payload.ma_lop || !payload.nam_hoc) throw badRequest('Can chon lop va nam hoc');
  const ma_phan_cong = makeId('PC');
  await query(
    `INSERT INTO PHAN_CONG (ma_phan_cong, ma_lop, ma_co_van, nam_hoc, trang_thai, ngay_phan_cong)
     VALUES (:ma_phan_cong, :ma_lop, NULL, :nam_hoc, :trang_thai, NULL)`,
    { ma_phan_cong, ma_lop: payload.ma_lop, nam_hoc: payload.nam_hoc, trang_thai: PHAN_CONG.CHO_PHAN_CONG }
  );
  await query('UPDATE LOP SET ma_co_van = NULL, trang_thai_lop = :status WHERE ma_lop = :ma_lop', {
    status: PHAN_CONG.CHO_PHAN_CONG,
    ma_lop: payload.ma_lop
  });
  return { message: 'Lap danh sach lop can CVHT thanh cong', ma_phan_cong };
}

export async function sendAssignmentToFaculty(id) {
  const rows = await query('SELECT * FROM PHAN_CONG WHERE ma_phan_cong = :id', { id });
  const assignment = rows[0];
  if (!assignment) throw notFound('Khong tim thay phan cong');
  assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.DANG_PHAN_CONG);
  await query('UPDATE PHAN_CONG SET trang_thai = :next WHERE ma_phan_cong = :id', {
    next: PHAN_CONG.DANG_PHAN_CONG,
    id
  });
  return { message: 'Da gui yeu cau phan cong cho Khoa' };
}

async function createNotification(connection, ma_nhan_vien, { tieu_de, noi_dung, recipients }) {
  const ma_thong_bao = makeId('TB');
  await connection.execute(
    'INSERT INTO THONG_BAO (ma_thong_bao, ma_nhan_vien, tieu_de, noi_dung, ngay_gui) VALUES (?, ?, ?, ?, CURDATE())',
    [ma_thong_bao, ma_nhan_vien, tieu_de, noi_dung]
  );
  for (const recipient of recipients) {
    await connection.execute(
      `INSERT INTO THONG_BAO_NGUOI_NHAN
       (nguoi_nhan_id, ma_thong_bao, loai_nguoi_nhan, ma_doi_tuong)
       VALUES (?, ?, ?, ?)`,
      [makeId('NN'), ma_thong_bao, recipient.loai_nguoi_nhan, recipient.ma_doi_tuong]
    );
  }
  return ma_thong_bao;
}

async function assertAdvisorCapacity(connection, ma_co_van, ma_lop) {
  const [rows] = await connection.execute(
    'SELECT COUNT(*) AS total FROM LOP WHERE ma_co_van = ? AND ma_lop <> ?',
    [ma_co_van, ma_lop]
  );
  if (Number(rows[0].total) >= 2) {
    throw badRequest('CVHT da phu trach toi da 2 lop');
  }
}

export async function approveAssignment(user, id) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT pc.*, l.ma_khoa, l.ten_lop, cv.ho_va_ten AS ten_co_van
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
       WHERE pc.ma_phan_cong = ?`,
      [id]
    );
    const assignment = rows[0];
    if (!assignment) throw notFound('Khong tim thay phan cong');
    assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.DA_DONG);
    if (!assignment.ma_co_van) throw badRequest('Khoa chua chon CVHT');
    await assertAdvisorCapacity(connection, assignment.ma_co_van, assignment.ma_lop);

    await connection.execute(
      'UPDATE LOP SET ma_co_van = ?, trang_thai_lop = ? WHERE ma_lop = ?',
      [assignment.ma_co_van, PHAN_CONG.DA_DONG, assignment.ma_lop]
    );
    await connection.execute(
      'UPDATE PHAN_CONG SET trang_thai = ?, ngay_phan_cong = CURDATE() WHERE ma_phan_cong = ?',
      [PHAN_CONG.DA_DONG, id]
    );
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Thông báo phân công CVHT',
      noi_dung: `Lớp ${assignment.ten_lop} đã được phân công CVHT ${assignment.ten_co_van}.`,
      recipients: [
        { loai_nguoi_nhan: 'lop', ma_doi_tuong: assignment.ma_lop },
        { loai_nguoi_nhan: 'khoa', ma_doi_tuong: assignment.ma_khoa },
        { loai_nguoi_nhan: 'covan', ma_doi_tuong: assignment.ma_co_van }
      ]
    });
    return { message: 'Duyet va dong phan cong thanh cong' };
  });
}

export async function rejectAssignment(id) {
  const rows = await query('SELECT * FROM PHAN_CONG WHERE ma_phan_cong = :id', { id });
  const assignment = rows[0];
  if (!assignment) throw notFound('Khong tim thay phan cong');
  if (assignment.trang_thai !== PHAN_CONG.DA_PHAN_CONG) throw badRequest('Chi tu choi danh sach Khoa da gui');
  await query('UPDATE PHAN_CONG SET trang_thai = :next, ma_co_van = NULL WHERE ma_phan_cong = :id', {
    next: PHAN_CONG.DANG_PHAN_CONG,
    id
  });
  return { message: 'Da tu choi va tra ve Khoa chinh sua' };
}

export async function listReplacementRequests() {
  return query(
    `SELECT yc.*, pc.ma_lop, pc.ma_co_van AS ma_co_van_moi, l.ten_lop, l.ma_khoa,
            cu.ho_va_ten AS ten_co_van_cu, moi.ho_va_ten AS ten_co_van_moi
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     JOIN CVHT cu ON cu.ma_co_van = yc.ma_co_van
     LEFT JOIN CVHT moi ON moi.ma_co_van = pc.ma_co_van
     ORDER BY yc.ngay_yeu_cau DESC`
  );
}

export async function startReplacementStep2(id) {
  const rows = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = :id', { id });
  const request = rows[0];
  if (!request) throw notFound('Khong tim thay yeu cau');
  assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2);
  await query('UPDATE YEU_CAU_THAY_THE SET trang_thai = :status WHERE ma_yeu_cau = :id', {
    status: YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2,
    id
  });
  return { message: 'CTSV bat dau duyet buoc 2' };
}

export async function approveReplacement(user, id) {
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
    if (!request) throw notFound('Khong tim thay yeu cau');
    assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DA_DUYET_BUOC_2);
    if (!request.ma_co_van_moi) throw badRequest('Khoa chua phan cong CVHT moi');
    await assertAdvisorCapacity(connection, request.ma_co_van_moi, request.ma_lop);

    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_2,
      id
    ]);
    await connection.execute('UPDATE LOP SET ma_co_van = ?, trang_thai_lop = ? WHERE ma_lop = ?', [
      request.ma_co_van_moi,
      'Đã có CVHT',
      request.ma_lop
    ]);
    await connection.execute('UPDATE PHAN_CONG SET trang_thai = ?, ngay_phan_cong = CURDATE() WHERE ma_phan_cong = ?', [
      PHAN_CONG.DA_DONG,
      request.ma_phan_cong
    ]);
    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.DA_DONG,
      id
    ]);
    await createNotification(connection, user.ma_nhan_vien, {
      tieu_de: 'Thông báo thay đổi CVHT',
      noi_dung: `Lớp ${request.ten_lop} đã được thay đổi CVHT mới: ${request.ten_co_van_moi}.`,
      recipients: [
        { loai_nguoi_nhan: 'lop', ma_doi_tuong: request.ma_lop },
        { loai_nguoi_nhan: 'khoa', ma_doi_tuong: request.ma_khoa },
        { loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van },
        { loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van_moi }
      ]
    });
    return { message: 'Duyet thay the CVHT va gui thong bao thanh cong' };
  });
}

export async function rejectReplacement(id) {
  const rows = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = :id', { id });
  const request = rows[0];
  if (!request) throw notFound('Khong tim thay yeu cau');
  if (![YEU_CAU_THAY_THE.DA_DUYET_BUOC_1, YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2].includes(request.trang_thai)) {
    throw badRequest('Chi tu choi o giai doan CTSV duyet buoc 2');
  }
  await query('UPDATE YEU_CAU_THAY_THE SET trang_thai = :status WHERE ma_yeu_cau = :id', {
    status: YEU_CAU_THAY_THE.BI_TU_CHOI,
    id
  });
  return { message: 'Da tu choi yeu cau thay the' };
}
