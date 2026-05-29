// reset-data.js
// Script to wipe all tables and reload sample data (seed-data.sql)
// Usage: `node Backend/src/reset-data.js`

import { pool } from './config/db.js';
import fs from 'fs';
import path from 'path';

const tables = [
  'THONG_BAO_NGUOI_NHAN',
  'THONG_BAO',
  'YEU_CAU_THAY_THE',
  'PHAN_CONG',
  'SINH_VIEN',
  'LOP',
  'CVHT',
  'TRUONG_KHOA',
  'KHOA',
  // add other lookup tables if needed
];

async function cleanTables() {
  await pool.getConnection().then(async conn => {
    try {
      await conn.beginTransaction();
      for (const tbl of tables) {
        await conn.query(`DELETE FROM ${tbl}`);
      }
      await conn.commit();
      console.log('✅ All tables cleaned');
    } catch (err) {
      await conn.rollback();
      console.error('❌ Clean failed', err);
      throw err;
    } finally {
      conn.release();
    }
  });
}

async function loadSeed() {
  const seedPath = path.resolve('Backend/src/seed-data.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');
  // split on semicolon, keep statements ending with ;
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s + ';');

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.error('❌ Failed to execute statement:', stmt);
      console.error(err);
      throw err;
    }
  }
  console.log('✅ Seed data loaded');
}

async function main() {
  try {
    await cleanTables();
    await loadSeed();
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
}

main();
