import { create } from 'zustand';
import axios from 'axios';
import api, { registerAuthStore } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const useAuthStore = create((set, get) => ({
  // State
  user: null,
  accessToken: null,
  refreshToken: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: false,

  // Actions
  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // Use axios directly — login doesn't need auth interceptor
      const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
      });
      // Fetch user info
      await get().fetchMe();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      set({
        user: data,
        permissions: data.permissions || [],
      });
    } catch {
      get().logout();
    }
  },

  logout: () => {
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      api.post('/api/auth/logout', { refresh_token: refreshToken }).catch(() => {});
    }
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      isAuthenticated: false,
    });
  },

  // Permission check
  hasPermission: (permission) => {
    return get().permissions.includes(permission);
  },

  hasAnyPermission: (...perms) => {
    const current = get().permissions;
    return perms.some((p) => current.includes(p));
  },
}));

// Register store with api.js to break circular dependency
registerAuthStore(useAuthStore);

export default useAuthStore;
