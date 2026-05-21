import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import CtsvDashboard from './pages/CtsvDashboard.jsx';
import KhoaDashboard from './pages/KhoaDashboard.jsx';
import CovanDashboard from './pages/CovanDashboard.jsx';
import SinhVienDashboard from './pages/SinhVienDashboard.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.da_doi_mk) return <Navigate to="/change-password" replace />;
  const map = {
    admin: <AdminDashboard />,
    ctsv: <CtsvDashboard />,
    khoa: <KhoaDashboard />,
    covan: <CovanDashboard />,
    sinhvien: <SinhVienDashboard />
  };
  return map[user.loai_tai_khoan] || <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/" element={<Home />} />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <NotificationsPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
}
