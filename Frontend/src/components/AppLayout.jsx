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
    { key: 'notifications', label: 'Thông báo', to: '/notifications' },
    { key: 'create', label: 'Tạo lớp và sinh viên', to: '/?view=create' },
    { key: 'students', label: 'Danh sách sinh viên', to: '/?view=students' },
    { key: 'assignments', label: 'Danh sách phân công cố vấn', to: '/?view=assignments' },
    { key: 'history', label: 'Lịch sử phân công', to: '/?view=history' }
  ],
  covan: [
    { key: 'overview', label: 'Lớp phụ trách', to: '/' },
    { key: 'notifications', label: 'Thông báo', to: '/notifications' }
  ],
  sinhvien: [
    { key: 'overview', label: 'Thông tin CVHT', to: '/' },
    { key: 'notifications', label: 'Thông báo', to: '/notifications' }
  ]
};

const REVIEWABLE_REPLACEMENT_STATUSES = ['Khoa đã duyệt', 'Giám đốc đang duyệt'];

export default function AppLayout({ title, children, navItems = [], activeNav, onNavChange }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    const notificationReadKey = `read_notification_ids:${user.ma_tai_khoan}`;

    try {
      if (user.loai_tai_khoan === 'khoa') {
        const [{ data: assignments }, { data: replacementRequests }] = await Promise.all([
          api.get('/khoa/assignments'),
          api.get('/khoa/replacement-requests')
        ]);
        
        // 1. Khoa Assignment/replacement requests
        const waitingAssignments = assignments.filter((a) => a.trang_thai === 'Chờ phân công');
        const waitingAssignmentIds = waitingAssignments.map((a) => a.ma_phan_cong);
        const waitingReplacementIds = replacementRequests
          .filter((request) => ['Chờ duyệt', 'Khoa đang duyệt'].includes(request.trang_thai))
          .map((request) => request.ma_yeu_cau);
        let seenKhoa = [];
        let seenKhoaReplacements = [];
        try {
          seenKhoa = JSON.parse(localStorage.getItem('seen_khoa_assignments') || '[]');
        } catch {}
        try {
          seenKhoaReplacements = JSON.parse(localStorage.getItem('seen_khoa_replacements') || '[]');
        } catch {}
        
        if (isOnKhoaAssignment) {
          seenKhoa = Array.from(new Set([...seenKhoa, ...waitingAssignmentIds]));
          seenKhoaReplacements = Array.from(new Set([...seenKhoaReplacements, ...waitingReplacementIds]));
          localStorage.setItem('seen_khoa_assignments', JSON.stringify(seenKhoa));
          localStorage.setItem('seen_khoa_replacements', JSON.stringify(seenKhoaReplacements));
          setUnreadKhoaAssignments(false);
        } else {
          const hasUnreadAssignment = waitingAssignmentIds.some((id) => !seenKhoa.includes(id));
          const hasUnreadReplacement = waitingReplacementIds.some((id) => !seenKhoaReplacements.includes(id));
          setUnreadKhoaAssignments(hasUnreadAssignment || hasUnreadReplacement);
        }

        // 2. Khoa Notifications
        const { data: notifications } = await api.get('/notifications');
        const notifIds = notifications.map((n) => n.ma_thong_bao);
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem(notificationReadKey) || '[]');
        } catch {}

        if (isOnNotifications) {
          readNotifications = Array.from(new Set([...readNotifications, ...notifIds]));
          localStorage.setItem(notificationReadKey, JSON.stringify(readNotifications));
          setUnreadNotifications(false);
        } else {
          const hasUnread = notifIds.some((id) => !readNotifications.includes(id));
          setUnreadNotifications(hasUnread);
        }

      } else if (user.loai_tai_khoan === 'ctsv') {
        // 1. CTSV Assignment/replacement requests
        const [{ data: assignments }, { data: replacementRequests }] = await Promise.all([
          api.get('/ctsv/assignments'),
          api.get('/ctsv/replacement-requests')
        ]);
        const directorWaiting = assignments.filter((a) => a.trang_thai === 'Chờ giám đốc duyệt');
        const waitingAssignmentIds = directorWaiting.map((a) => a.ma_phan_cong);
        const waitingReplacementIds = replacementRequests
          .filter((request) => REVIEWABLE_REPLACEMENT_STATUSES.includes(request.trang_thai))
          .map((request) => request.ma_yeu_cau);
        let seenCtsv = [];
        let seenCtsvReplacements = [];
        try {
          seenCtsv = JSON.parse(localStorage.getItem('seen_ctsv_assignments') || '[]');
        } catch {}
        try {
          seenCtsvReplacements = JSON.parse(localStorage.getItem('seen_ctsv_replacements') || '[]');
        } catch {}

        if (isOnCtsvAssignments) {
          seenCtsv = Array.from(new Set([...seenCtsv, ...waitingAssignmentIds]));
          seenCtsvReplacements = Array.from(new Set([...seenCtsvReplacements, ...waitingReplacementIds]));
          localStorage.setItem('seen_ctsv_assignments', JSON.stringify(seenCtsv));
          localStorage.setItem('seen_ctsv_replacements', JSON.stringify(seenCtsvReplacements));
          setUnreadCtsvAssignments(false);
        } else {
          const hasUnreadAssignment = waitingAssignmentIds.some((id) => !seenCtsv.includes(id));
          const hasUnreadReplacement = waitingReplacementIds.some((id) => !seenCtsvReplacements.includes(id));
          setUnreadCtsvAssignments(hasUnreadAssignment || hasUnreadReplacement);
        }

        // 2. CTSV Notifications
        const { data: notifications } = await api.get('/notifications');
        const notifIds = notifications.map((n) => n.ma_thong_bao);
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem(notificationReadKey) || '[]');
        } catch {}

        if (isOnNotifications) {
          readNotifications = Array.from(new Set([...readNotifications, ...notifIds]));
          localStorage.setItem(notificationReadKey, JSON.stringify(readNotifications));
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
          readNotifications = JSON.parse(localStorage.getItem(notificationReadKey) || '[]');
        } catch {}

        if (isOnNotifications) {
          readNotifications = Array.from(new Set([...readNotifications, ...notifIds]));
          localStorage.setItem(notificationReadKey, JSON.stringify(readNotifications));
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
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header-wrapper">
          <Link className="brand" to="/" onClick={() => setMobileMenuOpen(false)}>Phân công CVHT</Link>
          <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <nav className="sidebar-action-nav">
          {currentNavItems.map((item) => (
            item.to ? (
              <Link 
                className={isNavActive(item) ? 'sidebar-nav-item active' : 'sidebar-nav-item'} 
                key={item.key} 
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
              >
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
                onClick={() => {
                  onNavChange?.(item.key);
                  setMobileMenuOpen(false);
                }}
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
          <div className="header-title-row">
            <button 
              className="mobile-menu-btn" 
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
