import { query, transaction } from '../../config/db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { assertTransition, PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';

async function countAdvisorClasses(ma_co_van) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM LOP WHERE ma_co_van = :ma_co_van)
       + (SELECT COUNT(*)
          FROM PHAN_CONG pc
          JOIN LOP l ON l.ma_lop = pc.ma_lop
          WHERE pc.ma_co_van = :ma_co_van
            AND pc.trang_thai IN (:dang_phan_cong, :da_phan_cong)) AS total`,
    {
      ma_co_van,
      dang_phan_cong: PHAN_CONG.DANG_PHAN_CONG,
      da_phan_cong: PHAN_CONG.DA_PHAN_CONG
    }
  );
  return Number(rows[0].total);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

async function assertAdvisorAssignable(ma_khoa, ma_co_van) {
  const rows = await query(
    `SELECT cv.*, tk.is_active
     FROM CVHT cv
     LEFT JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan
     WHERE cv.ma_co_van = :ma_co_van`,
    { ma_co_van }
  );
  const advisor = rows[0];
  if (!advisor) throw notFound('Không tìm thấy cố vấn học tập');
  if (advisor.ma_khoa !== ma_khoa) throw forbidden('Chỉ được phân công cố vấn học tập thuộc Khoa mình');
  if (!advisor.ma_tai_khoan || !advisor.is_active) throw badRequest('Cố vấn học tập cần có tài khoản đang hoạt động trước khi phân công');
  if (Number(advisor.uu_tien) === 3) throw badRequest('Cố vấn học tập ưu tiên mức 3 không được phân công theo quy định');
  const total = await countAdvisorClasses(ma_co_van);
  if (total >= 2) throw badRequest('Mỗi cố vấn học tập chỉ được phụ trách tối đa 2 lớp');
  return advisor;
}

export async function listAssignments(user) {
  return query(
    `SELECT pc.*, l.ten_lop, l.ma_khoa, l.chuyen_nganh, l.so_luong_sv,
            CASE WHEN cvtk.ma_tai_khoan IS NULL THEN NULL ELSE cv.ho_va_ten END AS ten_co_van,
            COALESCE(pc.ten_truong_khoa, tk.ho_va_ten) AS ten_truong_khoa
     FROM PHAN_CONG pc
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN cvtk ON cvtk.ma_tai_khoan = cv.ma_tai_khoan AND cvtk.is_active = true
     LEFT JOIN (
       SELECT tk.ma_khoa, MIN(tk.ho_va_ten) AS ho_va_ten
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE acc.is_active = true
       GROUP BY tk.ma_khoa
     ) tk ON tk.ma_khoa = l.ma_khoa
     WHERE l.ma_khoa = :ma_khoa
     ORDER BY pc.nam_hoc DESC, pc.trang_thai, l.ten_lop`,
    { ma_khoa: user.ma_khoa }
  );
}

export async function listAdvisors(user) {
  return query(
    `SELECT cv.*, tk.email,
            (SELECT COUNT(*) FROM LOP l WHERE l.ma_co_van = cv.ma_co_van) AS so_lop_dang_phu_trach
     FROM CVHT cv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan
     WHERE cv.ma_khoa = :ma_khoa AND tk.is_active = true
     ORDER BY tk.is_active DESC, cv.ma_co_van ASC`,
    { ma_khoa: user.ma_khoa }
  );
}

export async function updateAdvisorPriority(user, ma_co_van, uu_tien) {
  if (![1, 2, 3].includes(Number(uu_tien))) throw badRequest('Độ ưu tiên chỉ từ 1 đến 3');
  const result = await query(
    'UPDATE CVHT SET uu_tien = :uu_tien WHERE ma_co_van = :ma_co_van AND ma_khoa = :ma_khoa',
    { uu_tien: Number(uu_tien), ma_co_van, ma_khoa: user.ma_khoa }
  );
  if (!result.affectedRows) throw notFound('Không tìm thấy cố vấn học tập thuộc Khoa');
  return { message: 'Cập nhật độ ưu tiên thành công' };
}

export async function autoAssignAdvisors(user) {
  return transaction(async (connection) => {
    const [assignments] = await connection.execute(
      `SELECT pc.ma_phan_cong, pc.ma_lop, pc.ma_co_van, pc.nam_hoc, pc.trang_thai,
              l.ten_lop, l.chuyen_nganh
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE l.ma_khoa = ? AND pc.trang_thai = ?
       ORDER BY l.chuyen_nganh, l.ten_lop`,
      [user.ma_khoa, PHAN_CONG.DANG_PHAN_CONG]
    );
    if (!assignments.length) throw badRequest('Không có yêu cầu đang phân công');

    const [advisorRows] = await connection.execute(
      `SELECT cv.ma_co_van, cv.ho_va_ten, cv.chuyen_nganh, cv.uu_tien,
              COUNT(DISTINCT l.ma_lop) + COUNT(DISTINCT pending.ma_phan_cong) AS so_lop_dang_phu_trach
       FROM CVHT cv
       JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan
       LEFT JOIN LOP l ON l.ma_co_van = cv.ma_co_van
       LEFT JOIN PHAN_CONG pending ON pending.ma_co_van = cv.ma_co_van
        AND pending.trang_thai IN (?, ?)
       WHERE cv.ma_khoa = ? AND tk.is_active = true AND cv.uu_tien <> 3
       GROUP BY cv.ma_co_van, cv.ho_va_ten, cv.chuyen_nganh, cv.uu_tien
       ORDER BY cv.uu_tien, cv.ho_va_ten`,
      [PHAN_CONG.DANG_PHAN_CONG, PHAN_CONG.DA_PHAN_CONG, user.ma_khoa]
    );
    const advisors = advisorRows.map((advisor) => ({
      ...advisor,
      uu_tien: Number(advisor.uu_tien),
      so_lop_dang_phu_trach: Number(advisor.so_lop_dang_phu_trach)
    }));
    if (!advisors.length) throw badRequest('Không có cố vấn học tập khả dụng để phân công');

    const emptyAssignments = assignments.filter((assignment) => !assignment.ma_co_van);
    if (!emptyAssignments.length) throw badRequest('Tất cả lớp đang phân công đã có cố vấn học tập');

    for (const assignment of emptyAssignments) {
      const classMajor = normalizeText(assignment.chuyen_nganh);
      const candidates = advisors
        .filter((advisor) => advisor.so_lop_dang_phu_trach < 2)
        .sort((a, b) => {
          const aMajorMatch = normalizeText(a.chuyen_nganh) === classMajor ? 0 : 1;
          const bMajorMatch = normalizeText(b.chuyen_nganh) === classMajor ? 0 : 1;
          return aMajorMatch - bMajorMatch
            || a.uu_tien - b.uu_tien
            || a.so_lop_dang_phu_trach - b.so_lop_dang_phu_trach
            || a.ho_va_ten.localeCompare(b.ho_va_ten);
        });
      const advisor = candidates[0];
      if (!advisor) {
        throw badRequest(`Không đủ cố vấn học tập khả dụng để phân công lớp ${assignment.ten_lop}`);
      }

      await connection.execute(
        'UPDATE PHAN_CONG SET ma_co_van = ?, ten_truong_khoa = ? WHERE ma_phan_cong = ?',
        [advisor.ma_co_van, user.ho_va_ten, assignment.ma_phan_cong]
      );
      advisor.so_lop_dang_phu_trach += 1;
    }

    return { message: `Đã phân công tự động ${emptyAssignments.length} lớp` };
  });
}

export async function assignAdvisor(user, ma_phan_cong, ma_co_van) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT pc.*, l.ma_khoa
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE pc.ma_phan_cong = ?`,
      [ma_phan_cong]
    );
    const assignment = rows[0];
    if (!assignment) throw notFound('Không tìm thấy phân công');
    if (assignment.ma_khoa !== user.ma_khoa) throw forbidden('Chỉ thao tác dữ liệu thuộc Khoa mình');
    if (assignment.trang_thai !== PHAN_CONG.DANG_PHAN_CONG && assignment.trang_thai !== PHAN_CONG.DA_PHAN_CONG) {
      throw badRequest('Chỉ phân công khi trạng thái đang phân công');
    }
    await assertAdvisorAssignable(user.ma_khoa, ma_co_van);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = ? WHERE ma_phan_cong = ?', [ma_co_van, ma_phan_cong]);
    return { message: 'Đã chọn cố vấn học tập cho lớp' };
  });
}

