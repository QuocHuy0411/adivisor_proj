import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

api.interceptors.request.use(
  (config) => {
    if (config.url && (config.url.startsWith('/auth') || config.url.startsWith('auth')
        || config.url.startsWith('/chat') || config.url.startsWith('chat'))) {
      config.baseURL = import.meta.env.VITE_SPRING_BOOT_API_URL || 'http://localhost:8080/api';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

// Xu ly cac request bi 401 trong luc dang refresh token de tat ca cung chay lai sau khi refresh xong.
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Không refresh nếu chính API refresh hoặc login bị lỗi
    if (originalRequest.url === '/auth/refresh-token' || originalRequest.url === '/auth/login') {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh-token');
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        // Thông báo cho hệ thống biết phiên đăng nhập đã thực sự hết hạn
        window.dispatchEvent(new Event('auth:unauthorized'));
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);
