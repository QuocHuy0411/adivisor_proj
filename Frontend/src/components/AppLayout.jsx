import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const roleLabel = {
  admin: 'Quản trị viên',
  ctsv: 'Phòng CTSV',
  khoa: 'Trưởng Khoa',
  covan: 'Cố vấn học tập',
  sinhvien: 'Sinh viên'
};

export default function AppLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.loai_tai_khoan === 'admin';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function goChangePassword() {
    setMenuOpen(false);
    navigate('/change-password');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="user-menu">
          <div className="user-chip">
            <div className="default-avatar" aria-hidden="true">
              <span className="avatar-head" />
              <span className="avatar-body" />
            </div>
            <div className="user-role">{roleLabel[user?.loai_tai_khoan]}</div>
            <div className="bell-icon" aria-hidden="true" />
            <button className="triangle-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Mở menu tài khoản">
              ▼
            </button>
          </div>
          {menuOpen ? (
            <div className="account-menu">
              <button type="button" onClick={goChangePassword}>Đổi mật khẩu</button>
              <button type="button" onClick={handleLogout}>Đăng xuất</button>
            </div>
          ) : null}
        </div>

        {!isAdmin ? (
          <>
            <Link className="brand" to="/">Adivisor</Link>
            <nav>
              <Link to="/">Tổng quan</Link>
              <Link to="/notifications">Thông báo</Link>
            </nav>
          </>
        ) : null}
      </aside>
      <main className="content">
        <header className="content-header">
          <h1>{title}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
