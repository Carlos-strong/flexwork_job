/**
 * Singleton Socket.io client — côté navigateur uniquement.
 *
 * Utilisation :
 *   import { getSocket } from "@/lib/socket-client";
 *   const socket = getSocket();
 *   socket.emit("join_room", contractId);
 */

import type { Socket } from "socket.io-client";

declare global {
  // eslint-disable-next-line no-var
  var __flexSocket: Socket | undefined;
}

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket() is browser-only");
  }

  // Survit au hot-reload Next.js en dev
  if (globalThis.__flexSocket) {
    _socket = globalThis.__flexSocket;
    return _socket;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { io } = require("socket.io-client") as typeof import("socket.io-client");

  _socket = io(
    process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001",
    {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    }
  );

  if (process.env.NODE_ENV === "development") {
    globalThis.__flexSocket = _socket;
  }

  return _socket;
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
  if (typeof window !== "undefined") {
    globalThis.__flexSocket = undefined;
  }
}
