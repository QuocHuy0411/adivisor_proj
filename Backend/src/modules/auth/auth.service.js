import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { badRequest, forbidden, HttpError } from '../../utils/httpError.js';
import { hashPassword, verifyPassword } from '../../utils/passwords.js';

async function loadProfile(account) {
  if (account.loai_tai_khoan === 'admin') {
    const rows = await query('SELECT ma_admin, ho_va_ten FROM QUAN_TRI_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'ctsv') {
    const rows = await query('SELECT ma_nhan_vien, ho_va_ten FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'khoa') {
    const rows = await query('SELECT ma_nhan_vien, ma_khoa, ho_va_ten FROM TRUONG_KHOA WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'covan') {
    const rows = await query('SELECT ma_co_van, ma_khoa, ho_va_ten FROM CVHT WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'sinhvien') {
    const rows = await query('SELECT ma_sinh_vien, ma_lop, ho_va_ten FROM SINH_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  return {};
}

export async function buildSession(account) {
  const profile = await loadProfile(account);
  const payload = {
    ma_tai_khoan: account.ma_tai_khoan,
    ten_tai_khoan: account.ten_tai_khoan,
    loai_tai_khoan: account.loai_tai_khoan,
    ...profile
  };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  return {
    token,
    user: {
      ma_tai_khoan: account.ma_tai_khoan,
      ten_tai_khoan: account.ten_tai_khoan,
      email: account.email,
      loai_tai_khoan: account.loai_tai_khoan,
      da_doi_mk: Boolean(account.da_doi_mk),
      is_active: Boolean(account.is_active),
      ...profile
    }
  };
}

export async function login({ ten_tai_khoan, mat_khau }) {
  if (!ten_tai_khoan || !mat_khau) throw badRequest('Vui long nhap ten tai khoan va mat khau');

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ten_tai_khoan = :ten_tai_khoan', { ten_tai_khoan });
  const account = rows[0];
  if (!account) throw new HttpError(401, 'Sai ten tai khoan hoac mat khau');
  if (!account.is_active) throw forbidden('Tai khoan da bi khoa hoac ngung hoat dong');

  const ok = await verifyPassword(mat_khau, account.mat_khau);
  if (!ok) throw new HttpError(401, 'Sai ten tai khoan hoac mat khau');

  return buildSession(account);
}

export async function changePassword(user, { mat_khau_cu, mat_khau_moi, nhap_lai_mat_khau_moi }) {
  if (!mat_khau_cu || !mat_khau_moi) throw badRequest('Vui long nhap day du thong tin');
  if (mat_khau_moi !== nhap_lai_mat_khau_moi) throw badRequest('Mat khau moi khong khop');
  if (String(mat_khau_moi).length < 6) throw badRequest('Mat khau moi can toi thieu 6 ky tu');

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: user.ma_tai_khoan });
  const account = rows[0];
  const ok = await verifyPassword(mat_khau_cu, account.mat_khau);
  if (!ok) throw badRequest('Mat khau cu khong dung');

  const hashed = await hashPassword(mat_khau_moi);
  await query(
    'UPDATE TAI_KHOAN SET mat_khau = :hashed, da_doi_mk = true WHERE ma_tai_khoan = :id',
    { hashed, id: user.ma_tai_khoan }
  );
  return { message: 'Doi mat khau thanh cong' };
}

export async function me(user) {
  return buildSession(user);
}
