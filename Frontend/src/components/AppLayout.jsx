import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const roleLabel = {
  admin: 'Quản trị viên',
  ctsv: 'Phòng CTSV',
  khoa: 'Trưởng Khoa',
  covan: 'Cố vấn học tập',
  sinhvien: 'Sinh viên'
};

const roleNavItems = {
  khoa: [
    { key: 'notifications', label: 'Thông báo', to: '/notifications' },
    { key: 'assignment', label: 'Phân công', to: '/?view=assignment' },
    { key: 'employees', label: 'Danh sách nhân viên', to: '/?view=employees' },
    { key: 'history', label: 'Lịch sử phân công', to: '/?view=history' }
  ],
  ctsv: [
    { key: 'create', label: 'Tạo lớp và sinh viên', to: '/?view=create' },
    { key: 'students', label: 'Danh sách sinh viên', to: '/?view=students' },
    { key: 'assignments', label: 'Danh sách phân công cố vấn', to: '/?view=assignments' },
    { key: 'history', label: 'Lịch sử phân công', to: '/?view=history' }
  ]
};

export default function AppLayout({ title, children, navItems = [], activeNav, onNavChange }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.loai_tai_khoan === 'admin';
  const currentNavItems = navItems.length ? navItems : (roleNavItems[user?.loai_tai_khoan] || []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function goChangePassword() {
    setMenuOpen(false);
    navigate('/change-password');
  }

  function isNavActive(item) {
    if (activeNav) return activeNav === item.key;
    const params = new URLSearchParams(location.search);
    if (item.key === 'notifications') return location.pathname === '/notifications';
    if (user?.loai_tai_khoan === 'ctsv') return location.pathname === '/' && (params.get('view') || 'create') === item.key;
    if (item.key === 'history') return location.pathname === '/' && params.get('view') === 'history';
    if (item.key === 'employees') return location.pathname === '/' && params.get('view') === 'employees';
    if (item.key === 'assignment') return location.pathname === '/' && !['employees', 'history'].includes(params.get('view'));
    return false;
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

        {isAdmin ? (
          <nav className="admin-nav" aria-label="Quản trị viên">
            {navItems.map((item) => (
              <button
                className={activeNav === item.key ? 'admin-nav-item active' : 'admin-nav-item'}
                key={item.key}
                type="button"
                onClick={() => onNavChange?.(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : (
          <>
            <Link className="brand" to="/">Adivisor</Link>
            <nav className={currentNavItems.length ? 'sidebar-action-nav' : undefined}>
              {currentNavItems.length ? currentNavItems.map((item) => (
                item.to ? (
                  <Link className={isNavActive(item) ? 'sidebar-nav-item active' : 'sidebar-nav-item'} key={item.key} to={item.to}>
                    {item.label}
                  </Link>
                ) : (
                  <button
                    className={isNavActive(item) ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
                    key={item.key}
                    type="button"
                    onClick={() => onNavChange?.(item.key)}
                  >
                    {item.label}
                  </button>
                )
              )) : (
                <>
                  <Link to="/">Tổng quan</Link>
                  <Link to="/notifications">Thông báo</Link>
                </>
              )}
            </nav>
          </>
        )}
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
