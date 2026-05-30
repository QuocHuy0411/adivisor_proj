import { query, transaction } from '../../config/db.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';
import { PHAN_CONG, YEU_CAU_THAY_THE } from '../../utils/stateMachine.js';

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
     WHERE pc.ma_lop = :ma_lop AND yc.trang_thai NOT IN (:da_dong, :tu_choi)`,
    { 
      ma_lop: payload.ma_lop, 
      da_dong: YEU_CAU_THAY_THE.DA_DONG, 
      tu_choi: YEU_CAU_THAY_THE.BI_TU_CHOI 
    }
  );
  if (pendingRequests.length > 0) {
    throw badRequest('Lớp này đang có yêu cầu thay thế chờ xử lý, không thể gửi thêm');
  }

  return transaction(async (connection) => {
    const ma_phan_cong = makeId('PC');
    const ma_yeu_cau = makeId('YC');
    await connection.execute(
      `INSERT INTO PHAN_CONG (ma_phan_cong, ma_lop, ma_co_van, nam_hoc, trang_thai, ngay_phan_cong)
       VALUES (?, ?, NULL, ?, ?, NULL)`,
      [ma_phan_cong, payload.ma_lop, lop.nam_hoc, PHAN_CONG.CHO_PHAN_CONG]
    );
    await connection.execute(
      `INSERT INTO YEU_CAU_THAY_THE
       (ma_yeu_cau, ma_co_van, ma_phan_cong, ly_do, trang_thai, ngay_yeu_cau)
       VALUES (?, ?, ?, ?, ?, CURDATE())`,
      [ma_yeu_cau, user.ma_co_van, ma_phan_cong, payload.ly_do, YEU_CAU_THAY_THE.CHO_DUYET]
    );
    return { message: 'Đã gửi yêu cầu dừng cố vấn lên Khoa', ma_yeu_cau };
  });
}

export async function myReplacementRequests(user) {
  return query(
    `SELECT yc.*, pc.ma_lop, pc.ma_co_van AS ma_co_van_moi, l.ten_lop,
            CASE WHEN moi_tk.ma_tai_khoan IS NULL THEN NULL ELSE moi.ho_va_ten END AS ten_co_van_moi
     FROM YEU_CAU_THAY_THE yc
     JOIN PHAN_CONG pc ON pc.ma_phan_cong = yc.ma_phan_cong
     JOIN LOP l ON l.ma_lop = pc.ma_lop
     LEFT JOIN CVHT moi ON moi.ma_co_van = pc.ma_co_van
     LEFT JOIN TAI_KHOAN moi_tk ON moi_tk.ma_tai_khoan = moi.ma_tai_khoan AND moi_tk.is_active = true
     WHERE yc.ma_co_van = :ma_co_van
     ORDER BY yc.ngay_yeu_cau DESC`,
    { ma_co_van: user.ma_co_van }
  );
}

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
