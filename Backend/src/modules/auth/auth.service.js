import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { badRequest, forbidden, HttpError } from '../../utils/httpError.js';
import { hashPassword, verifyPassword } from '../../utils/passwords.js';

async function ensureLoginAttemptTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS DANG_NHAP_THAT_BAI (
      ten_tai_khoan VARCHAR(100) NOT NULL,
      ngay DATE NOT NULL,
      so_lan INT NOT NULL DEFAULT 0,
      PRIMARY KEY (ten_tai_khoan, ngay)
    )`
  );
}

async function ensureRefreshTokensTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS REFRESH_TOKENS (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ma_tai_khoan VARCHAR(100) NOT NULL,
      token VARCHAR(500) NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (ma_tai_khoan) REFERENCES TAI_KHOAN(ma_tai_khoan) ON DELETE CASCADE
    )`
  );
}

async function countLoginFailuresToday(ten_tai_khoan) {
  await ensureLoginAttemptTable();
  const rows = await query(
    'SELECT so_lan FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = :ten_tai_khoan AND ngay = CURDATE()',
    { ten_tai_khoan }
  );
  return Number(rows[0]?.so_lan || 0);
}

async function recordLoginFailure(ten_tai_khoan) {
  await ensureLoginAttemptTable();
  await query(
    `INSERT INTO DANG_NHAP_THAT_BAI (ten_tai_khoan, ngay, so_lan)
     VALUES (:ten_tai_khoan, CURDATE(), 1)
     ON DUPLICATE KEY UPDATE so_lan = so_lan + 1`,
    { ten_tai_khoan }
  );
  return countLoginFailuresToday(ten_tai_khoan);
}

async function clearLoginFailures(ten_tai_khoan) {
  await ensureLoginAttemptTable();
  await query(
    'DELETE FROM DANG_NHAP_THAT_BAI WHERE ten_tai_khoan = :ten_tai_khoan AND ngay = CURDATE()',
    { ten_tai_khoan }
  );
}

async function loadProfile(account) {
  let rows;
  if (account.loai_tai_khoan === 'admin') {
    rows = await query('SELECT ma_admin, ho_va_ten FROM QUAN_TRI_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'ctsv') {
    rows = await query('SELECT ma_nhan_vien, ho_va_ten FROM NHAN_VIEN_CTSV WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'khoa') {
    rows = await query('SELECT ma_nhan_vien, ma_khoa, ho_va_ten FROM TRUONG_KHOA WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'covan') {
    rows = await query('SELECT ma_co_van, ma_khoa, ho_va_ten FROM CVHT WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  if (account.loai_tai_khoan === 'sinhvien') {
    rows = await query('SELECT ma_sinh_vien, ma_lop, ho_va_ten FROM SINH_VIEN WHERE ma_tai_khoan = :id', { id: account.ma_tai_khoan });
    return rows[0] || {};
  }
  return {};
}

export async function buildSession(account) {
  const profile = await loadProfile(account);
  if (!profile || Object.keys(profile).length === 0) {
    throw forbidden('Tài khoản không còn hồ sơ vai trò hợp lệ');
  }
  const payload = {
    ma_tai_khoan: account.ma_tai_khoan,
    ten_tai_khoan: account.ten_tai_khoan,
    loai_tai_khoan: account.loai_tai_khoan,
    ...profile
  };
  const accessToken = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  const refreshToken = jwt.sign({ ma_tai_khoan: account.ma_tai_khoan, type: 'refresh' }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn });

  await ensureRefreshTokensTable();
  await query('INSERT INTO REFRESH_TOKENS (ma_tai_khoan, token, expires_at) VALUES (:ma_tai_khoan, :token, DATE_ADD(NOW(), INTERVAL 7 DAY))', {
    ma_tai_khoan: account.ma_tai_khoan,
    token: refreshToken
  });

  return {
    accessToken,
    refreshToken,
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
  if (!ten_tai_khoan || !mat_khau) throw badRequest('Vui lòng nhập tên tài khoản và mật khẩu');
  const username = String(ten_tai_khoan).trim();
  const failures = await countLoginFailuresToday(username);
  if (failures >= 5) {
    throw new HttpError(429, 'Tài khoản đã nhập sai mật khẩu 5 lần trong ngày. Vui lòng thử lại vào ngày mai.');
  }

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ten_tai_khoan = :ten_tai_khoan', { ten_tai_khoan: username });
  const account = rows[0];
  if (!account) {
    const nextFailures = await recordLoginFailure(username);
    throw new HttpError(401, `Sai tên tài khoản hoặc mật khẩu. Còn ${Math.max(0, 5 - nextFailures)} lần thử trong ngày.`);
  }
  if (!account.is_active) throw forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');

  const ok = await verifyPassword(mat_khau, account.mat_khau);
  if (!ok) {
    const nextFailures = await recordLoginFailure(username);
    throw new HttpError(401, `Sai tên tài khoản hoặc mật khẩu. Còn ${Math.max(0, 5 - nextFailures)} lần thử trong ngày.`);
  }

  await clearLoginFailures(username);
  return buildSession(account);
}

export async function changePassword(user, { mat_khau_cu, mat_khau_moi, nhap_lai_mat_khau_moi }) {
  if (!mat_khau_cu || !mat_khau_moi) throw badRequest('Vui lòng nhập đầy đủ thông tin');
  if (mat_khau_moi !== nhap_lai_mat_khau_moi) throw badRequest('Mật khẩu mới không khớp');
  if (String(mat_khau_moi).length < 6) throw badRequest('Mật khẩu mới cần tối thiểu 6 ký tự');

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: user.ma_tai_khoan });
  const account = rows[0];
  const ok = await verifyPassword(mat_khau_cu, account.mat_khau);
  if (!ok) throw badRequest('Mật khẩu cũ không đúng');

  const hashed = await hashPassword(mat_khau_moi);
  await query(
    'UPDATE TAI_KHOAN SET mat_khau = :hashed, da_doi_mk = true WHERE ma_tai_khoan = :id',
    { hashed, id: user.ma_tai_khoan }
  );
  return { message: 'Doi mat khau thanh cong' };
}

function validateNewPassword({ mat_khau_moi, nhap_lai_mat_khau_moi }) {
  if (!mat_khau_moi || !nhap_lai_mat_khau_moi) throw badRequest('Vui lòng nhập đầy đủ mật khẩu mới');
  if (mat_khau_moi !== nhap_lai_mat_khau_moi) throw badRequest('Mật khẩu mới không khớp');
  if (String(mat_khau_moi).length < 6) throw badRequest('Mật khẩu mới cần tối thiểu 6 ký tự');
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
    throw badRequest('Chưa cấu hình SMTP Gmail để gửi mã OTP');
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
  if (!email) throw badRequest('Vui lòng nhập email');

  const rows = await query(
    'SELECT * FROM TAI_KHOAN WHERE email = :email',
    { email }
  );
  const account = rows[0];
  if (!account) throw badRequest('Email khong ton tai trong he thong');
  if (!account.is_active) throw forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');

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
    message: 'Mã OTP đã được gửi về email. Vui lòng kiểm tra hộp thư.',
    otp_token,
    expires_in: env.passwordResetOtpExpiresIn
  };
}

export async function verifyResetOtp({ otp_token, otp }) {
  if (!otp_token || !otp) throw badRequest('Vui lòng nhập mã OTP');

  const decoded = jwt.decode(otp_token);
  if (!decoded?.ma_tai_khoan || decoded?.purpose !== 'password_reset_otp') {
    throw badRequest('Ma OTP khong hop le');
  }

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: decoded.ma_tai_khoan });
  const account = rows[0];
  if (!account) throw badRequest('Ma OTP khong hop le');
  if (!account.is_active) throw forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');

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
    message: 'Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.',
    reset_token,
    expires_in: env.passwordResetExpiresIn
  };
}

