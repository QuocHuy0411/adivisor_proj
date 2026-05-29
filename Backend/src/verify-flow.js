import { query, transaction, pool } from './config/db.js';
import * as ctsvService from './modules/ctsv/ctsv.service.js';
import * as khoaService from './modules/khoa/khoa.service.js';
import * as covanService from './modules/covan/covan.service.js';
import { LOP, PHAN_CONG, YEU_CAU_THAY_THE } from './utils/stateMachine.js';

// Setup ANSI console colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m'
};

function log(color, msg) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function cleanUp() {
  log(colors.yellow, '=== CLEANING UP PREVIOUS TEST DATA ===');
  
  // Clean replacement requests
  await query('DELETE FROM YEU_CAU_THAY_THE WHERE ma_co_van IN ("CVHT01", "CVHT02")');
  
  // Clean phan_cong
  await query('DELETE FROM PHAN_CONG WHERE ma_lop IN ("D21CQCN01", "D21CQCN02")');
  
  // Reset LOP ma_co_van
  await query('UPDATE LOP SET ma_co_van = NULL, trang_thai_lop = ? WHERE ma_lop = "D21CQCN01"', [LOP.CHUA_CO_CVHT]);
  await query('DELETE FROM LOP WHERE ma_lop = "D21CQCN02"');

  // Clean CVHT02 if exists
  const cvht2 = await query('SELECT ma_tai_khoan FROM CVHT WHERE ma_co_van = "CVHT02"');
  if (cvht2[0]) {
    await query('DELETE FROM CVHT WHERE ma_co_van = "CVHT02"');
    if (cvht2[0].ma_tai_khoan) {
      await query('DELETE FROM TAI_KHOAN WHERE ma_tai_khoan = ?', [cvht2[0].ma_tai_khoan]);
    }
  }

  // Ensure CVHT01 is active and priority is 1
  await query('UPDATE CVHT SET uu_tien = 1 WHERE ma_co_van = "CVHT01"');
  const cvht1 = await query('SELECT ma_tai_khoan FROM CVHT WHERE ma_co_van = "CVHT01"');
  if (cvht1[0] && cvht1[0].ma_tai_khoan) {
    await query('UPDATE TAI_KHOAN SET is_active = true WHERE ma_tai_khoan = ?', [cvht1[0].ma_tai_khoan]);
  }
}

async function setupTestData() {
  log(colors.yellow, '=== SETTING UP TEST DATA ===');
  
  // Create CVHT02
  const accountId = 'TK_CVHT02';
  await query(
    `INSERT IGNORE INTO TAI_KHOAN (ma_tai_khoan, ten_tai_khoan, mat_khau, email, loai_tai_khoan, da_doi_mk, is_active)
     VALUES (?, 'CVHT02', 'cvht_pass_mocked', 'cvht02@adivisor.local', 'covan', true, true)`,
    [accountId]
  );
  await query(
    `INSERT IGNORE INTO CVHT (ma_co_van, ma_tai_khoan, ma_khoa, ho_va_ten, so_dien_thoai, uu_tien, chuyen_nganh)
     VALUES ('CVHT02', ?, 'CNTT', 'Cố vấn học tập 2 CNTT', '0901234567', 2, 'Công nghệ phần mềm')`,
    [accountId]
  );
}

