import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ten_tai_khoan: '', mat_khau: '' });
  const [error, setError] = useState('');

  if (user?.da_doi_mk) return <Navigate to="/" replace />;
  if (user && !user.da_doi_mk) return <Navigate to="/change-password" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const nextUser = await login(form);
      navigate(nextUser.da_doi_mk ? '/' : '/change-password');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Adivisor</h1>
        <p>Hệ thống phân công Cố vấn học tập</p>
        <form onSubmit={submit}>
          <label>
            Tên tài khoản
            <input value={form.ten_tai_khoan} onChange={(e) => setForm({ ...form, ten_tai_khoan: e.target.value })} />
          </label>
          <label>
            Mật khẩu
            <input type="password" value={form.mat_khau} onChange={(e) => setForm({ ...form, mat_khau: e.target.value })} />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button type="submit">Đăng nhập</button>
        </form>
      </section>
    </main>
  );
}
