import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-status">Đang kiểm tra phiên đăng nhập...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.da_doi_mk) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.loai_tai_khoan)) return <Navigate to="/" replace />;
  return children;
}
