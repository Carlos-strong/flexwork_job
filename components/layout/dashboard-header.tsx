"use client";

/**
 * DashboardHeader — Barre du haut du dashboard.
 *
 * Composant client : gère la connexion WebSocket pour les notifications
 * et inclut le bouton de déconnexion.
 */

import { useSocket } from "@/hooks/use-socket";
import { NotificationBell } from "@/components/layout/notification-bell";
import { LogoutButton } from "@/components/layout/logout-button";

interface DashboardHeaderProps {
  userId: string;
  name: string;
}

export function DashboardHeader({ userId, name }: DashboardHeaderProps) {
  const { notifications, unreadCount, markAllRead } = useSocket(userId);

  return (
    <div className="flex items-center gap-3">
      <NotificationBell
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={markAllRead}
      />
      <span className="text-sm text-[#5A5750] hidden sm:block">{name}</span>
      <LogoutButton />
    </div>
  );
}
