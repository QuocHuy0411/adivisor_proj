import { query, transaction } from '../../config/db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';
import { PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';
import { createSystemNotification } from '../notifications/notifications.service.js';

// Tinh nam hoc hien tai theo cung logic voi phan cong de request thay the khong lech nam hoc.
function currentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

// Dashboard CVHT: chi tra ve cac lop ma CVHT dang truc tiep phu trach.
export async function myClasses(user) {
  return query(
    `SELECT l.*, k.ten_khoa
     FROM LOP l
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     WHERE l.ma_co_van = :ma_co_van
     ORDER BY l.nam_hoc DESC, l.ten_lop`,
    { ma_co_van: user.ma_co_van }
  );
}

// CVHT xem danh sach sinh vien cua lop minh; chan truy cap lop khong thuoc pham vi phu trach.
export async function classStudents(user, ma_lop) {
  const classes = await query('SELECT * FROM LOP WHERE ma_lop = :ma_lop AND ma_co_van = :ma_co_van', {
    ma_lop,
    ma_co_van: user.ma_co_van
  });
  if (!classes[0]) throw forbidden('Cố vấn học tập chỉ xem sinh viên lớp mình phụ trách');
  return query(
    `SELECT sv.ma_sinh_vien, sv.ho_va_ten, sv.so_dien_thoai, tk.email, tk.is_active
     FROM SINH_VIEN sv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan AND tk.is_active = true
     WHERE sv.ma_lop = :ma_lop
     ORDER BY tk.is_active DESC, sv.ma_sinh_vien ASC`,
    { ma_lop }
  );
}

// CVHT gui don xin dung co van: tao PHAN_CONG moi cho luong thay the va YEU_CAU_THAY_THE o trang thai Cho duyet.
export async function createReplacementRequest(user, payload) {
  if (!payload.ma_lop || !payload.ly_do) throw badRequest('Cần chọn lớp và nhập lý do');
  const rows = await query('SELECT * FROM LOP WHERE ma_lop = :ma_lop AND ma_co_van = :ma_co_van', {
    ma_lop: payload.ma_lop,
    ma_co_van: user.ma_co_van
  });
  const lop = rows[0];
  if (!lop) throw forbidden('Chỉ gửi yêu cầu cho lớp đang phụ trách');

  const pendingRequests = await query(
    `SELECT yc.* 
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     WHERE pc.ma_lop = :ma_lop
       AND yc.trang_thai IN (:cho_duyet, :khoa_dang_duyet, :khoa_da_duyet, :giam_doc_dang_duyet)`,
    { 
      ma_lop: payload.ma_lop, 
      cho_duyet: YEU_CAU_THAY_THE.CHO_DUYET,
      khoa_dang_duyet: YEU_CAU_THAY_THE.KHOA_DANG_DUYET,
      khoa_da_duyet: YEU_CAU_THAY_THE.KHOA_DA_DUYET,
      giam_doc_dang_duyet: YEU_CAU_THAY_THE.GIAM_DOC_DANG_DUYET
    }
  );
  if (pendingRequests.length > 0) {
    throw badRequest('Lớp này đang có yêu cầu thay thế chờ xử lý, không thể gửi thêm');
  }

  return transaction(async (connection) => {
    const ma_phan_cong = makeId('PC');
    const ma_yeu_cau = makeId('YC');
    const nam_hoc = currentAcademicYear();
    await connection.execute(
      `INSERT INTO PHAN_CONG (ma_phan_cong, ma_lop, ma_co_van, nam_hoc, trang_thai, ngay_phan_cong)
       VALUES (?, ?, NULL, ?, ?, NULL)`,
      [ma_phan_cong, payload.ma_lop, nam_hoc, PHAN_CONG.CHO_PHAN_CONG]
    );
    await connection.execute(
      `INSERT INTO YEU_CAU_THAY_THE
       (ma_yeu_cau, ma_co_van, ma_phan_cong, ly_do, trang_thai, ngay_yeu_cau)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [ma_yeu_cau, user.ma_co_van, ma_phan_cong, payload.ly_do, YEU_CAU_THAY_THE.CHO_DUYET]
    );
    await createSystemNotification(connection, {
      tieu_de: 'Cố vấn gửi yêu cầu thay thế',
      noi_dung: `Cố vấn học tập đã gửi yêu cầu dừng cố vấn lớp ${lop.ten_lop || payload.ma_lop}.`,
      recipients: [{ loai_nguoi_nhan: 'khoa', ma_doi_tuong: lop.ma_khoa }]
    });
    return { message: 'Đã gửi yêu cầu dừng cố vấn lên Khoa', ma_yeu_cau };
  });
}

// Bang Yeu cau da gui cua CVHT: tra ve ca request hien tai va lich su theo thu tu moi nhat truoc.
export async function myReplacementRequests(user) {
  return query(
    `SELECT yc.*, pc.ma_lop, pc.ma_co_van AS ma_co_van_moi, l.ten_lop,
            CASE
              WHEN yc.trang_thai IN (:giam_doc_tu_choi, :khoa_tu_choi, :legacy_tu_choi) THEN NULL
              WHEN moi_tk.ma_tai_khoan IS NULL THEN NULL
              ELSE moi.ho_va_ten
            END AS ten_co_van_moi
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT moi ON moi.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN moi_tk ON moi_tk.ma_tai_khoan = moi.ma_tai_khoan AND moi_tk.is_active = true
     WHERE yc.ma_co_van = :ma_co_van
     ORDER BY yc.ngay_yeu_cau DESC, yc.ma_yeu_cau DESC`,
    {
      ma_co_van: user.ma_co_van,
      giam_doc_tu_choi: YEU_CAU_THAY_THE.GIAM_DOC_TU_CHOI,
      khoa_tu_choi: YEU_CAU_THAY_THE.KHOA_TU_CHOI,
      legacy_tu_choi: YEU_CAU_THAY_THE.LEGACY_BI_TU_CHOI
    }
  );
}

// Dashboard CVHT: lay ho so ca nhan, khoa va email cua co van dang dang nhap.
export async function advisorInfo(user) {
  const rows = await query(
    `SELECT cv.*, tk.email, k.ten_khoa
     FROM CVHT cv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan AND tk.is_active = true
     JOIN KHOA k ON k.ma_khoa = cv.ma_khoa
     WHERE cv.ma_co_van = :ma_co_van`,
    { ma_co_van: user.ma_co_van }
  );
  if (!rows[0]) throw notFound('Không tìm thấy cố vấn học tập');
  return rows[0];
}
