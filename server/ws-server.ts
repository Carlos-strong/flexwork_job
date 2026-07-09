/**
 * Serveur WebSocket Flexwork — Socket.io
 *
 * Gère en temps réel :
 *   - Messagerie instantanée (rooms par contractId)
 *   - Notifications push (rooms par userId)
 *   - Présence utilisateur (online / offline / typing)
 *   - Accusés de réception et lecture des messages
 *   - Signalisation WebRTC (offer/answer/ICE pour appels audio/vidéo/screen)
 *
 * Démarrage : npx tsx server/ws-server.ts
 * Port      : WS_PORT (défaut 3001)
 */

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = parseInt(process.env.WS_PORT || "3001");
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: [ORIGIN, "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST"],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// ── Registres en mémoire ───────────────────────────────────
/** roomId → ensemble des socket.id présents dans la room */
const roomMembers = new Map<string, Set<string>>();

/** userId → socket.id (présence utilisateur) */
const userSockets = new Map<string, string>();

/** socket.id → userId (reverse lookup) */
const socketUsers = new Map<string, string>();

/** Ensemble des userId actuellement en ligne */
const onlineUsers = new Set<string>();

// ── Helpers ────────────────────────────────────────────────
function joinRoom(socketId: string, roomId: string) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
  roomMembers.get(roomId)!.add(socketId);
}

function leaveAllRooms(socketId: string) {
  roomMembers.forEach((members, roomId) => {
    members.delete(socketId);
    if (members.size === 0) roomMembers.delete(roomId);
  });
}

/** Récupère les userId des autres membres d'une room */
function getOtherUsersInRoom(roomId: string, excludeSocketId: string): string[] {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  const others: string[] = [];
  members.forEach((sid) => {
    if (sid !== excludeSocketId) {
      const uid = socketUsers.get(sid);
      if (uid) others.push(uid);
    }
  });
  return Array.from(new Set(others));
}

/** Récupère les userId de tous les membres d'une room */
function getAllUsersInRoom(roomId: string): string[] {
  const members = roomMembers.get(roomId);
  if (!members) return [];
  const users: string[] = [];
  members.forEach((sid) => {
    const uid = socketUsers.get(sid);
    if (uid) users.push(uid);
  });
  return Array.from(new Set(users));
}

