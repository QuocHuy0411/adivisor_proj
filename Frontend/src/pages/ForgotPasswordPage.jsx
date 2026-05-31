import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [passwordForm, setPasswordForm] = useState({ mat_khau_moi: '', nhap_lai_mat_khau_moi: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user?.da_doi_mk) return <Navigate to="/" replace />;
  if (user && !user.da_doi_mk) return <Navigate to="/change-password" replace />;

  // Buoc 1 quen mat khau: gui email len backend de sinh va gui OTP.
  async function requestOtp(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setOtpToken(data.otp_token);
      setStatus(data.message || 'Mã OTP đã được gửi về Gmail.');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi mã OTP');
    } finally {
      setSubmitting(false);
    }
  }

  // Buoc 2: xac minh OTP va nhan reset_token ngan han neu ma hop le.
  async function verifyOtp(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/verify-reset-otp', {
        otp_token: otpToken,
        otp
      });
      setResetToken(data.reset_token);
      setStatus(data.message || 'Xác nhận OTP thành công.');
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không hợp lệ');
    } finally {
      setSubmitting(false);
    }
  }

  // Buoc 3: dat mat khau moi bang reset_token, sau thanh cong quay ve man dang nhap.
  async function resetPassword(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        reset_token: resetToken,
        ...passwordForm
      });
      setStatus(data.message || 'Đặt lại mật khẩu thành công.');
      setTimeout(() => navigate('/login'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đặt lại mật khẩu');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Quên mật khẩu</h1>

        {status ? <div className="success">{status}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {step === 'email' ? (
          <form onSubmit={requestOtp}>
            <label>
              Gmail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Đang gửi mã...' : 'Lấy mã OTP'}
            </button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form onSubmit={verifyOtp}>
            <label>
              Mã OTP
              <input
                inputMode="numeric"
                maxLength="6"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
            </label>
            <div className="auth-actions">
              <button type="button" className="secondary" onClick={() => setStep('email')}>
                Quay lại
              </button>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Đang kiểm tra...' : 'Xác nhận OTP'}
              </button>
            </div>
          </form>
        ) : null}

        {step === 'reset' ? (
          <form onSubmit={resetPassword}>
            <label>
              Mật khẩu mới
              <input
                type="password"
                value={passwordForm.mat_khau_moi}
                onChange={(event) => setPasswordForm({ ...passwordForm, mat_khau_moi: event.target.value })}
              />
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                value={passwordForm.nhap_lai_mat_khau_moi}
                onChange={(event) => setPasswordForm({ ...passwordForm, nhap_lai_mat_khau_moi: event.target.value })}
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        ) : null}

        <Link className="auth-link" to="/login">Quay về đăng nhập</Link>
      </section>
    </main>
  );
}
