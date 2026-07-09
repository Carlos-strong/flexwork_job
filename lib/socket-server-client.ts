/**
 * Client Socket.io côté serveur (workers, routes API) — permet de pousser
 * des notifications temps réel vers le serveur WS (server/ws-server.ts),
 * qui les relaie à la room `user:{userId}` de l'utilisateur concerné.
 *
 * Le serveur WS écoute l'événement "push_notification" et le rediffuse
 * sous forme d'événement "notification" au client abonné (cf. server/ws-server.ts).
 */

import { io, type Socket } from "socket.io-client";

let _serverSocket: Socket | null = null;

function getServerSocket(): Socket {
  if (!_serverSocket) {
    _serverSocket = io(process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
  }
  return _serverSocket;
}

/** Pousse une notification temps réel à un utilisateur (cloche de notification). */
export function pushNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    if (!params.userId) return;
    getServerSocket().emit("push_notification", params);
  } catch {
    // Non bloquant — l'email reste le canal de notification garanti
  }
}
