import { query, transaction } from '../../config/db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';
import { assertTransition, PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';
import { createSystemNotification } from '../notifications/notifications.service.js';

// Dem so lop CVHT dang phu trach hoac dang duoc de xuat de giu gioi han toi da 2 lop.
async function countAdvisorClasses(ma_co_van) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM LOP WHERE ma_co_van = :ma_co_van)
       + (SELECT COUNT(*)
          FROM PHAN_CONG pc
          LEFT JOIN YEU_CAU_THAY_THE yc ON yc.ma_phan_cong = pc.ma_phan_cong
          WHERE pc.ma_co_van = :ma_co_van
            AND pc.trang_thai IN (:da_phan_cong, :cho_giam_doc_duyet)
            AND (
              yc.ma_yeu_cau IS NULL
              OR yc.trang_thai NOT IN (:khoa_tu_choi, :giam_doc_tu_choi, :legacy_tu_choi)
            )) AS total`,
    {
      ma_co_van,
      da_phan_cong: PHAN_CONG.DA_PHAN_CONG,
      cho_giam_doc_duyet: PHAN_CONG.CHO_GIAM_DOC_DUYET,
      khoa_tu_choi: YEU_CAU_THAY_THE.KHOA_TU_CHOI,
      giam_doc_tu_choi: YEU_CAU_THAY_THE.GIAM_DOC_TU_CHOI,
      legacy_tu_choi: YEU_CAU_THAY_THE.LEGACY_BI_TU_CHOI
    }
  );
  return Number(rows[0].total);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

// Kiem tra CVHT co thuoc Khoa, tai khoan dang hoat dong, uu_tien hop le va chua vuot tai.
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



// Truong Khoa xem cac yeu cau phan cong thuoc khoa minh, khong lay cac PHAN_CONG tao cho luong thay the.
export async function listAssignments(user) {
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
     WHERE l.ma_khoa = :ma_khoa
       AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
     ORDER BY pc.nam_hoc DESC, pc.trang_thai, l.ten_lop`,
    { ma_khoa: user.ma_khoa }
  );
}

// Lay danh sach CVHT dang hoat dong trong khoa kem so lop dang phu trach de ho tro phan cong.
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

// Truong Khoa cap nhat uu_tien 1-3 cho CVHT; auto-assign se uu tien so nho hon va bo qua muc 3.
export async function updateAdvisorPriority(user, ma_co_van, uu_tien) {
  if (![1, 2, 3].includes(Number(uu_tien))) throw badRequest('Độ ưu tiên chỉ từ 1 đến 3');
  const result = await query(
    'UPDATE CVHT SET uu_tien = :uu_tien WHERE ma_co_van = :ma_co_van AND ma_khoa = :ma_khoa',
    { uu_tien: Number(uu_tien), ma_co_van, ma_khoa: user.ma_khoa }
  );
  if (!result.affectedRows) throw notFound('Không tìm thấy cố vấn học tập thuộc Khoa');
  return { message: 'Cập nhật độ ưu tiên thành công' };
}

