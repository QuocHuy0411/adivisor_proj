import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { forbidden, HttpError } from '../utils/httpError.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Chua dang nhap');

    const payload = jwt.verify(token, env.jwtSecret);
    const rows = await query(
      `SELECT ma_tai_khoan, ten_tai_khoan, email, loai_tai_khoan, da_doi_mk, is_active
       FROM TAI_KHOAN WHERE ma_tai_khoan = :ma_tai_khoan`,
      { ma_tai_khoan: payload.ma_tai_khoan }
    );
    const account = rows[0];
    if (!account || !account.is_active) throw new HttpError(401, 'Tai khoan khong kha dung');

    req.user = { ...payload, ...account };
    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, 'Phien dang nhap khong hop le'));
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
    return next(new HttpError(428, 'Can doi mat khau lan dau truoc khi su dung he thong'));
  }
  next();
}
