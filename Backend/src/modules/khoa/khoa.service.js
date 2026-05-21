import { query, transaction } from '../../config/db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { assertTransition, PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';

async function countAdvisorClasses(ma_co_van) {
  const rows = await query('SELECT COUNT(*) AS total FROM LOP WHERE ma_co_van = :ma_co_van', { ma_co_van });
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
  if (!advisor) throw notFound('Khong tim thay CVHT');
  if (advisor.ma_khoa !== ma_khoa) throw forbidden('Chi duoc phan cong CVHT thuoc Khoa minh');
  if (!advisor.ma_tai_khoan || !advisor.is_active) throw badRequest('CVHT can co tai khoan dang hoat dong truoc khi phan cong');
  if (Number(advisor.uu_tien) === 3) throw badRequest('CVHT uu tien muc 3 khong duoc phan cong theo quy dinh');
  const total = await countAdvisorClasses(ma_co_van);
  if (total >= 2) throw badRequest('Moi CVHT chi duoc phu trach toi da 2 lop');
  return advisor;
}

export async function listAssignments(user) {
  return query(
    `SELECT pc.*, l.ten_lop, l.ma_khoa, l.chuyen_nganh, l.so_luong_sv,
            cv.ho_va_ten AS ten_co_van, tk.ho_va_ten AS ten_truong_khoa
     FROM PHAN_CONG pc
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT cv ON cv.ma_co_van = pc.ma_co_van
     LEFT JOIN TRUONG_KHOA tk ON tk.ma_khoa = l.ma_khoa
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
     ORDER BY cv.uu_tien, cv.chuyen_nganh, cv.ho_va_ten`,
    { ma_khoa: user.ma_khoa }
  );
}

export async function updateAdvisorPriority(user, ma_co_van, uu_tien) {
  if (![1, 2, 3].includes(Number(uu_tien))) throw badRequest('Do uu tien chi tu 1 den 3');
  const result = await query(
    'UPDATE CVHT SET uu_tien = :uu_tien WHERE ma_co_van = :ma_co_van AND ma_khoa = :ma_khoa',
    { uu_tien: Number(uu_tien), ma_co_van, ma_khoa: user.ma_khoa }
  );
  if (!result.affectedRows) throw notFound('Khong tim thay CVHT thuoc Khoa');
  return { message: 'Cap nhat do uu tien thanh cong' };
}

export async function autoAssignAdvisors(user) {
  return transaction(async (connection) => {
    const [assignments] = await connection.execute(
      `SELECT pc.ma_phan_cong, pc.ma_lop, pc.nam_hoc, pc.trang_thai,
              l.ten_lop, l.chuyen_nganh
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE l.ma_khoa = ? AND pc.trang_thai = ?
       ORDER BY l.chuyen_nganh, l.ten_lop`,
      [user.ma_khoa, PHAN_CONG.DANG_PHAN_CONG]
    );
    if (!assignments.length) throw badRequest('Khong co yeu cau dang phan cong');

    const [advisorRows] = await connection.execute(
      `SELECT cv.ma_co_van, cv.ho_va_ten, cv.chuyen_nganh, cv.uu_tien,
              COUNT(l.ma_lop) AS so_lop_dang_phu_trach
       FROM CVHT cv
       JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan
       LEFT JOIN LOP l ON l.ma_co_van = cv.ma_co_van
       WHERE cv.ma_khoa = ? AND tk.is_active = true AND cv.uu_tien <> 3
       GROUP BY cv.ma_co_van, cv.ho_va_ten, cv.chuyen_nganh, cv.uu_tien
       ORDER BY cv.uu_tien, cv.ho_va_ten`,
      [user.ma_khoa]
    );
    const advisors = advisorRows.map((advisor) => ({
      ...advisor,
      uu_tien: Number(advisor.uu_tien),
      so_lop_dang_phu_trach: Number(advisor.so_lop_dang_phu_trach)
    }));
    if (!advisors.length) throw badRequest('Khong co CVHT kha dung de phan cong');

    for (const assignment of assignments) {
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
        throw badRequest(`Khong du CVHT kha dung de phan cong lop ${assignment.ten_lop}`);
      }

      assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.DA_PHAN_CONG);
      await connection.execute(
        'UPDATE PHAN_CONG SET ma_co_van = ?, trang_thai = ? WHERE ma_phan_cong = ?',
        [advisor.ma_co_van, PHAN_CONG.DA_PHAN_CONG, assignment.ma_phan_cong]
      );
      advisor.so_lop_dang_phu_trach += 1;
    }

    return { message: `Da phan cong tu dong ${assignments.length} lop va gui CTSV` };
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
    if (!assignment) throw notFound('Khong tim thay phan cong');
    if (assignment.ma_khoa !== user.ma_khoa) throw forbidden('Chi thao tac du lieu thuoc Khoa minh');
    if (assignment.trang_thai !== PHAN_CONG.DANG_PHAN_CONG && assignment.trang_thai !== PHAN_CONG.DA_PHAN_CONG) {
      throw badRequest('Chi phan cong khi trang thai dang phan cong');
    }
    await assertAdvisorAssignable(user.ma_khoa, ma_co_van);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = ? WHERE ma_phan_cong = ?', [ma_co_van, ma_phan_cong]);
    return { message: 'Da chon CVHT cho lop' };
  });
}

