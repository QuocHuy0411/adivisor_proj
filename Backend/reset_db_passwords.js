import mysql from 'mysql2/promise';
import { env } from './src/config/env.js';
import { hashPassword } from './src/utils/passwords.js';

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database
  });

  console.log('Resetting database passwords to default...');

  const adminPassword = await hashPassword('admin');
  const ctsvPassword = await hashPassword('ctsv');
  const khoaPassword = await hashPassword('cntt02');
  const cvhtPassword = await hashPassword('cvht');
  const svPassword = await hashPassword('0900000001');

  await connection.query(
    `UPDATE TAI_KHOAN SET mat_khau = ?, da_doi_mk = false WHERE ma_tai_khoan = 'TK_ADMIN'`,
    [adminPassword]
  );
  await connection.query(
    `UPDATE TAI_KHOAN SET mat_khau = ?, da_doi_mk = false WHERE ma_tai_khoan = 'TK_CTSV01'`,
    [ctsvPassword]
  );
  await connection.query(
    `UPDATE TAI_KHOAN SET mat_khau = ?, da_doi_mk = false WHERE ma_tai_khoan = 'TK_TK_CNTT'`,
    [khoaPassword]
  );
  await connection.query(
    `UPDATE TAI_KHOAN SET mat_khau = ?, da_doi_mk = false WHERE ma_tai_khoan = 'TK_CVHT01'`,
    [cvhtPassword]
  );
  await connection.query(
    `UPDATE TAI_KHOAN SET mat_khau = ?, da_doi_mk = false WHERE ma_tai_khoan = 'TK_SV001'`,
    [svPassword]
  );

  console.log('Successfully reset all passwords to default and set da_doi_mk = false!');
  await connection.end();
}

main().catch((err) => {
  console.error('Failed to reset passwords:', err);
  process.exit(1);
});
