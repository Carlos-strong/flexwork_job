/**
 * Store notifications — état des notifications in-app.
 *
 * Architecture plan5.md :
 *   Notifications → Zustand + TanStack Query
 *
 * Utilisé conjointement avec hooks/use-socket.ts pour les
 * notifications temps réel (Socket.io) et lib/notifications.ts
 * pour les notifications email.
 */
import { create } from "zustand";

export interface AppNotification {
  id: string;
  type: "message" | "contract" | "milestone" | "payment" | "kyc" | "call" | "application" | "system";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationState {
  /** Liste des notifications (limitée à 50) */
  notifications: AppNotification[];
  /** Nombre de notifications non lues */
  unreadCount: number;

  // Actions
  addNotification: (n: AppNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clear: () => void;
  setNotifications: (notifications: AppNotification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) =>
    set((state) => {
      const updated = [n, ...state.notifications].slice(0, 50);
      return {
        notifications: updated,
        unreadCount: state.unreadCount + (n.read ? 0 : 1),
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),

  clear: () =>
    set({ notifications: [], unreadCount: 0 }),
}));