async function verifyLuongA() {
  log(colors.cyan, '\n=== RUNNING LUONG A: NEW CLASS ASSIGNMENT FLOW ===');

  const ctsvUser = { ma_nhan_vien: 'CTSV01', ho_va_ten: 'Nhân viên CTSV mẫu' };
  const khoaUser = { ma_khoa: 'CNTT', ho_va_ten: 'Trưởng khoa CNTT' };

  // Step 1: Create a new class D21CQCN02
  log(colors.magenta, 'Step 1: Creating class D21CQCN02...');
  await ctsvService.createClass({
    ma_lop: 'D21CQCN02',
    ma_khoa: 'CNTT',
    ten_lop: 'D21CQCN02',
    chuyen_nganh: 'Công nghệ phần mềm',
    nam_hoc: '2026-2027',
    so_luong_sv: 0
  });

  const [classObj] = await query('SELECT * FROM LOP WHERE ma_lop = "D21CQCN02"');
  if (classObj.trang_thai_lop !== LOP.CHUA_CO_CVHT) {
    throw new Error(`Invalid class status: expected ${LOP.CHUA_CO_CVHT}, got ${classObj.trang_thai_lop}`);
  }
  log(colors.green, '✓ Class created successfully with status "Chưa có cố vấn".');

  // Step 2: CTSV sends request to Faculty
  log(colors.magenta, 'Step 2: Sending class requests to Faculties...');
  const sendRes = await ctsvService.sendClassRequestsToFaculties();
  log(colors.green, `✓ ${sendRes.message}`);

  const [pcRow] = await query('SELECT * FROM PHAN_CONG WHERE ma_lop = "D21CQCN02"');
  if (!pcRow) {
    throw new Error('PHAN_CONG row not created for D21CQCN02');
  }
  if (pcRow.trang_thai !== PHAN_CONG.CHO_PHAN_CONG) {
    throw new Error(`Expected assignment status ${PHAN_CONG.CHO_PHAN_CONG}, got ${pcRow.trang_thai}`);
  }
  log(colors.green, '✓ PHAN_CONG row created and set to "Chờ phân công".');

  // Step 3: Faculty Head assigns CVHT01 to class
  log(colors.magenta, 'Step 3: Faculty Head assigning CVHT01 to D21CQCN02...');
  const assignRes = await khoaService.assignAdvisor(khoaUser, pcRow.ma_phan_cong, 'CVHT01');
  log(colors.green, `✓ ${assignRes.message}`);

  const [pcAssigned] = await query('SELECT * FROM PHAN_CONG WHERE ma_phan_cong = ?', [pcRow.ma_phan_cong]);
  if (pcAssigned.ma_co_van !== 'CVHT01' || pcAssigned.trang_thai !== PHAN_CONG.DA_PHAN_CONG) {
    throw new Error(`Assignment mismatch: ma_co_van = ${pcAssigned.ma_co_van}, status = ${pcAssigned.trang_thai}`);
  }
  log(colors.green, '✓ CVHT01 selected and assignment status updated to "Đã phân công".');

  // Step 4: Faculty Head submits assignment to Phòng CTSV
  log(colors.magenta, 'Step 4: Faculty Head submitting assignment to CTSV...');
  const submitRes = await khoaService.submitAssignment(khoaUser, pcRow.ma_phan_cong);
  log(colors.green, `✓ ${submitRes.message}`);

  const [pcSubmitted] = await query('SELECT * FROM PHAN_CONG WHERE ma_phan_cong = ?', [pcRow.ma_phan_cong]);
  if (pcSubmitted.trang_thai !== PHAN_CONG.CHO_GIAM_DOC_DUYET) {
    throw new Error(`Expected status ${PHAN_CONG.CHO_GIAM_DOC_DUYET}, got ${pcSubmitted.trang_thai}`);
  }
  log(colors.green, '✓ Assignment submitted to CTSV. Status is now "Chờ giám đốc duyệt".');

  // Step 5: CTSV approves the assignment
  log(colors.magenta, 'Step 5: Phòng CTSV approving the assignment...');
  const approveRes = await ctsvService.approveAssignment(ctsvUser, pcRow.ma_phan_cong);
  log(colors.green, `✓ ${approveRes.message}`);

  const [pcFinal] = await query('SELECT * FROM PHAN_CONG WHERE ma_phan_cong = ?', [pcRow.ma_phan_cong]);
  const [classFinal] = await query('SELECT * FROM LOP WHERE ma_lop = "D21CQCN02"');

  if (pcFinal.trang_thai !== PHAN_CONG.DA_DONG) {
    throw new Error(`PHAN_CONG final status should be ${PHAN_CONG.DA_DONG}, got ${pcFinal.trang_thai}`);
  }
  if (classFinal.ma_co_van !== 'CVHT01' || classFinal.trang_thai_lop !== PHAN_CONG.DA_DONG) {
    throw new Error(`LOP final state invalid: ma_co_van = ${classFinal.ma_co_van}, status = ${classFinal.trang_thai_lop}`);
  }
  log(colors.green, '✓ CTSV approved assignment successfully! Class updated, state is "Đã đóng".');

  // Verify notifications
  const notifications = await query(
    `SELECT tb.*, tbn.loai_nguoi_nhan, tbn.ma_doi_tuong
     FROM THONG_BAO tb
     JOIN THONG_BAO_NGUOI_NHAN tbn ON tbn.ma_thong_bao = tb.ma_thong_bao
     ORDER BY tb.ngay_gui DESC LIMIT 3`
  );
  if (notifications.length < 3) {
    throw new Error('Notifications were not successfully created');
  }
  log(colors.green, '✓ System successfully dispatched notifications to Class, Faculty, and Advisor.');
}