export async function submitAssignment(user, ma_phan_cong) {
  const rows = await query(
    `SELECT pc.*, l.ma_khoa FROM PHAN_CONG pc JOIN LOP l ON l.ma_lop = pc.ma_lop WHERE pc.ma_phan_cong = :id`,
    { id: ma_phan_cong }
  );
  const assignment = rows[0];
  if (!assignment) throw notFound('Không tìm thấy phân công');
  if (assignment.ma_khoa !== user.ma_khoa) throw forbidden('Chỉ thao tác dữ liệu thuộc Khoa mình');
  if (!assignment.ma_co_van) throw badRequest('Cần chọn cố vấn học tập trước khi gửi Phòng Công tác Sinh viên');
  assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.DA_PHAN_CONG);
  await query('UPDATE PHAN_CONG SET trang_thai = :status, ten_truong_khoa = :ten_truong_khoa WHERE ma_phan_cong = :id', {
    status: PHAN_CONG.DA_PHAN_CONG,
    ten_truong_khoa: user.ho_va_ten,
    id: ma_phan_cong
  });
  return { message: 'Đã gửi danh sách phân công cho Phòng Công tác Sinh viên' };
}

export async function submitAllAssignments(user) {
  return transaction(async (connection) => {
    const [assignments] = await connection.execute(
      `SELECT pc.ma_phan_cong, pc.ma_co_van, l.ten_lop
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE l.ma_khoa = ? AND pc.trang_thai = ?
       ORDER BY l.ten_lop`,
      [user.ma_khoa, PHAN_CONG.DANG_PHAN_CONG]
    );
    if (!assignments.length) throw badRequest('Không có danh sách phân công đang chờ gửi');

    const missing = assignments.filter((assignment) => !assignment.ma_co_van);
    if (missing.length) {
      throw badRequest(`Cần phân công cố vấn học tập cho lớp ${missing[0].ten_lop} trước khi gửi`);
    }

    await connection.execute(
      `UPDATE PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       SET pc.trang_thai = ?, pc.ten_truong_khoa = ?
       WHERE l.ma_khoa = ? AND pc.trang_thai = ?`,
      [PHAN_CONG.DA_PHAN_CONG, user.ho_va_ten, user.ma_khoa, PHAN_CONG.DANG_PHAN_CONG]
    );

    return { message: `Đã gửi ${assignments.length} phân công cho Phòng Công tác Sinh viên` };
  });
}

