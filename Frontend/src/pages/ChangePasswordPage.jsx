import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ mat_khau_cu: '', mat_khau_moi: '', nhap_lai_mat_khau_moi: '' });
  const [error, setError] = useState('');

  if (!user) return <Navigate to="/login" replace />;

  // Doi mat khau bat buoc lan dau; backend cap nhat da_doi_mk roi cho vao he thong chinh.
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await changePassword(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Không đổi được mật khẩu');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Đổi mật khẩu</h1>
        <p>Bắt buộc đổi mật khẩu lần đầu trước khi sử dụng hệ thống.</p>
        <form onSubmit={submit}>
          <label>Mật khẩu cũ<input type="password" value={form.mat_khau_cu} onChange={(e) => setForm({ ...form, mat_khau_cu: e.target.value })} /></label>
          <label>Mật khẩu mới<input type="password" value={form.mat_khau_moi} onChange={(e) => setForm({ ...form, mat_khau_moi: e.target.value })} /></label>
          <label>Nhập lại mật khẩu mới<input type="password" value={form.nhap_lai_mat_khau_moi} onChange={(e) => setForm({ ...form, nhap_lai_mat_khau_moi: e.target.value })} /></label>
          {error ? <div className="error">{error}</div> : null}
          <button type="submit">Cập nhật</button>
          <button type="button" className="secondary" onClick={logout}>Đăng xuất</button>
        </form>
      </section>
    </main>
  );
}
