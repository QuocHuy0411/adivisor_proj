import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

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
  ],
  covan: [
    { key: 'overview', label: 'Lớp phụ trách', to: '/' },
    { key: 'chat', label: 'Chat sinh viên', to: '/chat' },
    { key: 'notifications', label: 'Thông báo', to: '/notifications' }
  ],
  sinhvien: [
    { key: 'overview', label: 'Thông tin CVHT', to: '/' },
    { key: 'chat', label: 'Chat CVHT', to: '/chat' },
    { key: 'notifications', label: 'Thông báo', to: '/notifications' }
  ]
};

export default function AppLayout({ title, children, navItems = [], activeNav, onNavChange }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentNavItems = navItems.length ? navItems : (roleNavItems[user?.loai_tai_khoan] || []);

  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [unreadCtsvAssignments, setUnreadCtsvAssignments] = useState(false);
  const [unreadKhoaAssignments, setUnreadKhoaAssignments] = useState(false);

  async function checkUnread() {
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const isOnNotifications = location.pathname === '/notifications';
    const isOnCtsvAssignments = location.pathname === '/' && params.get('view') === 'assignments';
    const isOnKhoaAssignment = location.pathname === '/' && (!params.get('view') || params.get('view') === 'assignment');

    try {
      if (user.loai_tai_khoan === 'khoa') {
        const { data: assignments } = await api.get('/khoa/assignments');
        
        // 1. Khoa Assignment requests ('Chờ phân công')
        const waitingAssignments = assignments.filter((a) => a.trang_thai === 'Chờ phân công');
        const waitingIds = waitingAssignments.map((a) => a.ma_phan_cong);
        let seenKhoa = [];
        try {
          seenKhoa = JSON.parse(localStorage.getItem('seen_khoa_assignments') || '[]');
        } catch {}
        
        if (isOnKhoaAssignment) {
          seenKhoa = Array.from(new Set([...seenKhoa, ...waitingIds]));
          localStorage.setItem('seen_khoa_assignments', JSON.stringify(seenKhoa));
          setUnreadKhoaAssignments(false);
        } else {
          const hasUnread = waitingIds.some((id) => !seenKhoa.includes(id));
          setUnreadKhoaAssignments(hasUnread);
        }

        // 2. Khoa Notifications ('Đã đóng' assignments)
        const closedAssignments = assignments.filter((a) => a.trang_thai === 'Đã đóng');
        const years = [...new Set(closedAssignments.map((a) => a.nam_hoc))];
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem('read_notification_ids') || '[]');
        } catch {}

        if (isOnNotifications) {
          readNotifications = Array.from(new Set([...readNotifications, ...years]));
          localStorage.setItem('read_notification_ids', JSON.stringify(readNotifications));
          setUnreadNotifications(false);
        } else {
          const hasUnread = years.some((yr) => !readNotifications.includes(yr));
          setUnreadNotifications(hasUnread);
        }

      } else if (user.loai_tai_khoan === 'ctsv') {
        // 1. CTSV Assignments ('Chờ giám đốc duyệt')
        const { data: assignments } = await api.get('/ctsv/assignments');
        const directorWaiting = assignments.filter((a) => a.trang_thai === 'Chờ giám đốc duyệt');
        const waitingIds = directorWaiting.map((a) => a.ma_phan_cong);
        let seenCtsv = [];
        try {
          seenCtsv = JSON.parse(localStorage.getItem('seen_ctsv_assignments') || '[]');
        } catch {}

        if (isOnCtsvAssignments) {
          seenCtsv = Array.from(new Set([...seenCtsv, ...waitingIds]));
          localStorage.setItem('seen_ctsv_assignments', JSON.stringify(seenCtsv));
          setUnreadCtsvAssignments(false);
        } else {
          const hasUnread = waitingIds.some((id) => !seenCtsv.includes(id));
          setUnreadCtsvAssignments(hasUnread);
        }

        // 2. CTSV Notifications
        const { data: notifications } = await api.get('/notifications');
        const notifIds = notifications.map((n) => n.ma_thong_bao);
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem('read_notification_ids') || '[]');
        } catch {}

        if (isOnNotifications) {
          readNotifications = Array.from(new Set([...readNotifications, ...notifIds]));
          localStorage.setItem('read_notification_ids', JSON.stringify(readNotifications));
          setUnreadNotifications(false);
        } else {
          const hasUnread = notifIds.some((id) => !readNotifications.includes(id));
          setUnreadNotifications(hasUnread);
        }

      } else if (['covan', 'sinhvien'].includes(user.loai_tai_khoan)) {
        // Notifications
        const { data: notifications } = await api.get('/notifications');
        const notifIds = notifications.map((n) => n.ma_thong_bao);
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem('read_notification_ids') || '[]');
        } catch {}

        if (isOnNotifications) {
          readNotifications = Array.from(new Set([...readNotifications, ...notifIds]));
          localStorage.setItem('read_notification_ids', JSON.stringify(readNotifications));
          setUnreadNotifications(false);
        } else {
          const hasUnread = notifIds.some((id) => !readNotifications.includes(id));
          setUnreadNotifications(hasUnread);
        }
      }
    } catch (err) {
      console.error('Error checking unread state:', err);
    }
  }

  useEffect(() => {
    checkUnread();

    const handleUpdate = () => checkUnread();
    window.addEventListener('local-storage-update', handleUpdate);
    
    // Check every 15 seconds for dynamic updates
    const interval = setInterval(checkUnread, 15000);

    return () => {
      window.removeEventListener('local-storage-update', handleUpdate);
      clearInterval(interval);
    };
  }, [user, location.pathname, location.search]);

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
    if (item.key === 'chat') return location.pathname === '/chat';
    if (item.key === 'overview') return location.pathname === '/';
    if (user?.loai_tai_khoan === 'ctsv') return location.pathname === '/' && (params.get('view') || 'create') === item.key;
    if (item.key === 'history') return location.pathname === '/' && params.get('view') === 'history';
    if (item.key === 'employees') return location.pathname === '/' && params.get('view') === 'employees';
    if (item.key === 'assignment') return location.pathname === '/' && !['employees', 'history'].includes(params.get('view'));
    return false;
  }

  function showRedDot(key) {
    if (key === 'notifications') return unreadNotifications;
    if (key === 'assignments') return unreadCtsvAssignments;
    if (key === 'assignment') return unreadKhoaAssignments;
    return false;
  }

  return (
    <div className="app-shell ctsv-layout">
      <style>{`
        .app-shell {
          display: block !important;
        }
        .sidebar {
          position: fixed !important;
          top: 0 !important;
          bottom: 0 !important;
          left: 0 !important;
          width: 260px !important;
          height: 100vh !important;
          overflow-y: auto !important;
          z-index: 1000 !important;
        }
        .content {
          margin-left: 260px !important;
          display: block !important;
        }
        @media (max-width: 900px) {
          .sidebar {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow-y: visible !important;
          }
          .content {
            margin-left: 0 !important;
          }
        }
        .ctsv-bottom-menu {
          margin-top: auto !important;
          position: relative !important;
          order: 9999 !important;
        }
        .ctsv-account-menu {
          top: auto !important;
          bottom: 100% !important;
          margin-bottom: 8px !important;
          margin-top: 0 !important;
          box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.12) !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          position: absolute !important;
          background: #fff !important;
          border: 1px solid #dbe3ef !important;
          border-radius: 6px !important;
          display: flex !important;
          flex-direction: column !important;
          z-index: 1010 !important;
        }
        .ctsv-layout .content {
          position: relative !important;
          background: linear-gradient(rgba(244, 247, 251, 0.94), rgba(244, 247, 251, 0.94)), url('/ptit-logo.png') no-repeat center center !important;
          background-size: 320px !important;
          background-attachment: fixed !important;
        }
        .sidebar-red-dot {
          width: 8px !important;
          height: 8px !important;
          background-color: #ef4444 !important;
          border-radius: 50% !important;
          flex-shrink: 0 !important;
        }
      `}</style>
      <aside className="sidebar">
        <Link className="brand" to="/">Phân công cố vấn học tập</Link>
        <nav className="sidebar-action-nav">
          {currentNavItems.map((item) => (
            item.to ? (
              <Link className={isNavActive(item) ? 'sidebar-nav-item active' : 'sidebar-nav-item'} key={item.key} to={item.to}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                  {item.label}
                  {showRedDot(item.key) && <span className="sidebar-red-dot" />}
                </span>
              </Link>
            ) : (
              <button
                className={isNavActive(item) ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
                key={item.key}
                type="button"
                onClick={() => onNavChange?.(item.key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                  {item.label}
                  {showRedDot(item.key) && <span className="sidebar-red-dot" />}
                </span>
              </button>
            )
          ))}
        </nav>

        <div className="user-menu ctsv-bottom-menu">
          <div
            className="user-chip"
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              background: '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '12px 16px',
              minHeight: '48px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div
              className="user-role"
              style={{
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '18px',
                whiteSpace: 'nowrap'
              }}
            >
              {roleLabel[user?.loai_tai_khoan]}
            </div>
            <div
              className="triangle-icon"
              style={{
                color: '#ffffff',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {menuOpen ? '▼' : '▲'}
            </div>
          </div>
          {menuOpen ? (
            <div className="account-menu ctsv-account-menu">
              <button type="button" onClick={goChangePassword}>Đổi mật khẩu</button>
              <button type="button" onClick={handleLogout}>Đăng xuất</button>
            </div>
          ) : null}
        </div>
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