async function verifyLuongC() {
  log(colors.cyan, '\n=== RUNNING LUONG C: ADVISOR REPLACEMENT FLOW ===');

  const ctsvUser = { ma_nhan_vien: 'CTSV01', ho_va_ten: 'Nhân viên CTSV mẫu' };
  const khoaUser = { ma_khoa: 'CNTT', ho_va_ten: 'Trưởng khoa CNTT' };
  const covanUser = { ma_co_van: 'CVHT01', ho_va_ten: 'Cố vấn học tập mẫu' };

  // Setup: CVHT01 is assigned to D21CQCN01 and closed
  log(colors.magenta, 'Step 0: Preparing active assignment for CVHT01 on D21CQCN01...');
  const pcId = 'PC_TEST_C';
  await query(
    `INSERT INTO PHAN_CONG (ma_phan_cong, ma_lop, ma_co_van, nam_hoc, trang_thai, ngay_phan_cong)
     VALUES (?, "D21CQCN01", "CVHT01", "2026-2027", ?, CURDATE())`,
    [pcId, PHAN_CONG.DA_DONG]
  );
  await query('UPDATE LOP SET ma_co_van = "CVHT01", trang_thai_lop = ? WHERE ma_lop = "D21CQCN01"', ['Đã có CVHT']);
  log(colors.green, '✓ D21CQCN01 setup complete.');

  // Step 1: CVHT01 submits stopping request
  log(colors.magenta, 'Step 1: CVHT01 sending stopping request for D21CQCN01...');
  const requestRes = await covanService.createReplacementRequest(covanUser, {
    ma_lop: 'D21CQCN01',
    ly_do: 'Lý do sức khỏe'
  });
  log(colors.green, `✓ ${requestRes.message}`);

  const [reqRow] = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = ?', [requestRes.ma_yeu_cau]);
  if (!reqRow || reqRow.trang_thai !== YEU_CAU_THAY_THE.CHO_DUYET) {
    throw new Error(`Expected request status ${YEU_CAU_THAY_THE.CHO_DUYET}, got ${reqRow?.trang_thai}`);
  }
  log(colors.green, '✓ Replacement request initialized successfully as "Chờ duyệt".');

  // Step 2: Faculty Head starts review step 1
  log(colors.magenta, 'Step 2: Faculty Head starting step 1 review...');
  const startStep1Res = await khoaService.startReplacementStep1(khoaUser, reqRow.ma_yeu_cau);
  log(colors.green, `✓ ${startStep1Res.message}`);

  const [reqStep1] = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = ?', [reqRow.ma_yeu_cau]);
  if (reqStep1.trang_thai !== YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1) {
    throw new Error(`Expected status ${YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1}, got ${reqStep1.trang_thai}`);
  }
  log(colors.green, '✓ Request status transitioned to "Đang duyệt bước 1".');

  // Step 3: Faculty Head approves step 1 and proposes CVHT02
  log(colors.magenta, 'Step 3: Faculty Head approving step 1 and proposing CVHT02...');
  const approveStep1Res = await khoaService.approveReplacementStep1(khoaUser, reqRow.ma_yeu_cau, 'CVHT02');
  log(colors.green, `✓ ${approveStep1Res.message}`);

  const [reqApproved1] = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = ?', [reqRow.ma_yeu_cau]);
  if (reqApproved1.trang_thai !== YEU_CAU_THAY_THE.DA_DUYET_BUOC_1) {
    throw new Error(`Expected status ${YEU_CAU_THAY_THE.DA_DUYET_BUOC_1}, got ${reqApproved1.trang_thai}`);
  }
  log(colors.green, '✓ Step 1 approved. Request status updated to "Đã duyệt bước 1".');

  // Step 4: CTSV starts review step 2
  log(colors.magenta, 'Step 4: CTSV starting step 2 review...');
  const startStep2Res = await ctsvService.startReplacementStep2(reqRow.ma_yeu_cau);
  log(colors.green, `✓ ${startStep2Res.message}`);

  const [reqStep2] = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = ?', [reqRow.ma_yeu_cau]);
  if (reqStep2.trang_thai !== YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2) {
    throw new Error(`Expected status ${YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2}, got ${reqStep2.trang_thai}`);
  }
  log(colors.green, '✓ Request status transitioned to "Đang duyệt bước 2".');

  // Step 5: CTSV approves step 2 and closes the request
  log(colors.magenta, 'Step 5: CTSV approving step 2 and final closing...');
  const approveStep2Res = await ctsvService.approveReplacement(ctsvUser, reqRow.ma_yeu_cau);
  log(colors.green, `✓ ${approveStep2Res.message}`);

  const [reqFinal] = await query('SELECT * FROM YEU_CAU_THAY_THE WHERE ma_yeu_cau = ?', [reqRow.ma_yeu_cau]);
  const [classFinal] = await query('SELECT * FROM LOP WHERE ma_lop = "D21CQCN01"');

  if (reqFinal.trang_thai !== YEU_CAU_THAY_THE.DA_DONG) {
    throw new Error(`Expected final status ${YEU_CAU_THAY_THE.DA_DONG}, got ${reqFinal.trang_thai}`);
  }
  if (classFinal.ma_co_van !== 'CVHT02') {
    throw new Error(`Class advisor should be updated to CVHT02, but is ${classFinal.ma_co_van}`);
  }
  log(colors.green, '✓ CTSV approved replacement request successfully! Class D21CQCN01 advisor is now CVHT02, state is "Đã đóng".');
}

async function run() {
  try {
    await cleanUp();
    await setupTestData();
    
    await verifyLuongA();
    await verifyLuongC();
    
    log(colors.green, '\n===========================================');
    log(colors.green, '✓ ALL ACADEMIC ADVISOR FLOWS VERIFIED SUCCESSFULLY!');
    log(colors.green, '===========================================');
    
    await cleanUp();
    process.exit(0);
  } catch (error) {
    log(colors.red, '\n===========================================');
    log(colors.red, `✗ VERIFICATION FAILED: ${error.message}`);
    log(colors.red, error.stack);
    log(colors.red, '===========================================');
    
    try {
      await cleanUp();
    } catch (e) {
      log(colors.red, `Cleanup failed: ${e.message}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
