import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  // Bắt đầu với loading = true để chờ xác thực token từ cookie
  const [loading, setLoading] = useState(true);

  // Dang nhap va luu user hien tai de cac route biet role, da_doi_mk va thong tin profile.
  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  }

  async function loginWithGoogle() {
    const { data } = await api.get('/auth/google/login');
    const googleUrl = data.url || data.result;
    if (!googleUrl) {
      throw new Error('Không lấy được đường dẫn đăng nhập Google');
    }
    window.location.assign(googleUrl);
  }

  // Goi /auth/me de lam moi session sau khi refresh token hoac sau khi doi mat khau.
  async function refreshMe() {
    const { data } = await api.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  }

  // Doi mat khau tu giao dien; backend se cap nhat da_doi_mk de mo khoa cac man hinh chinh.
  async function changePassword(payload) {
    await api.post('/auth/change-password', payload);
    await refreshMe();
  }

  // Dang xuat ca client va server: thu hoi refresh token, sau do xoa user local.
  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Bỏ qua lỗi nếu logout thất bại (vd do mất mạng)
    }
    localStorage.removeItem('user');
    setUser(null);
  }

  useEffect(() => {
    refreshMe()
      .catch(() => {
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setLoading(false));

    const handleUnauthorized = () => {
      localStorage.removeItem('user');
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, logout, changePassword }),
    [user, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
