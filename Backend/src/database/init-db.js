import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/passwords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSqlFile(connection, fileName) {
  const sql = await fs.readFile(path.join(__dirname, fileName), 'utf8');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function seedAccounts(connection) {
  const adminPassword = await hashPassword('admin');
  const ctsvPassword = await hashPassword('ctsv');
  const khoaPassword = await hashPassword('cntt02');
  const cvhtPassword = await hashPassword('cvht');
  const svPassword = await hashPassword('0900000001');

  await connection.query(
    `INSERT IGNORE INTO TAI_KHOAN
    (ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan, da_doi_mk, is_active)
    VALUES
    ('TK_ADMIN', 'admin', ?, 'admin@adivisor.local', 'admin', false, true),
    ('TK_CTSV01', 'CTSV01', ?, 'ctsv01@adivisor.local', 'ctsv', false, true),
    ('TK_TK_CNTT', 'TKCNTT01', ?, 'truongkhoa.cntt@adivisor.local', 'khoa', false, true),
    ('TK_CVHT01', 'CVHT01', ?, 'cvht01@adivisor.local', 'covan', false, true),
    ('TK_SV001', 'SV001', ?, 'sv001@adivisor.local', 'sinhvien', false, true)`,
    [adminPassword, ctsvPassword, khoaPassword, cvhtPassword, svPassword]
  );

  await connection.query(
    `INSERT IGNORE INTO QUAN_TRI_VIEN (ma_admin, ma_tai_khoan, ho_va_ten)
     VALUES ('ADMIN01', 'TK_ADMIN', 'Quản trị viên hệ thống')`
  );
  await connection.query(
    `INSERT IGNORE INTO NHAN_VIEN_CTSV (ma_nhan_vien, ma_tai_khoan, ho_va_ten)
     VALUES ('CTSV01', 'TK_CTSV01', 'Nhân viên CTSV mẫu')`
  );
  await connection.query(
    `INSERT IGNORE INTO TRUONG_KHOA (ma_nhan_vien, ma_tai_khoan, ma_khoa, ho_va_ten)
     VALUES ('TKCNTT01', 'TK_TK_CNTT', 'CNTT', 'Trưởng khoa CNTT')`
  );
  await connection.query(
    `INSERT IGNORE INTO CVHT
     (ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh)
     VALUES ('CVHT01', 'TK_CVHT01', 'CNTT', 'Cố vấn học tập mẫu', '0900000000', 1, 'Công nghệ phần mềm')`
  );
  await connection.query(
    `INSERT IGNORE INTO LOP
     (ma_lop, ma_khoa, ten_lop, so_luong_sv, chuyen_nganh, nam_hoc, ma_co_van, trang_thai_lop)
     VALUES ('D21CQCN01', 'CNTT', 'D21CQCN01', 1, 'Công nghệ phần mềm', '2026-2027', NULL, 'Chưa có cố vấn')`
  );
  await connection.query(
    `INSERT IGNORE INTO SINH_VIEN
     (ma_sinh_vien, ma_tai_khoan, ma_lop, ho_va_ten, so_dien_thoai)
     VALUES ('SV001', 'TK_SV001', 'D21CQCN01', 'Sinh viên mẫu', '0900000001')`
  );
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  if (Number(rows[0].total) === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function main() {
  const bootstrap = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true
  });

  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (error) {
    if (error.code !== 'ER_DBACCESS_DENIED_ERROR' && error.code !== 'ER_DB_CREATE_EXISTS') {
      throw error;
    }
  }
  await bootstrap.changeUser({ database: env.db.database });

  await runSqlFile(bootstrap, 'schema.sql');
  await bootstrap.query('ALTER TABLE CVHT MODIFY ma_tai_khoan VARCHAR(50) NULL');
  await addColumnIfMissing(bootstrap, 'PHAN_CONG', 'ten_truong_khoa', 'VARCHAR(255) NULL');
  await addColumnIfMissing(bootstrap, 'YEU_CAU_THAY_THE', 'ten_truong_khoa', 'VARCHAR(255) NULL');
  await runSqlFile(bootstrap, 'seed.sql');
  await seedAccounts(bootstrap);
  await bootstrap.end();

  console.log('Khoi tao database thanh cong');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
