"use client";

/**
 * ChatBox — Messagerie temps réel avec appels WebRTC.
 *
 * Transport :
 *   1. WebSocket (Socket.io)  → livraison instantanée + typing + broadcast
 *   2. Polling 8 s            → fallback si WS non disponible
 *
 * Utilise le singleton socket partagé (lib/socket-client.ts).
 * Gère les accusés de réception, le statut de lecture et la présence.
 * Appels audio/vidéo/écran via WebRTC (hook useCall).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useCall } from "@/hooks/use-call";
import { usePresence } from "@/hooks/use-presence";
import { CallModal } from "@/components/chat/call-modal";
import { getSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";

interface Message {
  id: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

/** Statut de livraison d'un message envoyé */
type DeliveryStatus = "sending" | "sent" | "delivered" | "read";

interface ChatBoxProps {
  contractId: string;
  currentUserId: string;
  currentUserName: string;
  otherPartyName?: string;
  otherPartyId?: string;
}

export function ChatBox({
  contractId,
  currentUserId,
  currentUserName,
  otherPartyName = "Interlocuteur",
  otherPartyId,
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null); // pour useCall
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, DeliveryStatus>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingSentRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, []);

  // ── Présence de l'autre participant ───────────────────
  const { isUserOnline } = usePresence(contractId);
  const otherOnline = otherPartyId ? isUserOnline(otherPartyId) : false;

  // ── Appels WebRTC ─────────────────────────────────────
  const call = useCall({
    socket,
    roomId: contractId,
    currentUserId,
    currentUserName,
  });

  // ── Historique des messages (REST) ───────────────────
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?contractId=${encodeURIComponent(contractId)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [contractId]);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setTimeout(scrollToBottom, 50);
  }, [scrollToBottom]);

  // ── WebSocket (singleton partagé) ────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    loadMessages();

    let sock: Socket;
    try {
      sock = getSocket();
      socketRef.current = sock;

      const onConnect = () => {
        setWsConnected(true);
        setSocket(sock);
        sock.emit("join_room", contractId);
        sock.emit("user_online", currentUserId);
      };

      const onDisconnect = () => {
        setWsConnected(false);
        setSocket(null);
      };

      sock.on("connect", onConnect);
      sock.on("disconnect", onDisconnect);

      if (sock.connected) {
        setWsConnected(true);
        setSocket(sock);
        sock.emit("join_room", contractId);
        sock.emit("user_online", currentUserId);
      }

      // ── Message entrant ────────────────────────────
      sock.on("new_message", (msg: Message) => {
        addMessage(msg);
        // Envoyer un accusé de réception
        sock.emit("message_received", { messageId: msg.id, roomId: contractId });
      });

      // ── Mon message a été délivré au serveur ───────
      sock.on("message_delivered", ({ messageId }: { messageId: string }) => {
        setDeliveryStatus((prev) => {
          if (prev[messageId] === "read") return prev; // déjà lu
          return { ...prev, [messageId]: "delivered" };
        });
      });

      // ── Mon message a été reçu par le client distant ──
      sock.on("message_received_ack", ({ messageId }: { messageId: string }) => {
        setDeliveryStatus((prev) => {
          if (prev[messageId] === "read") return prev;
          return { ...prev, [messageId]: "delivered" };
        });
      });

      // ── Mes messages ont été lus par le destinataire ──
      sock.on("messages_read_ack", ({ messageIds }: { messageIds: string[] }) => {
        setDeliveryStatus((prev) => {
          const next = { ...prev };
          messageIds.forEach((id) => { next[id] = "read"; });
          return next;
        });
      });

      // ── Indicateurs de frappe ──────────────────────
      sock.on("user_typing", ({ userName }: { userName: string }) => {
        setTypingUser(userName);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
      });

      sock.on("user_stop_typing", () => {
        setTypingUser(null);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      });

      return () => {
        sock.off("connect", onConnect);
        sock.off("disconnect", onDisconnect);
        sock.off("new_message");
        sock.off("message_delivered");
        sock.off("message_received_ack");
        sock.off("messages_read_ack");
        sock.off("user_typing");
        sock.off("user_stop_typing");
        // Ne PAS déconnecter le singleton — il est partagé
        socketRef.current = null;
        setSocket(null);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    } catch { /* WS non disponible */ }

    // Polling 8 s si WS absent
    const poll = setInterval(() => {
      if (!socketRef.current?.connected) loadMessages();
    }, 8000);

    return () => {
      clearInterval(poll);
      socketRef.current = null;
      setSocket(null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [contractId, loadMessages, addMessage, currentUserId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Marquer les messages comme lus ───────────────────
  useEffect(() => {
    const unreadIds = messages
      .filter((m) => m.senderId !== currentUserId)
      .map((m) => m.id);
    if (unreadIds.length > 0 && socketRef.current?.connected) {
      socketRef.current.emit("messages_read", {
        roomId: contractId,
        messageIds: unreadIds,
        userId: currentUserId,
      });
    }
  }, [messages, currentUserId, contractId]);

  // ── Typing (sortant) ─────────────────────────────────
  const handleTyping = useCallback(() => {
    if (!socketRef.current?.connected || typingSentRef.current) return;
    socketRef.current.emit("typing", { roomId: contractId, userName: currentUserName });
    typingSentRef.current = true;
    setTimeout(() => {
      typingSentRef.current = false;
      socketRef.current?.emit("stop_typing", { roomId: contractId });
    }, 2500);
  }, [contractId, currentUserName]);

  // ── Envoi d'un message ────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setSending(true);
    setNewMessage("");

    typingSentRef.current = false;
    socketRef.current?.emit("stop_typing", { roomId: contractId });

    const optimisticId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      senderId: currentUserId,
      senderName: currentUserName,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDeliveryStatus((prev) => ({ ...prev, [optimisticId]: "sending" }));
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          senderId: currentUserId,
          senderName: currentUserName,
          content,
          receiverId: otherPartyId || "",
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        const msg: Message = saved.data ?? saved;

        // Marquer comme "envoyé" dès la confirmation API
        setDeliveryStatus((prev) => ({ ...prev, [optimisticId]: "sent" }));
        if (optimisticId !== msg.id) {
          setDeliveryStatus((prev) => {
            const { [optimisticId]: _, ...rest } = prev;
            return { ...rest, [msg.id]: "sent" };
          });
        }

        // Broadcast WS aux autres participants
        try {
          const sock = getSocket();
          // S'assurer que la room est rejointe (utile après tab-switch)
          sock.emit("join_room", contractId);
          sock.emit("send_message", { roomId: contractId, message: msg });
        } catch { /* WS non disponible — le polling REST fera le relais */ }
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
      }
    } catch { /* garder l'optimiste */ }
    finally { setSending(false); }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const statusIcon = (status?: DeliveryStatus): string => {
    switch (status) {
      case "sending": return "◌";
      case "sent": return "✓";
      case "delivered": return "✓✓";
      case "read": return "✓✓";
      default: return "";
    }
  };

  const statusColor = (status?: DeliveryStatus): string => {
    switch (status) {
      case "read": return "text-[#2D5BE3]";
      case "delivered": return "text-[#1A7A4A]";
      case "sent": return "text-white/60";
      case "sending": return "text-white/40";
      default: return "text-white/60";
    }
  };

  return (
    <>
      <CallModal
        callState={call.callState}
        callType={call.callType}
        incomingCall={call.incomingCall}
        otherPartyName={otherPartyName}
        currentUserName={currentUserName}
        isMuted={call.isMuted}
        isVideoOff={call.isVideoOff}
        isSharingScreen={call.isSharingScreen}
        isCallingOffline={call.isCallingOffline}
        localVideoRef={call.localVideoRef}
        remoteVideoRef={call.remoteVideoRef}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
        onHangup={call.hangup}
        onToggleMute={call.toggleMute}
        onToggleVideo={call.toggleVideo}
        onToggleScreen={call.isSharingScreen ? call.stopScreenShare : call.startScreenShare}
      />

      <div className="rounded-[16px] border border-[#E2E0D9] flex flex-col h-[500px] bg-white shadow-sm">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#E2E0D9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[12px] font-semibold text-[#2D5BE3]">
              {otherPartyName.charAt(0)}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1A1916]">{otherPartyName}</p>
              <p className="text-[12px] flex items-center gap-1" style={{ color: otherOnline ? "#1A7A4A" : "#9C9A95" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: otherOnline ? "#1A7A4A" : "#9C9A95" }} />
                {otherOnline ? "En ligne" : wsConnected ? "Hors ligne" : "Connexion…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => call.startCall("audio")} disabled={call.callState !== "idle" || !socket}
              title="Appel audio"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E2E0D9] bg-white hover:bg-[#F5F5F0] disabled:opacity-40 transition-colors text-[16px]">
              📞
            </button>
            <button onClick={() => call.startCall("video")} disabled={call.callState !== "idle" || !socket}
              title="Appel vidéo"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E2E0D9] bg-white hover:bg-[#F5F5F0] disabled:opacity-40 transition-colors text-[16px]">
              📹
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2D5BE3] border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[14px] text-[#5A5750]">
              Aucun message. Dites bonjour !
            </div>
          ) : messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isTemp = msg.id.startsWith("tmp-");
            const status = isMe ? deliveryStatus[msg.id] : undefined;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-[16px] px-4 py-2.5 ${
                  isMe
                    ? `bg-[#2D5BE3] text-white rounded-br-md ${isTemp ? "opacity-70" : ""}`
                    : "bg-[#F5F5F0] text-[#1A1916] rounded-bl-md"
                }`}>
                  {!isMe && <p className="text-[12px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>}
                  <p className="text-[14px] whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${
                    isMe ? "text-white/60" : "text-[#5A5750]"
                  }`}>
                    {isTemp ? "Envoi…" : fmt(msg.createdAt)}
                    {isMe && status && (
                      <span className={`${statusColor(status)} text-[11px]`} title={
                        status === "read" ? "Lu" :
                        status === "delivered" ? "Délivré" :
                        status === "sent" ? "Envoyé" : "Envoi…"
                      }>
                        {statusIcon(status)}
                        {status === "read" && " ●"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {typingUser && (
            <div className="flex justify-start">
              <div className="rounded-[16px] px-4 py-2.5 bg-[#F5F5F0] rounded-bl-md">
                <p className="text-[12px] text-[#5A5750] italic">{typingUser} écrit…</p>
                <div className="flex gap-1 mt-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#9C9A95] animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-[#E2E0D9] p-3 flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
            placeholder="Votre message…"
            className="flex-1 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30 placeholder:text-[#9C9A95]"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !newMessage.trim()}
            className="rounded-[10px] bg-[#2D5BE3] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50">
            {sending ? "…" : "Envoyer"}
          </button>
        </form>
      </div>
    </>
  );
}
