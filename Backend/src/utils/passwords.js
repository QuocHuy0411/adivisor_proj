import bcrypt from 'bcryptjs';

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password), hash);
}

export function defaultPasswordForRole(role, extra = {}) {
  if (role === 'sinhvien') return extra.so_dien_thoai;
  if (role === 'ctsv') return 'ctsv';
  if (role === 'covan') return 'cvht';
  if (role === 'admin') return 'admin';
  if (role === 'khoa') {
    const map = {
      CNTT: 'cntt02',
      VT: 'vt02',
      QTKD: 'qtkd02',
      KTDT: 'ktdt02'
    };
    return map[String(extra.ma_khoa || '').toUpperCase()] || 'khoa';
  }
  return '123456';
}
