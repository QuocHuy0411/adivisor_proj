import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function refreshMe() {
    const { data } = await api.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  }

  async function changePassword(payload) {
    await api.post('/auth/change-password', payload);
    await refreshMe();
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    setLoading(true);
    refreshMe().catch(logout).finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, changePassword }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
