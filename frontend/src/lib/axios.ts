import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // A 401 from the login or refresh endpoints themselves means "wrong credentials" or "no valid
    // session" — not "token expired mid-session". Retrying a refresh in that case just masks the
    // real error behind a silent full-page reload (window.location.href below), so the login form
    // never gets to show "Invalid credentials" — it just resets with no feedback.
    const isAuthEndpoint = typeof original?.url === 'string'
      && (original.url.includes('/auth/login') || original.url.includes('/auth/refresh'));
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        useAuthStore.getState().setAccessToken(data.accessToken);
        refreshQueue.forEach((cb) => cb(data.accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
