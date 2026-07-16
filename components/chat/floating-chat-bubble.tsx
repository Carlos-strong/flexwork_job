"use client";

/**
 * FloatingChatBubble — Bulle de chat flottante accessible depuis toutes les pages.
 *
 * Affiche un bouton circulaire en bas à droite avec le nombre de messages
 * non lus. Au clic, ouvre un panneau coulissant avec la liste des
 * conversations récentes et un mini-chat intégré.
 *
 * Transport : WebSocket (singleton) + REST (fallback 15 s).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";

// ── Types ──────────────────────────────────────────────

interface Conversation {
  id: string;
  title: string;
  contractId: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  otherPartyName?: string;
  otherPartyId?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  createdAt: string;
}

type DeliveryStatus = "sending" | "sent" | "delivered" | "read";

// ── Utilitaires ────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Composant ──────────────────────────────────────────

export function FloatingChatBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, DeliveryStatus>>({});

  const socketRef = useRef<Socket | null>(null);
  const typingSentRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    [conversations]
  );

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
    }, 50);
  }, []);

  // ── Auth ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) setCurrentUser(d.user); })
      .catch(() => {});
  }, []);

  // ── Conversations (polling 15 s) ──────────────────────
  const loadConversations = useCallback(() => {
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        const list: Conversation[] = Array.isArray(d) ? d : (d.data ?? []);
        setConversations(list);

        const sock = socketRef.current;
        if (sock?.connected && list.length > 0) {
          list.forEach((c) => { if (c.contractId) sock.emit("join_room", c.contractId); });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Messages d'une conversation ──────────────────────
  const loadMessages = useCallback(async (conv: Conversation) => {
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.messages ?? []));
      }
    } catch { /* silencieux */ }
  }, []);

  // ── WebSocket ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    loadConversations();

    let sock: Socket;
    try {
      sock = getSocket();
      socketRef.current = sock;

      const onConnect = () => {
        if (currentUser?.id) sock.emit("user_online", currentUser.id);
        conversations.forEach((c) => { if (c.contractId) sock.emit("join_room", c.contractId); });
      };

      sock.on("connect", onConnect);
      if (sock.connected) onConnect();

      // Nouveau message entrant
      sock.on("new_message", (msg: Message) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId
              ? {
                  ...c,
                  lastMessage: msg.content,
                  lastMessageAt: msg.createdAt,
                  unreadCount: selectedRef.current?.id === c.id ? 0 : (c.unreadCount ?? 0) + 1,
                }
              : c
          )
        );
        if (selectedRef.current?.id === msg.conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          scrollToBottom();
          sock.emit("message_received", { messageId: msg.id, roomId: selectedRef.current?.contractId });
        }
      });

      // Accusés
      sock.on("message_delivered", ({ messageId }: { messageId: string }) => {
        setDeliveryStatus((prev) => {
          if (prev[messageId] === "read") return prev;
          return { ...prev, [messageId]: "delivered" };
        });
      });

      sock.on("messages_read_ack", ({ messageIds }: { messageIds: string[] }) => {
        setDeliveryStatus((prev) => {
          const next = { ...prev };
          messageIds.forEach((id) => { next[id] = "read"; });
          return next;
        });
      });

      // Typing
      sock.on("user_typing", ({ userName }: { userName: string }) => {
        setTypingUser(userName);
        setTimeout(() => setTypingUser(null), 3000);
      });

      sock.on("user_stop_typing", () => setTypingUser(null));

      return () => {
        sock.off("connect", onConnect);
        sock.off("new_message");
        sock.off("message_delivered");
        sock.off("messages_read_ack");
        sock.off("user_typing");
        sock.off("user_stop_typing");
      };
    } catch {
      // WS non disponible → polling uniquement
      const poll = setInterval(loadConversations, 15000);
      return () => clearInterval(poll);
    }
  }, [loadConversations, currentUser?.id, conversations.length, scrollToBottom]);

  // ── Sélection d'une conversation ─────────────────────
  const selectConversation = useCallback(
    (conv: Conversation) => {
      setSelected(conv);
      setMessages([]);
      setTypingUser(null);
      loadMessages(conv);
      // Marquer comme lu
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
    },
    [loadMessages]
  );

  // ── Envoi d'un message ────────────────────────────────
  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!draft.trim() || sending || !selected || !currentUser) return;

      const content = draft.trim();
      setSending(true);
      setDraft("");

      typingSentRef.current = false;
      socketRef.current?.emit("stop_typing", { roomId: selected.contractId });

      const optimisticId = `tmp-${Date.now()}`;
      const optimistic: Message = {
        id: optimisticId,
        conversationId: selected.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDeliveryStatus((prev) => ({ ...prev, [optimisticId]: "sending" }));
      scrollToBottom();

      try {
        const res = await fetch(`/api/conversations/${selected.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: currentUser.id,
            senderName: currentUser.name,
            content,
            receiverId: selected.otherPartyId || "",
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          const msg: Message = saved.data ?? saved;
          setDeliveryStatus((prev) => ({ ...prev, [optimisticId]: "sent" }));
          if (optimisticId !== msg.id) {
            setDeliveryStatus((prev) => {
              const { [optimisticId]: _, ...rest } = prev;
              return { ...rest, [msg.id]: "sent" };
            });
          }
          try {
            const sock = getSocket();
            sock.emit("join_room", selected.contractId);
            sock.emit("send_message", { roomId: selected.contractId, message: msg });
          } catch { /* WS off */ }
          setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
        }
      } catch { /* garder l'optimiste */ }
      finally {
        setSending(false);
      }
    },
    [draft, sending, selected, currentUser, scrollToBottom]
  );

  // ── Typing sortant ───────────────────────────────────
  const handleTyping = useCallback(() => {
    if (!selected || !socketRef.current?.connected || typingSentRef.current) return;
    socketRef.current.emit("typing", { roomId: selected.contractId, userName: currentUser?.name });
    typingSentRef.current = true;
    setTimeout(() => {
      typingSentRef.current = false;
      socketRef.current?.emit("stop_typing", { roomId: selected.contractId });
    }, 2500);
  }, [selected, currentUser?.name]);

  // ── Rendu ────────────────────────────────────────────

  const statusIcon = (status?: DeliveryStatus) => {
    switch (status) {
      case "sending": return "◌";
      case "sent": return "✓";
      case "delivered": return "✓✓";
      case "read": return "✓✓";
      default: return "";
    }
  };

  // Ne pas afficher la bulle sur les pages Messages (chat déjà en plein écran)
  const onMessagesPage = pathname?.includes("/messages");
  if (onMessagesPage) return null;

  return (
    <>
      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D5BE3] text-white shadow-lg hover:bg-[#1F4DD4] hover:shadow-xl transition-all duration-200 active:scale-95"
        aria-label="Chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* ── Panneau coulissant ── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] flex-col rounded-2xl border border-[#E2E0D9] bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-[#2D5BE3] px-5 py-3 text-white">
            <p className="text-[15px] font-semibold">
              {selected ? selected.title : "Messages"}
            </p>
            <div className="flex items-center gap-2">
              {selected && (
                <button
                  onClick={() => setSelected(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-sm"
                  title="Retour aux conversations"
                >
                  ←
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {!selected ? (
            /* ── Liste des conversations ── */
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2D5BE3] border-t-transparent" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                  <span className="text-3xl">💬</span>
                  <p className="text-[14px] text-[#5A5750]">Aucune conversation pour le moment.</p>
                  <p className="text-[12px] text-[#9C9A95]">
                    Les conversations apparaîtront ici dès qu&apos;un contrat sera actif.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className="flex w-full items-center gap-3 px-4 py-3 border-b border-[#F5F5F0] hover:bg-[#FAFAF8] transition-colors text-left"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(conv.otherPartyName || conv.title)}`}
                    >
                      {initials(conv.otherPartyName || conv.title)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-medium text-[#1A1916] truncate">
                          {conv.otherPartyName || conv.title}
                        </p>
                        {conv.lastMessageAt && (
                          <span className="text-[11px] text-[#9C9A95] shrink-0">
                            {fmtTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[12px] text-[#5A5750] truncate">
                          {conv.lastMessage || "Aucun message"}
                        </p>
                        {(conv.unreadCount ?? 0) > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2D5BE3] px-1.5 text-[10px] font-bold text-white shrink-0">
                            {conv.unreadCount! > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* ── Mini-chat ── */
            <>
              <div ref={msgContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[13px] text-[#5A5750]">
                    Aucun message. Dites bonjour !
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentUser?.id;
                    const isTemp = msg.id.startsWith("tmp-");
                    const status = isMe ? deliveryStatus[msg.id] : undefined;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] ${
                            isMe
                              ? `bg-[#2D5BE3] text-white rounded-br-sm ${isTemp ? "opacity-70" : ""}`
                              : "bg-[#F5F5F0] text-[#1A1916] rounded-bl-sm"
                          }`}
                        >
                          {!isMe && (
                            <p className="text-[11px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={`text-[10px] mt-1 flex items-center gap-1 ${
                              isMe ? "text-white/60" : "text-[#5A5750]"
                            }`}
                          >
                            {isTemp ? "Envoi…" : fmtTime(msg.createdAt)}
                            {isMe && status && (
                              <span className="text-[10px]">{statusIcon(status)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                {typingUser && (
                  <div className="flex justify-start">
                    <div className="rounded-xl px-3 py-2 bg-[#F5F5F0] rounded-bl-sm">
                      <p className="text-[11px] text-[#5A5750] italic">{typingUser} écrit…</p>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="border-t border-[#E2E0D9] p-3 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Votre message…"
                  className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-[13px] text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30 placeholder:text-[#9C9A95]"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="rounded-lg bg-[#2D5BE3] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
                >
                  {sending ? "…" : ">"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
