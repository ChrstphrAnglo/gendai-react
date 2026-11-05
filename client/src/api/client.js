import axios from 'axios';

// On Vercel the API is served from the same domain under /api; in development Vite proxies /api to the server.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const UPLOADS_URL = API_URL.replace(/\/api\/?$/, '') + '/uploads';

// Uploaded images are either a file name in server/uploads, or a full URL when stored in Vercel Blob.
export const imageUrl = (name) => {
  if (!name) return '/icon.png';
  return /^https?:\/\//.test(name) ? name : `${UPLOADS_URL}/${encodeURIComponent(name)}`;
};

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/invalid token anywhere in the app logs the user out (the login call itself is excluded).
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLogin = /\/auth\/(login|register)/.test(error.config?.url || '');
    if (error.response?.status === 401 && !isLogin && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.request && !err.response) return 'Cannot reach the server. Is the API running?';
  return fallback;
};

// Turns the API's `errors: [{field, message}]` into `{ field: message }` for inline form errors.
export const fieldErrors = (err) =>
  Object.fromEntries((err.response?.data?.errors || []).map((e) => [e.field, e.message]));

export default api;
