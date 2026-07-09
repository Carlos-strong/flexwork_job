"use client";

/**
 * Hook useSocket — gère la connexion Socket.io et s'abonne
 * aux notifications personnelles de l'utilisateur connecté.
 *
 * Utilise le singleton partagé depuis lib/socket-client.ts pour
 * éviter les connexions multiples.
 *
 * Usage :
 *   const { socket, connected, notifications, unreadCount, markAllRead } = useSocket(userId);
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-client";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}

export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let socket: Socket;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      // Signaler la présence et s'abonner aux notifications à chaque reconnexion
      if (userId) {
        socket.emit("user_online", userId);
        socket.emit("subscribe_notifications", userId);
      }
    };

    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setConnected(true);
      if (userId) {
        socket.emit("user_online", userId);
        socket.emit("subscribe_notifications", userId);
      }
    }

    // ── Notifications push ─────────────────────────────
    const onNotification = (data: Omit<Notification, "id" | "createdAt">) => {
      const notification: Notification = {
        id: `notif-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...data,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((n) => n + 1);
    };

    socket.on("notification", onNotification);

    // ── Session dupliquée (autre onglet/navigateur) ────
    const onSessionDuplicate = () => {
      console.warn("[WS] Session dupliquée — déconnexion");
      socket.disconnect();
    };

    socket.on("session_duplicate", onSessionDuplicate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("notification", onNotification);
      socket.off("session_duplicate", onSessionDuplicate);
    };
  }, [userId]);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  const addNotification = useCallback((n: Notification) => {
    setNotifications((prev) => [n, ...prev].slice(0, 50));
    setUnreadCount((c) => c + 1);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    notifications,
    unreadCount,
    markAllRead,
    addNotification,
  };
}