export async function submitAssignment(user, ma_phan_cong) {
  const rows = await query(
    `SELECT pc.*, l.ma_khoa FROM PHAN_CONG pc JOIN LOP l ON l.ma_lop = pc.ma_lop WHERE pc.ma_phan_cong = :id`,
    { id: ma_phan_cong }
  );
  const assignment = rows[0];
  if (!assignment) throw notFound('Khong tim thay phan cong');
  if (assignment.ma_khoa !== user.ma_khoa) throw forbidden('Chi thao tac du lieu thuoc Khoa minh');
  if (!assignment.ma_co_van) throw badRequest('Can chon CVHT truoc khi gui CTSV');
  assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.DA_PHAN_CONG);
  await query('UPDATE PHAN_CONG SET trang_thai = :status WHERE ma_phan_cong = :id', {
    status: PHAN_CONG.DA_PHAN_CONG,
    id: ma_phan_cong
  });
  return { message: 'Da gui danh sach phan cong cho CTSV' };
}

export async function listReplacementRequests(user) {
  return query(
    `SELECT yc.*, pc.ma_lop, pc.nam_hoc, pc.ma_co_van AS ma_co_van_moi, l.ten_lop, l.ma_khoa,
            cu.ho_va_ten AS ten_co_van_cu, moi.ho_va_ten AS ten_co_van_moi,
            tk.ho_va_ten AS ten_truong_khoa
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     JOIN CVHT cu ON cu.ma_co_van = yc.ma_co_van
     LEFT JOIN CVHT moi ON moi.ma_co_van = pc.ma_co_van
     LEFT JOIN TRUONG_KHOA tk ON tk.ma_khoa = l.ma_khoa
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
  if (!request) throw notFound('Khong tim thay yeu cau');
  if (request.ma_khoa !== user.ma_khoa) throw forbidden('Chi duyet yeu cau thuoc Khoa minh');
  assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1);
  await query('UPDATE YEU_CAU_THAY_THE SET trang_thai = :status WHERE ma_yeu_cau = :id', {
    status: YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1,
    id: ma_yeu_cau
  });
  return { message: 'Khoa bat dau duyet buoc 1' };
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
    if (!request) throw notFound('Khong tim thay yeu cau');
    if (request.ma_khoa !== user.ma_khoa) throw forbidden('Chi duyet yeu cau thuoc Khoa minh');
    if (request.ma_co_van === ma_co_van_moi) throw badRequest('CVHT moi phai khac CVHT hien tai');
    assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DA_DUYET_BUOC_1);
    await assertAdvisorAssignable(user.ma_khoa, ma_co_van_moi);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = ?, trang_thai = ? WHERE ma_phan_cong = ?', [
      ma_co_van_moi,
      PHAN_CONG.DA_PHAN_CONG,
      request.ma_phan_cong
    ]);
    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_1,
      ma_yeu_cau
    ]);
    return { message: 'Khoa da duyet buoc 1 va chon CVHT moi' };
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
  if (!request) throw notFound('Khong tim thay yeu cau');
  if (request.ma_khoa !== user.ma_khoa) throw forbidden('Chi duyet yeu cau thuoc Khoa minh');
  if (![YEU_CAU_THAY_THE.CHO_DUYET, YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1].includes(request.trang_thai)) {
    throw badRequest('Chi tu choi o buoc Khoa dang duyet');
  }
  await query('UPDATE YEU_CAU_THAY_THE SET trang_thai = :status WHERE ma_yeu_cau = :id', {
    status: YEU_CAU_THAY_THE.BI_TU_CHOI,
    id: ma_yeu_cau
  });
  return { message: 'Khoa da tu choi yeu cau thay the' };
}
