import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
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

function validateNewPassword({ mat_khau_moi, nhap_lai_mat_khau_moi }) {
  if (!mat_khau_moi || !nhap_lai_mat_khau_moi) throw badRequest('Vui long nhap day du mat khau moi');
  if (mat_khau_moi !== nhap_lai_mat_khau_moi) throw badRequest('Mat khau moi khong khop');
  if (String(mat_khau_moi).length < 6) throw badRequest('Mat khau moi can toi thieu 6 ky tu');
}

function resetSecret(account) {
  return `${env.jwtSecret}:${account.mat_khau}`;
}

function otpSecret(account) {
  return `${env.jwtSecret}:${account.mat_khau}:otp`;
}

function hashOtp(account, otp) {
  return crypto
    .createHash('sha256')
    .update(`${account.ma_tai_khoan}:${otp}:${env.jwtSecret}`)
    .digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendPasswordResetOtp(email, otp) {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.password || !env.smtp.from) {
    throw badRequest('Chua cau hinh SMTP Gmail de gui ma OTP');
  }

  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.password
    }
  });

  await transporter.sendMail({
    from: env.smtp.from,
    to: email,
    subject: 'Ma OTP dat lai mat khau Adivisor',
    text: `Ma OTP dat lai mat khau cua ban la ${otp}. Ma co hieu luc trong ${env.passwordResetOtpExpiresIn}. Neu ban khong yeu cau, vui long bo qua email nay.`
  });

  return true;
}

export async function forgotPassword({ email }) {
  if (!email) throw badRequest('Vui long nhap email');

  const rows = await query(
    'SELECT * FROM TAI_KHOAN WHERE email = :email',
    { email }
  );
  const account = rows[0];
  if (!account) throw badRequest('Email khong ton tai trong he thong');
  if (!account.is_active) throw forbidden('Tai khoan da bi khoa hoac ngung hoat dong');

  const otp = generateOtp();
  const otp_token = jwt.sign(
    {
      purpose: 'password_reset_otp',
      ma_tai_khoan: account.ma_tai_khoan,
      otp_hash: hashOtp(account, otp)
    },
    otpSecret(account),
    { expiresIn: env.passwordResetOtpExpiresIn }
  );
  await sendPasswordResetOtp(account.email, otp);

  return {
    message: 'Ma OTP da duoc gui ve email. Vui long kiem tra hop thu.',
    otp_token,
    expires_in: env.passwordResetOtpExpiresIn
  };
}

export async function verifyResetOtp({ otp_token, otp }) {
  if (!otp_token || !otp) throw badRequest('Vui long nhap ma OTP');

  const decoded = jwt.decode(otp_token);
  if (!decoded?.ma_tai_khoan || decoded?.purpose !== 'password_reset_otp') {
    throw badRequest('Ma OTP khong hop le');
  }

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: decoded.ma_tai_khoan });
  const account = rows[0];
  if (!account) throw badRequest('Ma OTP khong hop le');
  if (!account.is_active) throw forbidden('Tai khoan da bi khoa hoac ngung hoat dong');

  let verified;
  try {
    verified = jwt.verify(otp_token, otpSecret(account));
  } catch (error) {
    throw badRequest('Ma OTP da het han hoac khong hop le');
  }

  if (verified.otp_hash !== hashOtp(account, otp)) {
    throw badRequest('Ma OTP khong dung');
  }

  const reset_token = jwt.sign(
    {
      purpose: 'password_reset',
      ma_tai_khoan: account.ma_tai_khoan
    },
    resetSecret(account),
    { expiresIn: env.passwordResetExpiresIn }
  );

  return {
    message: 'Xac thuc OTP thanh cong. Vui long dat mat khau moi.',
    reset_token,
    expires_in: env.passwordResetExpiresIn
  };
}

export async function resetPassword({ reset_token, mat_khau_moi, nhap_lai_mat_khau_moi }) {
  if (!reset_token) throw badRequest('Thieu ma dat lai mat khau');
  validateNewPassword({ mat_khau_moi, nhap_lai_mat_khau_moi });

  const decoded = jwt.decode(reset_token);
  if (!decoded?.ma_tai_khoan || decoded?.purpose !== 'password_reset') {
    throw badRequest('Ma dat lai mat khau khong hop le');
  }

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: decoded.ma_tai_khoan });
  const account = rows[0];
  if (!account) throw badRequest('Ma dat lai mat khau khong hop le');
  if (!account.is_active) throw forbidden('Tai khoan da bi khoa hoac ngung hoat dong');

  try {
    jwt.verify(reset_token, resetSecret(account));
  } catch (error) {
    throw badRequest('Ma dat lai mat khau da het han hoac khong hop le');
  }

  const hashed = await hashPassword(mat_khau_moi);
  await query(
    'UPDATE TAI_KHOAN SET mat_khau = :hashed, da_doi_mk = true WHERE ma_tai_khoan = :id',
    { hashed, id: account.ma_tai_khoan }
  );

  return { message: 'Dat lai mat khau thanh cong. Vui long dang nhap lai.' };
}

export async function me(user) {
  return buildSession(user);
}
