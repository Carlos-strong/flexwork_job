"use client";

/**
 * Hook usePresence — suit l'état de connexion (en ligne / hors ligne)
 * des participants d'une room de contrat.
 *
 * Usage :
 *   const { onlineUsers, isUserOnline } = usePresence(contractId);
 *   // isUserOnline("user-id-123") → true/false
 */

import { useEffect, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";

interface PresenceState {
  roomId: string;
  onlineUserIds: string[];
}

export function usePresence(roomId?: string) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Demander la liste des présents et écouter les changements
  useEffect(() => {
    if (!roomId) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    // Demander la présence actuelle
    if (socket.connected) {
      socket.emit("get_room_presence", roomId);
    }

    /** Un utilisateur change de statut (connexion / déconnexion) */
    const onStatus = ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    /** Réponse initiale avec la liste des présents */
    const onPresence = (data: PresenceState) => {
      if (data.roomId === roomId) {
        setOnlineUsers(new Set(data.onlineUserIds));
      }
    };

    // Abonnement différé si pas encore connecté
    const onConnect = () => {
      socket.emit("get_room_presence", roomId);
    };

    socket.on("user_online_status", onStatus);
    socket.on("room_presence", onPresence);
    socket.on("connect", onConnect);

    return () => {
      socket.off("user_online_status", onStatus);
      socket.off("room_presence", onPresence);
      socket.off("connect", onConnect);
    };
  }, [roomId]);

  const isUserOnline = useCallback(
    (userId: string) => onlineUsers.has(userId),
    [onlineUsers]
  );

  return {
    onlineUsers,
    isUserOnline,
  };
}
