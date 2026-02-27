import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request interceptor: add Bearer token ---
api.interceptors.request.use((config) => {
  const store = getAuthStore();
  const token = store?.getState?.()?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: auto refresh on 401 ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Normalize FastAPI validation error detail (array of {type,loc,msg,input})
    // into a plain string so message.error() never receives a non-string value.
    const detail = error.response?.data?.detail;
    if (detail && typeof detail !== 'string') {
      if (Array.isArray(detail)) {
        error.response.data.detail = detail
          .map((d) => (typeof d === 'object' ? d.msg || JSON.stringify(d) : String(d)))
          .join('; ');
      } else if (typeof detail === 'object') {
        error.response.data.detail = detail.msg || JSON.stringify(detail);
      }
    }

    const originalRequest = error.config;

    // Skip refresh for auth endpoints
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const store = getAuthStore();
      const refreshToken = store?.getState?.()?.refreshToken;
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });

      store.getState?.()?.setTokens(data.access_token, data.refresh_token);
      processQueue(null, data.access_token);

      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      getAuthStore()?.getState?.()?.logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Store registry — authStore registers itself to break circular dependency
let _authStore = null;
export function registerAuthStore(store) {
  _authStore = store;
}
function getAuthStore() {
  return _authStore;
}

export default api;