export async function listReplacementRequests(user) {
  return query(
    `SELECT yc.*, pc.ma_lop, pc.nam_hoc, pc.ma_co_van AS ma_co_van_moi, l.ten_lop, l.ma_khoa,
            cu.ho_va_ten AS ten_co_van_cu, moi.ho_va_ten AS ten_co_van_moi,
            COALESCE(yc.ten_truong_khoa, tk.ho_va_ten) AS ten_truong_khoa
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     JOIN CVHT cu ON cu.ma_co_van = yc.ma_co_van
     LEFT JOIN CVHT moi ON moi.ma_co_van = pc.ma_co_van
     LEFT JOIN (
       SELECT tk.ma_khoa, MIN(tk.ho_va_ten) AS ho_va_ten
       FROM TRUONG_KHOA tk
       JOIN TAI_KHOAN acc ON acc.ma_tai_khoan = tk.ma_tai_khoan
       WHERE acc.is_active = true
       GROUP BY tk.ma_khoa
     ) tk ON tk.ma_khoa = l.ma_khoa
     WHERE l.ma_khoa = :ma_khoa
     ORDER BY yc.ngay_yeu_cau DESC`,
    { ma_khoa: user.ma_khoa }
  );
}

export async function startReplacementStep1(user, ma_yeu_cau) {
  const rows = await query(
    `SELECT yc.*, l.ma_khoa
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     WHERE yc.ma_yeu_cau = :id`,
    { id: ma_yeu_cau }
  );
  const request = rows[0];
  if (!request) throw notFound('Không tìm thấy yêu cầu');
  if (request.ma_khoa !== user.ma_khoa) throw forbidden('Chỉ duyệt yêu cầu thuộc Khoa mình');
  assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1);
  await query('UPDATE YEU_CAU_THAY_THE SET trang_thai = :status WHERE ma_yeu_cau = :id', {
    status: YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1,
    id: ma_yeu_cau
  });
  return { message: 'Khoa bắt đầu duyệt bước 1' };
}

export async function approveReplacementStep1(user, ma_yeu_cau, ma_co_van_moi) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT yc.*, pc.ma_lop, l.ma_khoa
       FROM YEU_CAU_THAY_THE yc
       JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE yc.ma_yeu_cau = ?`,
      [ma_yeu_cau]
    );
    const request = rows[0];
    if (!request) throw notFound('Không tìm thấy yêu cầu');
    if (request.ma_khoa !== user.ma_khoa) throw forbidden('Chỉ duyệt yêu cầu thuộc Khoa mình');
    if (request.ma_co_van === ma_co_van_moi) throw badRequest('Cố vấn học tập mới phải khác cố vấn học tập hiện tại');
    assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DA_DUYET_BUOC_1);
    await assertAdvisorAssignable(user.ma_khoa, ma_co_van_moi);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = ?, trang_thai = ? WHERE ma_phan_cong = ?', [
      ma_co_van_moi,
      PHAN_CONG.DA_PHAN_CONG,
      request.ma_phan_cong
    ]);
    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ?, ten_truong_khoa = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_1,
      user.ho_va_ten,
      ma_yeu_cau
    ]);
    return { message: 'Khoa đã duyệt bước 1 và chọn cố vấn học tập mới' };
  });
}

export async function rejectReplacementStep1(user, ma_yeu_cau) {
  const rows = await query(
    `SELECT yc.*, l.ma_khoa
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     WHERE yc.ma_yeu_cau = :id`,
    { id: ma_yeu_cau }
  );
  const request = rows[0];
  if (!request) throw notFound('Không tìm thấy yêu cầu');
  if (request.ma_khoa !== user.ma_khoa) throw forbidden('Chỉ duyệt yêu cầu thuộc Khoa mình');
  if (![YEU_CAU_THAY_THE.CHO_DUYET, YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1].includes(request.trang_thai)) {
    throw badRequest('Chỉ từ chối ở bước Khoa đang duyệt');
  }
  await query('UPDATE YEU_CAU_THAY_THE SET trang_thai = :status WHERE ma_yeu_cau = :id', {
    status: YEU_CAU_THAY_THE.BI_TU_CHOI,
    id: ma_yeu_cau
  });
  return { message: 'Khoa đã từ chối yêu cầu thay thế' };
}
