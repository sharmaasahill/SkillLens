import axios from 'axios';
import { API_URL } from './config';

// Login tokens live in httpOnly cookies that JavaScript cannot read.
// Write requests must also send a CSRF token, which the backend returns in
// JSON on login/refresh; it is not a credential on its own.
const CSRF_ACCESS = 'csrf_access_token';
const CSRF_REFRESH = 'csrf_refresh_token';
const NO_REFRESH_PATHS = ['/auth/login', '/auth/2fa', '/auth/register', '/auth/refresh', '/auth/logout'];

export const csrf = {
  save(data = {}) {
    if (data.csrf_access_token) localStorage.setItem(CSRF_ACCESS, data.csrf_access_token);
    if (data.csrf_refresh_token) localStorage.setItem(CSRF_REFRESH, data.csrf_refresh_token);
  },
  clear() {
    localStorage.removeItem(CSRF_ACCESS);
    localStorage.removeItem(CSRF_REFRESH);
  },
};

let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

const api = axios.create({ baseURL: API_URL, withCredentials: true });

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const key = config.url && config.url.startsWith('/auth/refresh') ? CSRF_REFRESH : CSRF_ACCESS;
    const token = localStorage.getItem(key);
    if (token) config.headers['X-CSRF-TOKEN'] = token;
  }
  return config;
});

// When the short-lived access token expires, refresh it once and retry the request.
let refreshInFlight = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original && NO_REFRESH_PATHS.some((path) => (original.url || '').startsWith(path));

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        refreshInFlight = refreshInFlight || api.post('/auth/refresh').finally(() => {
          refreshInFlight = null;
        });
        const { data } = await refreshInFlight;
        csrf.save(data);
        return api(original);
      } catch (refreshError) {
        csrf.clear();
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from an API error response. */
export function errorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data;
  if (data?.details?.length) {
    return data.details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).join('; ');
  }
  return data?.error || data?.message || fallback;
}

export default api;
