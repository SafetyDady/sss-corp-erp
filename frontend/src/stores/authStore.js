import { create } from 'zustand';
import axios from 'axios';
import api, { registerAuthStore } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Security: only refreshToken is persisted to sessionStorage (cleared on tab close).
// accessToken stays in-memory only. On page refresh, the app performs a silent
// refresh via /api/auth/refresh to restore the session without forcing re-login.
const RT_KEY = 'rt'; // sessionStorage key for refresh token

const useAuthStore = create(
  (set, get) => ({
    // State
    user: null,
    accessToken: null,
    refreshToken: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: false,
    _hasHydrated: false, // Starts false — set to true after hydrate() completes
    // Phase 5: employee data
    employeeId: null,
    employeeName: null,
    employeeCode: null,
    departmentId: null,
    departmentName: null,
    hireDate: null,
    workScheduleId: null,
    workingDays: null, // OrgWorkConfig: ISO weekdays [1-7], e.g. [1,2,3,4,5,6]
    hoursPerDay: null,
    deptMenu: null, // Go-Live G6: per-dept menu visibility
    // Phase 10: Organization info for print headers
    orgName: null,
    orgAddress: null,
    orgTaxId: null,
    // Phase 13: 2FA status
    is2FAEnabled: false,
    // LINE Login
    lineLinked: false,
    loginMethod: null, // "line" | "email" | null

    // Actions
    setTokens: (accessToken, refreshToken) => {
      set({ accessToken, refreshToken, isAuthenticated: true });
      // Persist refreshToken for session survival across page refresh
      try { sessionStorage.setItem(RT_KEY, refreshToken); } catch { /* quota/private */ }
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
        try { sessionStorage.setItem(RT_KEY, data.refresh_token); } catch { /* ignore */ }
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
          workScheduleId: data.work_schedule_id || null,
          workingDays: data.working_days || null,
          hoursPerDay: data.hours_per_day || null,
          deptMenu: data.dept_menu || null,
          orgName: data.org_name || null,
          orgAddress: data.org_address || null,
          orgTaxId: data.org_tax_id || null,
          is2FAEnabled: data.is_2fa_enabled || false,
          lineLinked: data.line_linked || false,
          loginMethod: data.login_method || null,
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
      // Clear persisted refresh token
      try { sessionStorage.removeItem(RT_KEY); } catch { /* ignore */ }
      // Phase 9: reset notification store on logout
      try {
        import('../stores/notificationStore').then(({ default: store }) => {
          store.getState().reset();
        }).catch(() => {});
      } catch { /* ignore if not loaded */ }
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
        workScheduleId: null,
        workingDays: null,
        hoursPerDay: null,
        deptMenu: null,
        orgName: null,
        orgAddress: null,
        orgTaxId: null,
        is2FAEnabled: false,
        lineLinked: false,
        loginMethod: null,
      });
    },

    // Hydrate on startup — attempt silent refresh from persisted refreshToken
    hydrate: async () => {
      try {
        const storedRT = sessionStorage.getItem(RT_KEY);
        if (!storedRT) return; // No stored token — stay unauthenticated

        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refresh_token: storedRT,
        });

        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        });
        try { sessionStorage.setItem(RT_KEY, data.refresh_token); } catch { /* ignore */ }

        // Fetch full user info
        await get().fetchMe();
      } catch {
        // Refresh failed (expired/revoked) — clear stale token, stay unauthenticated
        try { sessionStorage.removeItem(RT_KEY); } catch { /* ignore */ }
      } finally {
        set({ _hasHydrated: true });
      }
    },

    // Permission check
    hasPermission: (permission) => {
      return get().permissions.includes(permission);
    },

    hasAnyPermission: (...perms) => {
      const current = get().permissions;
      return perms.some((p) => current.includes(p));
    },
  })
);

// Register store with api.js to break circular dependency
registerAuthStore(useAuthStore);

// Trigger silent refresh on app startup (runs once when module is first imported)
useAuthStore.getState().hydrate();

export default useAuthStore;