export async function resetPassword({ reset_token, mat_khau_moi, nhap_lai_mat_khau_moi }) {
  if (!reset_token) throw badRequest('Thiếu mã đặt lại mật khẩu');
  validateNewPassword({ mat_khau_moi, nhap_lai_mat_khau_moi });

  const decoded = jwt.decode(reset_token);
  if (!decoded?.ma_tai_khoan || decoded?.purpose !== 'password_reset') {
    throw badRequest('Ma dat lai mat khau khong hop le');
  }

  const rows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: decoded.ma_tai_khoan });
  const account = rows[0];
  if (!account) throw badRequest('Ma dat lai mat khau khong hop le');
  if (!account.is_active) throw forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');

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

  return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
}

export async function me(user) {
  return buildSession(user);
}

export async function logoutServer(refreshToken) {
  if (!refreshToken) return;
  await ensureRefreshTokensTable();
  await query('DELETE FROM REFRESH_TOKENS WHERE token = :token', { token: refreshToken });
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new HttpError(401, 'Không có refresh token');
  
  await ensureRefreshTokensTable();
  const rows = await query('SELECT * FROM REFRESH_TOKENS WHERE token = :token AND expires_at > NOW()', { token: refreshToken });
  if (rows.length === 0) throw new HttpError(401, 'Refresh token không hợp lệ hoặc đã hết hạn');

  try {
    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);
    const accountRows = await query('SELECT * FROM TAI_KHOAN WHERE ma_tai_khoan = :id', { id: decoded.ma_tai_khoan });
    const account = accountRows[0];
    
    if (!account || !account.is_active) {
      await query('DELETE FROM REFRESH_TOKENS WHERE token = :token', { token: refreshToken });
      throw forbidden('Tài khoản đã bị khóa hoặc ngừng hoạt động');
    }

    // Xóa token cũ để sinh ra token mới (Rotation)
    await query('DELETE FROM REFRESH_TOKENS WHERE token = :token', { token: refreshToken });
    
    return await buildSession(account);
  } catch (error) {
    await query('DELETE FROM REFRESH_TOKENS WHERE token = :token', { token: refreshToken });
    throw new HttpError(401, 'Refresh token không hợp lệ');
  }
}