// Phan cong tu dong cho cac lop dang Cho phan cong: uu tien dung chuyen nganh, uu_tien thap va CVHT con slot.
export async function autoAssignAdvisors(user) {
  return transaction(async (connection) => {
    const [assignments] = await connection.execute(
      `SELECT pc.ma_phan_cong, pc.ma_lop, pc.ma_co_van, pc.nam_hoc, pc.trang_thai,
              l.ten_lop, l.chuyen_nganh
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE l.ma_khoa = ? AND pc.trang_thai = ?
         AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
       ORDER BY l.chuyen_nganh, l.ten_lop`,
      [user.ma_khoa, PHAN_CONG.CHO_PHAN_CONG]
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
         AND (
           NOT EXISTS (
             SELECT 1
             FROM YEU_CAU_THAY_THE pending_yc
             WHERE pending_yc.ma_phan_cong = pending.ma_phan_cong
               AND pending_yc.trang_thai IN (?, ?, ?)
           )
         )
       WHERE cv.ma_khoa = ? AND tk.is_active = true AND cv.uu_tien <> 3
       GROUP BY cv.ma_co_van, cv.ho_va_ten, cv.chuyen_nganh, cv.uu_tien
       ORDER BY cv.uu_tien, cv.ho_va_ten`,
      [
        PHAN_CONG.DA_PHAN_CONG,
        PHAN_CONG.CHO_GIAM_DOC_DUYET,
        YEU_CAU_THAY_THE.KHOA_TU_CHOI,
        YEU_CAU_THAY_THE.GIAM_DOC_TU_CHOI,
        YEU_CAU_THAY_THE.LEGACY_BI_TU_CHOI,
        user.ma_khoa
      ]
    );
    const advisors = advisorRows.map((advisor) => ({
      ...advisor,
      uu_tien: Number(advisor.uu_tien),
      so_lop_dang_phu_trach: Number(advisor.so_lop_dang_phu_trach)
    }));
    if (!advisors.length) throw badRequest('Không có cố vấn học tập khả dụng để phân công');

    const emptyAssignments = assignments.filter((assignment) => !assignment.ma_co_van);
    if (!emptyAssignments.length) throw badRequest('Tất cả lớp đang phân công đã có cố vấn học tập');

    let assignedCount = 0;
    let skippedCount = 0;
    for (const assignment of emptyAssignments) {
      const classMajor = normalizeText(assignment.chuyen_nganh);
      const candidates = advisors
        .filter((advisor) => advisor.so_lop_dang_phu_trach < 2)
        .sort((a, b) => {
          const aMajorMatch = normalizeText(a.chuyen_nganh) === classMajor ? 0 : 1;
          const bMajorMatch = normalizeText(b.chuyen_nganh) === classMajor ? 0 : 1;
          return a.uu_tien - b.uu_tien
            || a.so_lop_dang_phu_trach - b.so_lop_dang_phu_trach
            || aMajorMatch - bMajorMatch
            || a.ho_va_ten.localeCompare(b.ho_va_ten);
        });
      const advisor = candidates[0];
      if (!advisor) {
        skippedCount += 1;
        continue;
      }

      await connection.execute(
        'UPDATE PHAN_CONG SET ma_co_van = ?, trang_thai = ?, ten_truong_khoa = ? WHERE ma_phan_cong = ?',
        [advisor.ma_co_van, PHAN_CONG.DA_PHAN_CONG, user.ho_va_ten, assignment.ma_phan_cong]
      );
      advisor.so_lop_dang_phu_trach += 1;
      assignedCount += 1;
    }

    if (!assignedCount) throw badRequest('Không đủ cố vấn học tập khả dụng để phân công');
    return {
      message: skippedCount
        ? `Đã phân công tự động ${assignedCount} lớp, còn ${skippedCount} lớp chưa phân công vì không còn cố vấn học tập đủ điều kiện`
        : `Đã phân công tự động ${assignedCount} lớp`
    };
  });
}

// Truong Khoa chon CVHT thu cong cho mot PHAN_CONG thuoc khoa minh truoc khi gui len CTSV.
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
    if (![PHAN_CONG.CHO_PHAN_CONG, PHAN_CONG.DA_PHAN_CONG].includes(assignment.trang_thai)) {
      throw badRequest('Chỉ phân công khi trạng thái chờ phân công hoặc đã phân công');
    }
    await assertAdvisorAssignable(user.ma_khoa, ma_co_van);
    await connection.execute(
      'UPDATE PHAN_CONG SET ma_co_van = ?, trang_thai = ?, ten_truong_khoa = ? WHERE ma_phan_cong = ?',
      [ma_co_van, PHAN_CONG.DA_PHAN_CONG, user.ho_va_ten, ma_phan_cong]
    );
    return { message: 'Đã chọn cố vấn học tập cho lớp' };
  });
}

// Gui mot phan cong da chon CVHT len CTSV/Giam doc, chuyen sang trang thai cho duyet cuoi.
export async function submitAssignment(user, ma_phan_cong) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT pc.*, l.ma_khoa, l.ten_lop
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE pc.ma_phan_cong = ?`,
      [ma_phan_cong]
    );
    const assignment = rows[0];
    if (!assignment) throw notFound('Không tìm thấy phân công');
    if (assignment.ma_khoa !== user.ma_khoa) throw forbidden('Chỉ thao tác dữ liệu thuộc Khoa mình');
    if (!assignment.ma_co_van) throw badRequest('Cần chọn cố vấn học tập trước khi gửi Phòng Công tác Sinh viên');
    assertTransition('phanCong', assignment.trang_thai, PHAN_CONG.CHO_GIAM_DOC_DUYET);
    await connection.execute('UPDATE PHAN_CONG SET trang_thai = ?, ten_truong_khoa = ? WHERE ma_phan_cong = ?', [
      PHAN_CONG.CHO_GIAM_DOC_DUYET,
      user.ho_va_ten,
      ma_phan_cong
    ]);
    await createSystemNotification(connection, {
      tieu_de: 'Khoa gửi phân công cần duyệt',
      noi_dung: `Khoa đã gửi phân công cố vấn lớp ${assignment.ten_lop || assignment.ma_lop} lên Phòng CTSV.`,
      recipients: [{ loai_nguoi_nhan: 'ctsv', ma_doi_tuong: 'ALL' }]
    });
    return { message: 'Đã gửi danh sách phân công cho Phòng Công tác Sinh viên' };
  });
}

