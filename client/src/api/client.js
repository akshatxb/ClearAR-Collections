import axios from 'axios';

// Vite dev server proxies /api and /auth to the Spring Boot backend (see vite.config.js).
// Override with VITE_API_BASE_URL if the API is hosted elsewhere.
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clearar_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('clearar_token');
      localStorage.removeItem('clearar_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err, fallback = 'Something went wrong.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const data = err.response?.data;
  if (!data) return err.message || fallback;
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const first = data.errors[0];
    return typeof first === 'string' ? first : first.defaultMessage || first.message || fallback;
  }
  return err.message || fallback;
}
