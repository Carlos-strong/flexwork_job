"use client";

/**
 * NotificationBell — Cloche de notification temps réel (WebSocket).
 *
 * Affiche le nombre de notifications non lues et un dropdown
 * avec les notifications récentes.
 */

import { useState, useRef, useEffect } from "react";
import type { Notification } from "@/hooks/use-socket";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer en cliquant hors du dropdown
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open && unreadCount > 0) onMarkAllRead();
  };

  const typeIcon = (type: string) => {
    const icons: Record<string, string> = {
      message: "💬",
      new_message: "💬",
      contract: "📝",
      milestone: "🏁",
      payment: "💰",
      kyc: "🪪",
      call: "📞",
      missed_call: "📵",
      application: "👀",
      system: "🔔",
    };
    return icons[type] ?? "🔔";
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-[#F5F5F0] transition-colors"
        title="Notifications"
      >
        <span className="text-[20px]">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#2D5BE3] text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-[16px] border border-[#E2E0D9] bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E0D9]">
            <p className="text-[14px] font-semibold text-[#1A1916]">Notifications</p>
            {notifications.length > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[12px] text-[#2D5BE3] hover:underline"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[24px] mb-1">🔕</p>
                <p className="text-[13px] text-[#5A5750]">Aucune notification</p>
              </div>
            ) : (
              notifications.map((n) => (
                <a
                  key={n.id}
                  href={n.link || "#"}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-[#F5F5F0] transition-colors border-b border-[#E2E0D9] last:border-b-0"
                >
                  <span className="text-[20px] mt-0.5 shrink-0">{typeIcon(n.type)}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1A1916] line-clamp-1">
                      {n.title}
                    </p>
                    <p className="text-[12px] text-[#5A5750] line-clamp-2 mt-0.5">
                      {n.body}
                    </p>
                    <p className="text-[11px] text-[#9C9A95] mt-1">
                      {new Date(n.createdAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
