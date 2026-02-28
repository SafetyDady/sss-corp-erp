import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import api, { registerAuthStore } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,
      // Phase 5: employee data
      employeeId: null,
      employeeName: null,
      employeeCode: null,
      departmentId: null,
      departmentName: null,
      hireDate: null,

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
            // Phase 5: employee data from /me
            employeeId: data.employee_id || null,
            employeeName: data.employee_name || null,
            employeeCode: data.employee_code || null,
            departmentId: data.department_id || null,
            departmentName: data.department_name || null,
            hireDate: data.hire_date || null,
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
          employeeId: null,
          employeeName: null,
          employeeCode: null,
          departmentId: null,
          departmentName: null,
          hireDate: null,
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
    }),
    {
      name: 'sss-auth',
      onRehydrateStorage: () => {
        return () => {
          useAuthStore.setState({ _hasHydrated: true });
        };
      },
      storage: {
        getItem: (name) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
      // Only persist tokens + auth state — not loading flags
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
        employeeId: state.employeeId,
        employeeName: state.employeeName,
        employeeCode: state.employeeCode,
        departmentId: state.departmentId,
        departmentName: state.departmentName,
        hireDate: state.hireDate,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        _hasHydrated: true,
      }),
    }
  )
);

// Register store with api.js to break circular dependency
registerAuthStore(useAuthStore);

export default useAuthStore;
