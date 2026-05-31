import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LOGIN_ERROR_KEY = 'adivisor_login_error';

export default function LoginPage() {
  const { user, loading, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ ten_tai_khoan: '', mat_khau: '' });
  const [error, setError] = useState(() => sessionStorage.getItem(LOGIN_ERROR_KEY) || '');
  const [googleLoading, setGoogleLoading] = useState(searchParams.get('google') === 'success');

  useEffect(() => {
    if (searchParams.get('google') === 'success' && !loading && !user) {
      const nextError = 'Đăng nhập Google thất bại hoặc email chưa có trong hệ thống';
      sessionStorage.setItem(LOGIN_ERROR_KEY, nextError);
      setError(nextError);
      setGoogleLoading(false);
    }
  }, [loading, searchParams, user]);

  if (user?.da_doi_mk) return <Navigate to="/" replace />;
  if (user && !user.da_doi_mk) return <Navigate to="/change-password" replace />;

  // Dang nhap thuong: backend kiem tra brute-force, mat khau va tra user de dieu huong theo da_doi_mk.
  async function submit(event) {
    event.preventDefault();
    try {
      const nextUser = await login(form);
      sessionStorage.removeItem(LOGIN_ERROR_KEY);
      setError('');
      navigate(nextUser.da_doi_mk ? '/' : '/change-password');
    } catch (err) {
      const nextError = err.response?.data?.message || 'Đăng nhập thất bại';
      sessionStorage.setItem(LOGIN_ERROR_KEY, nextError);
      setError(nextError);
    }
  }

  // Dang nhap Google: chuyen sang URL OAuth do backend cap, loi duoc giu trong sessionStorage de hien lai sau redirect.
  async function submitGoogle() {
    try {
      setGoogleLoading(true);
      sessionStorage.removeItem(LOGIN_ERROR_KEY);
      setError('');
      await loginWithGoogle();
    } catch (err) {
      const nextError = err.response?.data?.message || err.message || 'Đăng nhập Google thất bại';
      sessionStorage.setItem(LOGIN_ERROR_KEY, nextError);
      setError(nextError);
      setGoogleLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Phân công<br />cố vấn học tập</h1>
        <form onSubmit={submit}>
          <label>
            Tên tài khoản
            <input value={form.ten_tai_khoan} onChange={(event) => setForm({ ...form, ten_tai_khoan: event.target.value })} />
          </label>
          <label>
            Mật khẩu
            <input type="password" value={form.mat_khau} onChange={(event) => setForm({ ...form, mat_khau: event.target.value })} />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button type="submit">Đăng nhập</button>
        </form>
        <div className="auth-divider"><span>hoặc</span></div>
        <button className="google-login-button" type="button" onClick={submitGoogle} disabled={googleLoading}>
          <span className="google-mark" aria-hidden="true">G</span>
          {googleLoading ? 'Đang hoàn tất đăng nhập...' : 'Đăng nhập với Google'}
        </button>
        <Link className="auth-link" to="/forgot-password">Quên mật khẩu?</Link>
      </section>
    </main>
  );
}
