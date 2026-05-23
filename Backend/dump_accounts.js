import mysql from 'mysql2/promise';
import { env } from './src/config/env.js';

async function main() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database
  });

  const [rows] = await connection.query('SELECT ma_tai_khoan, ten_tai_khoan, loai_tai_khoan, mat_khau, is_active FROM TAI_KHOAN');
  console.log(rows);
  
  await connection.end();
}

main().catch(console.error);
