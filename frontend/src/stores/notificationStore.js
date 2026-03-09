import { create } from 'zustand';
import api from '../services/api';

const POLL_INTERVAL = 60000; // 60 seconds

const useNotificationStore = create((set, get) => ({
  // State
  unreadCount: 0,
  notifications: [],
  total: 0,
  isLoading: false,
  _pollTimer: null,

  // ── Fetch unread count (lightweight — used by polling) ──
  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get('/api/notifications/unread-count');
      set({ unreadCount: data.count });
    } catch {
      // Silently fail — polling will retry
    }
  },

  // ── Fetch notification list ──
  fetchNotifications: async (opts = {}) => {
    const { limit = 20, offset = 0, is_read } = opts;
    set({ isLoading: true });
    try {
      const params = { limit, offset };
      if (is_read !== undefined) params.is_read = is_read;
      const { data } = await api.get('/api/notifications', { params });
      set({
        notifications: offset === 0 ? data.items : [...get().notifications, ...data.items],
        total: data.total,
        unreadCount: data.unread_count,
      });
    } catch {
      // Silently fail
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Mark single as read ──
  markAsRead: async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  // ── Mark all as read ──
  markAllAsRead: async () => {
    try {
      await api.post('/api/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },

  // ── Delete notification ──
  deleteNotification: async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`);
      set((state) => {
        const removed = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          total: state.total - 1,
          unreadCount: removed && !removed.is_read
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch {
      // Silently fail
    }
  },

  // ── Polling lifecycle ──
  startPolling: () => {
    const existing = get()._pollTimer;
    if (existing) return; // Already polling

    // Initial fetch
    get().fetchUnreadCount();

    const timer = setInterval(() => {
      // Only poll when tab is visible
      if (!document.hidden) {
        get().fetchUnreadCount();
      }
    }, POLL_INTERVAL);

    set({ _pollTimer: timer });
  },

  stopPolling: () => {
    const timer = get()._pollTimer;
    if (timer) {
      clearInterval(timer);
      set({ _pollTimer: null });
    }
  },

  // ── Reset (on logout) ──
  reset: () => {
    const timer = get()._pollTimer;
    if (timer) clearInterval(timer);
    set({
      unreadCount: 0,
      notifications: [],
      total: 0,
      isLoading: false,
      _pollTimer: null,
    });
  },
}));

export default useNotificationStore;
