import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';

// Dashboard Sinh vien: tra ve CVHT dang phu trach dung lop cua sinh vien dang dang nhap.
export async function myAdvisor(user) {
  const rows = await query(
    `SELECT l.ma_lop, l.ten_lop, l.nam_hoc, l.chuyen_nganh,
            cv.ma_co_van, cv.ho_va_ten AS ten_co_van, cv.so_dien_thoai,
            tk.email, k.ten_khoa
     FROM SINH_VIEN sv
     JOIN LOP l ON l.ma_lop = sv.ma_lop
     LEFT JOIN CVHT cv ON cv.ma_co_van = l.ma_co_van
     LEFT JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = cv.ma_tai_khoan AND tk.is_active = true
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     WHERE sv.ma_sinh_vien = :ma_sinh_vien`,
    { ma_sinh_vien: user.ma_sinh_vien }
  );
  if (!rows[0]) throw notFound('Không tìm thấy thông tin sinh viên');
  return rows[0];
}

// Dashboard Sinh vien: lay profile ca nhan kem lop va khoa, chi trong pham vi ma_sinh_vien cua session.
export async function myProfile(user) {
  const rows = await query(
    `SELECT sv.*, tk.email, l.ten_lop, k.ten_khoa
     FROM SINH_VIEN sv
     JOIN TAI_KHOAN tk ON tk.ma_tai_khoan = sv.ma_tai_khoan AND tk.is_active = true
     JOIN LOP l ON l.ma_lop = sv.ma_lop
     JOIN KHOA k ON k.ma_khoa = l.ma_khoa
     WHERE sv.ma_sinh_vien = :ma_sinh_vien`,
    { ma_sinh_vien: user.ma_sinh_vien }
  );
  if (!rows[0]) throw notFound('Không tìm thấy thông tin sinh viên');
  return rows[0];
}
