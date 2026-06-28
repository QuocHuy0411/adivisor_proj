import { query, transaction } from '../../config/db.js';
import { badRequest } from '../../utils/httpError.js';
import { makeId } from '../../utils/ids.js';

// Xac dinh pham vi thong bao theo role de moi nguoi chi thay thong bao gui dung doi tuong cua minh.
function recipientClauseForUser(user) {
  if (user.loai_tai_khoan === 'admin') return { clause: '1 = 1', params: {} };
  if (user.loai_tai_khoan === 'ctsv') {
    return {
      clause: "(nn.loai_nguoi_nhan = 'ctsv' AND nn.ma_doi_tuong = 'ALL')",
      params: {}
    };
  }
  if (user.loai_tai_khoan === 'khoa') {
    return {
      clause: "(nn.loai_nguoi_nhan = 'khoa' AND nn.ma_doi_tuong = :ma_khoa)",
      params: { ma_khoa: user.ma_khoa }
    };
  }
  if (user.loai_tai_khoan === 'covan') {
    return {
      clause: "(nn.loai_nguoi_nhan = 'covan' AND nn.ma_doi_tuong = :ma_co_van)",
      params: { ma_co_van: user.ma_co_van }
    };
  }
  return {
    clause: "(nn.loai_nguoi_nhan = 'lop' AND nn.ma_doi_tuong = :ma_lop)",
    params: { ma_lop: user.ma_lop }
  };
}

// Lay danh sach thong bao theo scope cua role hien tai, sap xep thong bao moi len tren.
export async function listNotifications(user) {
  const scope = recipientClauseForUser(user);
  return query(
    `SELECT DISTINCT tb.*
     FROM THONG_BAO tb
     JOIN THONG_BAO_NGUOI_NHAN nn ON nn.ma_thong_bao = tb.ma_thong_bao
     WHERE ${scope.clause}
     ORDER BY tb.ngay_gui DESC, tb.ma_thong_bao DESC`,
    scope.params
  );
}

// Tao thong bao va danh sach nguoi nhan, tu dong loai trung role/doi tuong trong cung mot lan gui.
export async function insertNotification(connection, ma_nhan_vien, { tieu_de, noi_dung, recipients }) {
  const ma_thong_bao = makeId('TB');
  await connection.execute(
    'INSERT INTO THONG_BAO (ma_thong_bao, ma_nhan_vien, tieu_de, noi_dung, ngay_gui) VALUES (?, ?, ?, ?, CURDATE())',
    [ma_thong_bao, ma_nhan_vien, tieu_de, noi_dung]
  );
  const uniqueRecipients = Array.from(
    new Map(recipients.map((recipient) => [`${recipient.loai_nguoi_nhan}:${recipient.ma_doi_tuong}`, recipient])).values()
  );
  for (const recipient of uniqueRecipients) {
    await connection.execute(
      `INSERT INTO THONG_BAO_NGUOI_NHAN
       (nguoi_nhan_id, ma_thong_bao, loai_nguoi_nhan, ma_doi_tuong)
       VALUES (?, ?, ?, ?)`,
      [makeId('NN'), ma_thong_bao, recipient.loai_nguoi_nhan, recipient.ma_doi_tuong]
    );
  }
  return ma_thong_bao;
}

// Tao thong bao he thong, mac dinh day viec ve CTSV dau tien.
export async function createSystemNotification(connection, payload) {
  const [senders] = await connection.execute('SELECT ma_nhan_vien FROM NHAN_VIEN_CTSV ORDER BY ma_nhan_vien LIMIT 1');
  const senderId = senders[0]?.ma_nhan_vien;
  if (!senderId) return null;
  return insertNotification(connection, senderId, payload);
}

// CTSV tao thong bao thu cong cho cac nhom nhan; thong bao tu dong cua luong nghiep vu tao o service rieng.
export async function createNotification(user, payload) {
  if (user.loai_tai_khoan !== 'ctsv') throw badRequest('Chỉ Phòng Công tác Sinh viên được gửi thông báo thủ công');
  if (!payload.tieu_de || !payload.noi_dung || !Array.isArray(payload.recipients)) {
    throw badRequest('Thiếu tiêu đề, nội dung hoặc danh sách người nhận');
  }
  return transaction(async (connection) => {
    const ma_thong_bao = await insertNotification(connection, user.ma_nhan_vien, payload);
    return { message: 'Gửi thông báo thành công', ma_thong_bao };
  });
}