// Gui hang loat phan cong da co CVHT cua Khoa len CTSV/Giam doc de duyet cuoi.
export async function submitAllAssignments(user) {
  return transaction(async (connection) => {
    const [assignments] = await connection.execute(
      `SELECT pc.ma_phan_cong, pc.ma_co_van, l.ten_lop
       FROM PHAN_CONG pc
       JOIN LOP l ON l.ma_lop = pc.ma_lop
       WHERE l.ma_khoa = ? AND pc.trang_thai IN (?, ?)
         AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)
       ORDER BY l.ten_lop`,
      [user.ma_khoa, PHAN_CONG.CHO_PHAN_CONG, PHAN_CONG.DA_PHAN_CONG]
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
       WHERE l.ma_khoa = ? AND pc.trang_thai = ?
         AND pc.ma_phan_cong NOT IN (SELECT ma_phan_cong FROM YEU_CAU_THAY_THE)`,
      [PHAN_CONG.CHO_GIAM_DOC_DUYET, user.ho_va_ten, user.ma_khoa, PHAN_CONG.DA_PHAN_CONG]
    );
    await createSystemNotification(connection, {
      tieu_de: 'Khoa gửi danh sách phân công cần duyệt',
      noi_dung: `Khoa đã gửi ${assignments.length} phân công cố vấn lên Phòng CTSV.`,
      recipients: [{ loai_nguoi_nhan: 'ctsv', ma_doi_tuong: 'ALL' }]
    });

    return { message: `Đã gửi ${assignments.length} phân công cho Phòng Công tác Sinh viên` };
  });
}

// Truong Khoa xem toan bo yeu cau thay the cua khoa, gom request moi, dang cho Giam doc va lich su.
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
     ORDER BY yc.ngay_yeu_cau DESC, yc.ma_yeu_cau DESC`,
    { ma_khoa: user.ma_khoa }
  );
}


// Khoa duyet buoc 1 yeu cau thay the: chon CVHT moi, luu vao PHAN_CONG va chuyen CTSV/Giam doc duyet tiep.
export async function approveReplacementStep1(user, ma_yeu_cau, ma_co_van_moi) {
  return transaction(async (connection) => {
    const nextAdvisorId = String(ma_co_van_moi || '').trim();
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
    if (!nextAdvisorId) throw badRequest('Cần chọn cố vấn mới thay thế');
    if (request.ma_co_van === nextAdvisorId) throw badRequest('Cố vấn học tập mới phải khác cố vấn học tập hiện tại');
    assertTransition('thayThe', request.trang_thai, YEU_CAU_THAY_THE.DA_DUYET_BUOC_1);
    await assertAdvisorAssignable(user.ma_khoa, nextAdvisorId);
    await connection.execute('UPDATE PHAN_CONG SET ma_co_van = ?, trang_thai = ?, ten_truong_khoa = ? WHERE ma_phan_cong = ?', [
      nextAdvisorId,
      PHAN_CONG.DA_PHAN_CONG,
      user.ho_va_ten,
      request.ma_phan_cong
    ]);
    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ?, ten_truong_khoa = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_1,
      user.ho_va_ten,
      ma_yeu_cau
    ]);
    await createSystemNotification(connection, {
      tieu_de: 'Khoa đã duyệt yêu cầu thay thế cố vấn',
      noi_dung: `Yêu cầu dừng cố vấn lớp ${request.ma_lop} đã được Khoa duyệt và gửi Giám đốc xét duyệt.`,
      recipients: [
        { loai_nguoi_nhan: 'ctsv', ma_doi_tuong: 'ALL' },
        { loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van }
      ]
    });
    return { message: 'Khoa đã duyệt và chọn cố vấn học tập mới' };
  });
}

// Khoa tu choi yeu cau thay the o buoc 1, ket thuc request va chi thong bao lai CVHT gui don.
export async function rejectReplacementStep1(user, ma_yeu_cau) {
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
    if (![YEU_CAU_THAY_THE.CHO_DUYET, YEU_CAU_THAY_THE.KHOA_DANG_DUYET].includes(request.trang_thai)) {
      throw badRequest('Chỉ từ chối ở bước Khoa đang duyệt');
    }
    await connection.execute('UPDATE YEU_CAU_THAY_THE SET trang_thai = ? WHERE ma_yeu_cau = ?', [
      YEU_CAU_THAY_THE.BI_TU_CHOI,
      ma_yeu_cau
    ]);
    await createSystemNotification(connection, {
      tieu_de: 'Khoa đã từ chối yêu cầu thay thế cố vấn',
      noi_dung: `Yêu cầu dừng cố vấn lớp ${request.ma_lop} đã bị Khoa từ chối.`,
      recipients: [{ loai_nguoi_nhan: 'covan', ma_doi_tuong: request.ma_co_van }]
    });
    return { message: 'Khoa đã từ chối yêu cầu thay thế' };
  });
}