// ── Connexions ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[WS] ✅ Connected   ${socket.id}`);

  // ═══════════════════════════════════════════════════════
  //  PRÉSENCE UTILISATEUR
  // ═══════════════════════════════════════════════════════

  /** Un utilisateur se connecte et s'identifie */
  socket.on("user_online", (userId: string) => {
    const prevSocketId = userSockets.get(userId);
    // Déconnecter l'ancienne session si elle existe (onglet multiple)
    if (prevSocketId && prevSocketId !== socket.id) {
      const prevSocket = io.sockets.sockets.get(prevSocketId);
      prevSocket?.emit("session_duplicate");
      prevSocket?.disconnect();
    }

    userSockets.set(userId, socket.id);
    socketUsers.set(socket.id, userId);
    onlineUsers.add(userId);

    // Notifier les autres membres des rooms rejointes
    roomMembers.forEach((_members, roomId) => {
      if (io.sockets.adapter.rooms.get(roomId)?.has(socket.id)) {
        socket.to(roomId).emit("user_online_status", { userId, online: true });
      }
    });

    console.log(`[WS] 👤 user_online  ${userId} (socket ${socket.id})`);
  });

  /** Récupérer la liste des utilisateurs en ligne dans une room */
  socket.on("get_room_presence", (roomId: string) => {
    const users = getAllUsersInRoom(roomId);
    socket.emit("room_presence", { roomId, onlineUserIds: users });
  });

  // ═══════════════════════════════════════════════════════
  //  SALLES DE CONTRAT
  // ═══════════════════════════════════════════════════════

  // ── Rejoindre une room de contrat ─────────────────────
  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);
    joinRoom(socket.id, roomId);

    // Notifier les autres que cet utilisateur est en ligne
    const userId = socketUsers.get(socket.id);
    if (userId) {
      socket.to(roomId).emit("user_online_status", { userId, online: true });
    }

    console.log(`[WS] ${socket.id} → join_room ${roomId}`);
  });

  // ── S'abonner aux notifications personnelles ──────────
  socket.on("subscribe_notifications", (userId: string) => {
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    // Enregistrer aussi la présence si pas déjà fait
    if (!userSockets.has(userId)) {
      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, userId);
      onlineUsers.add(userId);
    }

    console.log(`[WS] ${socket.id} → subscribe_notifications user:${userId}`);
  });

  // ═══════════════════════════════════════════════════════
  //  MESSAGERIE
  // ═══════════════════════════════════════════════════════

  // ── Envoyer un message (broadcast aux autres membres) ──
  socket.on(
    "send_message",
    (data: {
      roomId: string;
      message: {
        id: string;
        conversationId?: string;
        senderId: string;
        senderName: string;
        content: string;
        createdAt: string;
      };
    }) => {
      // Diffuser le message aux autres membres de la room
      // Inclure le roomId pour que le client sache à quel candidat il appartient
      socket.to(data.roomId).emit("new_message", { ...data.message, roomId: data.roomId });

      // Envoyer un accusé de réception à l'expéditeur
      socket.emit("message_delivered", {
        messageId: data.message.id,
        roomId: data.roomId,
        deliveredAt: new Date().toISOString(),
      });

      console.log(`[WS] 📨 message ${data.message.id} → room ${data.roomId}`);
    }
  );

  // ── Accusé de réception (le destinataire a reçu le message côté client) ──
  socket.on(
    "message_received",
    (data: { messageId: string; roomId: string }) => {
      // Transmettre à l'expéditeur que son message a été reçu (vu par le client)
      socket.to(data.roomId).emit("message_received_ack", {
        messageId: data.messageId,
        receivedAt: new Date().toISOString(),
        userId: socketUsers.get(socket.id),
      });
    }
  );

  // ── Marquage de messages comme lus ────────────────────
  socket.on(
    "messages_read",
    (data: { roomId: string; messageIds: string[]; userId: string }) => {
      socket.to(data.roomId).emit("messages_read_ack", {
        messageIds: data.messageIds,
        readAt: new Date().toISOString(),
        userId: data.userId,
      });
    }
  );

  // ── Indicateurs de frappe ─────────────────────────────
  socket.on("typing", (data: { roomId: string; userName: string }) => {
    socket.to(data.roomId).emit("user_typing", { userName: data.userName, userId: socketUsers.get(socket.id) });
  });

  socket.on("stop_typing", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("user_stop_typing", { userId: socketUsers.get(socket.id) });
  });

  // ═══════════════════════════════════════════════════════
  //  SIGNALISATION WebRTC
  // ═══════════════════════════════════════════════════════

  /** 1. Appel sortant — le caller signale sa demande à la room */
  socket.on(
    "call_request",
    (data: {
      roomId: string;
      callerId: string;
      callerName: string;
      callType: "audio" | "video";
      targetUserId?: string;
    }) => {
      const room = io.sockets.adapter.rooms.get(data.roomId);
      const hasOtherMember = room && room.size > 1;

      if (hasOtherMember) {
        // Le destinataire est connecté → propager l'appel
        socket.to(data.roomId).emit("incoming_call", {
          callerId: data.callerId,
          callerName: data.callerName,
          callType: data.callType,
          roomId: data.roomId,
        });
      } else {
        // Le destinataire est déconnecté → notifier immédiatement
        socket.emit("call_remote_offline", { roomId: data.roomId });
      }
    }
  );

  /** 2a. L'appelé accepte */
  socket.on("call_accept", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("call_accepted", { roomId: data.roomId });
  });

  /** 2b. L'appelé refuse */
  socket.on("call_reject", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("call_rejected", { roomId: data.roomId });
  });

  /** 3. Le caller envoie son SDP offer */
  socket.on("call_offer", (data: { roomId: string; offer: RTCSessionDescriptionInit }) => {
    socket.to(data.roomId).emit("call_offer", { offer: data.offer });
  });

  /** 4. L'appelé envoie son SDP answer */
  socket.on("call_answer", (data: { roomId: string; answer: RTCSessionDescriptionInit }) => {
    socket.to(data.roomId).emit("call_answer", { answer: data.answer });
  });

  /** 5. Échange de candidats ICE (trickle ICE) */
  socket.on(
    "ice_candidate",
    (data: { roomId: string; candidate: RTCIceCandidateInit }) => {
      socket.to(data.roomId).emit("ice_candidate", { candidate: data.candidate });
    }
  );

  /** 6. Raccrochage */
  socket.on("call_hangup", (data: { roomId: string; reason?: string }) => {
    socket.to(data.roomId).emit("call_ended", { reason: data.reason || "hangup" });
    console.log(`[WS] call_hangup in room ${data.roomId} (${data.reason || "manual"})`);
  });

  /** 7. Appel terminé sans réponse → notification d'appel manqué */
  socket.on(
    "call_missed",
    (data: { roomId: string; callerId: string; callerName: string; callType: string; targetUserId: string }) => {
      // Notifier le destinataire (via sa room notification)
      io.to(`user:${data.targetUserId}`).emit("notification", {
        id: `missed-call-${Date.now()}`,
        type: "missed_call",
        title: `📞 Appel ${data.callType === "video" ? "vidéo" : "audio"} manqué`,
        body: `${data.callerName} a essayé de vous joindre`,
        link: `/dashboard?chat=${data.roomId}`,
        createdAt: new Date().toISOString(),
      });
      // Notifier le caller que l'appel est bien marqué comme manqué
      socket.emit("call_missed_ack", { roomId: data.roomId });
    }
  );

  /** 8. Partage d'écran */
  socket.on("screen_share_started", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("screen_share_started");
  });

  socket.on("screen_share_stopped", (data: { roomId: string }) => {
    socket.to(data.roomId).emit("screen_share_stopped");
  });

  // ═══════════════════════════════════════════════════════
  //  NOTIFICATIONS PUSH
  // ═══════════════════════════════════════════════════════

  // ── Push Notification (depuis une API interne) ─────────
  socket.on(
    "push_notification",
    (data: { userId: string; type: string; title: string; body: string; link?: string }) => {
      io.to(`user:${data.userId}`).emit("notification", data);
    }
  );

  // ═══════════════════════════════════════════════════════
  //  DÉCONNEXION
  // ═══════════════════════════════════════════════════════

  // ── Déconnexion ───────────────────────────────────────
  socket.on("disconnect", () => {
    const userId = socketUsers.get(socket.id);

    leaveAllRooms(socket.id);

    if (userId) {
      userSockets.delete(userId);
      socketUsers.delete(socket.id);
      onlineUsers.delete(userId);

      // Notifier les rooms que l'utilisateur est hors ligne
      io.emit("user_online_status", { userId, online: false });

      console.log(`[WS] ❌ Disconnected ${socket.id} (user:${userId})`);
    } else {
      console.log(`[WS] ❌ Disconnected ${socket.id}`);
    }
  });
});

// ── Démarrage ──────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n[WS] 🚀 Socket.io server listening on port ${PORT}`);
  console.log(`[WS]    CORS origin: ${ORIGIN}\n`);
});
