import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { forbidden, HttpError } from '../utils/httpError.js';

async function loadActiveProfile(account) {
  if (account.loai_tai_khoan === 'admin') {
    const rows = await query('SELECT ma_admin, ho_va_ten FROM QUAN_TRI_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0];
  }
  if (account.loai_tai_khoan === 'ctsv') {
    const rows = await query('SELECT ma_nhan_vien, ho_va_ten FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0];
  }
  if (account.loai_tai_khoan === 'khoa') {
    const rows = await query('SELECT ma_nhan_vien, ma_khoa, ho_va_ten FROM TRUONG_KHOA WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0];
  }
  if (account.loai_tai_khoan === 'covan') {
    const rows = await query('SELECT ma_co_van, ma_khoa, ho_va_ten FROM CVHT WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0];
  }
  if (account.loai_tai_khoan === 'sinhvien') {
    const rows = await query('SELECT ma_sinh_vien, ma_lop, ho_va_ten FROM SINH_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0];
  }
  return null;
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Chưa đăng nhập');

    const payload = jwt.verify(token, env.jwtSecret);
    const rows = await query(
      `SELECT ma_tai_khoan, ten_tai_khoan, email, loai_tai_khoan, da_doi_mk, is_active
       FROM TAI_KHOAN WHERE ma_tai_khoan = :ma_tai_khoan`,
      { ma_tai_khoan: payload.ma_tai_khoan }
    );
    const account = rows[0];
    if (!account || !account.is_active) throw new HttpError(401, 'Tài khoản không khả dụng hoặc đã ngừng hoạt động');
    const profile = await loadActiveProfile(account);
    if (!profile) throw new HttpError(401, 'Tài khoản không còn hồ sơ vai trò hợp lệ');

    req.user = { ma_tai_khoan: payload.ma_tai_khoan, ...account, ...profile };
    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, 'Phiên đăng nhập không hợp lệ'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.loai_tai_khoan)) {
      return next(forbidden());
    }
    next();
  };
}

export function requirePasswordChanged(req, res, next) {
  if (!req.user?.da_doi_mk) {
    return next(new HttpError(428, 'Cần đổi mật khẩu lần đầu trước khi sử dụng hệ thống'));
  }
  next();
}
