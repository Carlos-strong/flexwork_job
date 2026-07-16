"use client";

/**
 * MessagesView — Vue messagerie complète partagée entre client et freelancer.
 *
 * Transport :
 *   1. WebSocket (Socket.io)  → livraison instantanée + typing + broadcast
 *   2. Polling REST 8 s       → fallback si WS indisponible
 *
 * Utilise le singleton socket partagé (lib/socket-client.ts).
 * Gère les accusés de réception, le statut de lecture et la présence.
 * Appels audio / vidéo via WebRTC (hook useCall + CallModal).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCall } from "@/hooks/use-call";
import { usePresence } from "@/hooks/use-presence";
import { CallModal } from "@/components/chat/call-modal";
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

interface EmailLogEntry {
  id: string;
  subject: string;
  category: string;
  preview: string;
  status: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessagesViewProps {
  /** "client" ou "freelancer" — influe sur le libellé et le lien contrat */
  role?: "client" | "freelancer";
}

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
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function fmtDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function contractUrl(role: "client" | "freelancer", contractId: string): string {
  return role === "client"
    ? `/dashboard/client/missions/${contractId}/contract`
    : `/dashboard/freelancer/contrat/${contractId}`;
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

const EMAIL_CATEGORY_ICONS: Record<string, string> = {
  verification: "🔐",
  application: "📩",
  offer: "📨",
  contract: "📝",
  payment: "💰",
  mission: "🚀",
  system: "🔔",
};

function fmtEmailDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── Composant principal ────────────────────────────────

export function MessagesView({ role = "client" }: MessagesViewProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "emails">("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Onglet Emails ──────────────────────────────────
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLogEntry | null>(null);
  const [emailDetail, setEmailDetail] = useState<{ html: string } | null>(null);

  const unreadEmailsCount = useMemo(
    () => emails.filter((e) => !e.readAt).length,
    [emails]
  );

  const loadEmails = useCallback(() => {
    fetch("/api/emails")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setEmails(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
      .finally(() => setEmailsLoading(false));
  }, []);

  useEffect(() => {
    loadEmails();
    const interval = setInterval(loadEmails, 20_000);
    return () => clearInterval(interval);
  }, [loadEmails]);

  const openEmail = useCallback((mail: EmailLogEntry) => {
    setSelectedEmail(mail);
    setEmailDetail(null);
    fetch(`/api/emails/${mail.id}`)
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((d) => {
        if (d?.data) {
          setEmailDetail({ html: d.data.html || "" });
          setEmails((prev) =>
            prev.map((e) => (e.id === mail.id ? { ...e, readAt: e.readAt || new Date().toISOString() } : e))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Transport
  const [socket, setSocket] = useState<Socket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<Record<string, DeliveryStatus>>({});

  const socketRef = useRef<Socket | null>(null);
  const typingSentRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // références stables pour les handlers WS (créés une seule fois)
  const selectedRef = useRef<Conversation | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  selectedRef.current = selected;
  conversationsRef.current = conversations;

  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
      }
    }, 50);
  }, []);

  // Détecter si l'utilisateur est en bas du scroll
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 100;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  // ── Présence de l'autre participant ───────────────────
  const { isUserOnline } = usePresence(selected?.contractId);
  const otherPartyId = selected?.otherPartyId;
  const otherOnline = otherPartyId ? isUserOnline(otherPartyId) : false;

  // ── Conversations triées par dernière activité ───────
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations]);

  // ── Filtre recherche ─────────────────────────────────
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return sortedConversations;
    const q = searchQuery.toLowerCase();
    return sortedConversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessage?.toLowerCase().includes(q))
    );
  }, [sortedConversations, searchQuery]);

  // ── Groupement des messages par date ─────────────────
  const groupedMessages = useMemo(() => {
    const groups: { date: string; label: string; messages: Message[] }[] = [];
    for (const msg of messages) {
      const dateKey = new Date(msg.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) {
        last.messages.push(msg);
      } else {
        groups.push({ date: dateKey, label: fmtDateSeparator(msg.createdAt), messages: [msg] });
      }
    }
    return groups;
  }, [messages]);

  // ── Ajout d'un message entrant (déduplication par ID) ─
  const addMessage = useCallback((data: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) return prev;
      return [...prev, data];
    });
    // Mettre à jour la liste des conversations dans tous les cas
    setConversations((prev) =>
      prev.map((c) =>
        c.id === data.conversationId
          ? { ...c, lastMessage: data.content, lastMessageAt: data.createdAt }
          : c
      )
    );
    scrollToBottom();

    // Envoyer un accusé de réception au serveur
    const roomId = selectedRef.current?.contractId;
    if (roomId && socketRef.current?.connected) {
      socketRef.current.emit("message_received", { messageId: data.id, roomId });
    }
  }, [scrollToBottom]);

  // ── Auth ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) setCurrentUser(d.user); })
      .catch(() => {});
  }, []);

  // ── Auto-resize textarea ─────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [draft]);

  // ── Liste des conversations (polling 10 s) ────────────
  const loadConversations = useCallback(() => {
    fetch("/api/conversations")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => {
        const list: Conversation[] = Array.isArray(d) ? d : (d.data ?? []);
        setConversations(list);
        setSelected((prev) => {
          if (!prev) return list.length > 0 ? list[0] : null;
          // Mettre à jour les champs de l'autre participant depuis le refresh
          const updated = list.find((c) => c.id === prev.id);
          return updated || prev;
        });
        // Dès que les conversations sont chargées, rejoindre toutes les rooms WS
        const sock = socketRef.current;
        if (sock?.connected && list.length > 0) {
          list.forEach((c) => { if (c.contractId) sock.emit("join_room", c.contractId); });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10_000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // ── WebSocket (singleton partagé lib/socket-client) ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    let sock: Socket;

    try {
      sock = getSocket();
      socketRef.current = sock;

      const onConnect = () => {
        setWsConnected(true);
        setSocket(sock);
        // Rejoindre TOUTES les conversations (pas seulement la sélectionnée)
        const convs = conversationsRef.current;
        if (convs.length > 0) {
          convs.forEach((c) => { if (c.contractId) sock.emit("join_room", c.contractId); });
        } else {
          const roomId = selectedRef.current?.contractId;
          if (roomId) sock.emit("join_room", roomId);
        }
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
        // Rejoindre TOUTES les conversations (pas seulement la sélectionnée)
        const convs = conversationsRef.current;
        if (convs.length > 0) {
          convs.forEach((c) => { if (c.contractId) sock.emit("join_room", c.contractId); });
        } else {
          const roomId = selectedRef.current?.contractId;
          if (roomId) sock.emit("join_room", roomId);
        }
      }

      // ── Messages ────────────────────────────────────
      sock.on("new_message", (msg: Message) => addMessage(msg));

      // ── Accusé de réception ─────────────────────────
      sock.on("message_delivered", ({ messageId }: { messageId: string }) => {
        setDeliveryStatus((prev) => {
          if (prev[messageId] === "read") return prev;
          return { ...prev, [messageId]: "delivered" };
        });
      });

      sock.on("message_received_ack", ({ messageId }: { messageId: string }) => {
        setDeliveryStatus((prev) => {
          if (prev[messageId] === "read") return prev;
          return { ...prev, [messageId]: "delivered" };
        });
      });

      // ── Lecture ─────────────────────────────────────
      sock.on("messages_read_ack", ({ messageIds }: { messageIds: string[] }) => {
        setDeliveryStatus((prev) => {
          const next = { ...prev };
          messageIds.forEach((id) => { next[id] = "read"; });
          return next;
        });
      });

      // ── Typing ──────────────────────────────────────
      sock.on("user_typing", ({ userName }: { userName: string }) => {
        setTypingUser(userName);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
      });

      sock.on("user_stop_typing", () => {
        setTypingUser(null);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      });

      // ── Notification de nouveau message ─────────────
      // Déclenche un rechargement immédiat des conversations
      // quand un nouveau message arrive (même si on est pas dans la room)
      sock.on("notification", (notif: { type?: string }) => {
        if (notif.type === "new_message") {
          loadConversations();
        }
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
        sock.off("notification");
        socketRef.current = null;
        setSocket(null);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    } catch { /* WS non disponible */ }

    return () => {
      socketRef.current = null;
      setSocket(null);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [addMessage]);

  // ── Rejoindre toutes les rooms de contrat au (re)connect ─
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock?.connected) return;
    const convs = conversationsRef.current;
    if (convs.length > 0) {
      convs.forEach((c) => { if (c.contractId) sock.emit("join_room", c.contractId); });
    }
  }, [wsConnected]);

  // ── Rejoindre la room WS quand la conversation change ─
  useEffect(() => {
    const contractId = selected?.contractId;
    if (!contractId || !socketRef.current?.connected) return;
    socketRef.current.emit("join_room", contractId);
    // Demander la présence de la room
    socketRef.current.emit("get_room_presence", contractId);
  }, [selected?.contractId]);

  // ── Marquer les messages comme lus ───────────────────
  useEffect(() => {
    if (!selected) return;
    const unreadIds = messages
      .filter((m) => m.senderId !== (currentUser?.id || "me"))
      .map((m) => m.id);
    if (unreadIds.length > 0 && socketRef.current?.connected) {
      socketRef.current.emit("messages_read", {
        roomId: selected.contractId,
        messageIds: unreadIds,
        userId: currentUser?.id || "",
      });
    }
  }, [messages, selected, currentUser]);

  // ── Chargement des messages + polling fallback ────────
  useEffect(() => {
    if (!selected) return;

    setMessages([]);
    setTypingUser(null);

    // Charger l'historique (REST)
    fetch(`/api/messages?conversationId=${encodeURIComponent(selected.id)}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => {
        const list: Message[] = Array.isArray(d) ? d : (d.data ?? []);
        setMessages(list);
        scrollToBottom();
      })
      .catch(() => setMessages([]));

    // Polling 8 s si WS absent
    const poll = setInterval(() => {
      if (!socketRef.current?.connected) {
        fetch(`/api/messages?conversationId=${encodeURIComponent(selected.id)}`)
          .then((r) => r.ok ? r.json() : { data: [] })
          .then((d) => {
            const list: Message[] = Array.isArray(d) ? d : (d.data ?? []);
            setMessages(list);
          })
          .catch(() => {});
      }
    }, 8000);

    return () => clearInterval(poll);
  }, [selected?.id, scrollToBottom]);

  // ── WebRTC (appels audio / vidéo) ─────────────────────
  const call = useCall({
    socket,                                    // socket en state → toujours à jour
    roomId: selected?.contractId || "",
    currentUserId: currentUser?.id || "",
    currentUserName: currentUser?.name || (role === "client" ? "Client" : "Freelancer"),
  });

  // ── Indicateur de frappe (sortant) ───────────────────
  const handleTyping = useCallback(() => {
    const sock = socketRef.current;
    const roomId = selectedRef.current?.contractId;
    if (!sock?.connected || !roomId || typingSentRef.current) return;
    sock.emit("typing", {
      roomId,
      userName: currentUser?.name || (role === "client" ? "Client" : "Freelancer"),
    });
    typingSentRef.current = true;
    setTimeout(() => {
      typingSentRef.current = false;
      if (socketRef.current?.connected && roomId) {
        socketRef.current.emit("stop_typing", { roomId });
      }
    }, 2500);
  }, [currentUser?.name, role]);

  // ── Envoi d'un message ────────────────────────────────
  const sendMessage = async () => {
    if (!draft.trim() || !selected || sending) return;
    const content = draft.trim();
    setDraft("");
    setSending(true);

    typingSentRef.current = false;
    if (socketRef.current?.connected && selected.contractId) {
      socketRef.current.emit("stop_typing", { roomId: selected.contractId });
    }

    const optimisticId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId: selected.id,
      senderId: currentUser?.id || "me",
      senderName: currentUser?.name || (role === "client" ? "Client" : "Freelancer"),
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDeliveryStatus((prev) => ({ ...prev, [optimisticId]: "sending" }));
    scrollToBottom();

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.id,
          senderId: currentUser?.id || "anon",
          senderName: currentUser?.name || (role === "client" ? "Client" : "Freelancer"),
          content,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        const msg: Message = saved.data ?? saved;

        // Marquer comme "envoyé"
        setDeliveryStatus((prev) => ({ ...prev, [optimisticId]: "sent" }));
        if (optimisticId !== msg.id) {
          setDeliveryStatus((prev) => {
            const { [optimisticId]: _, ...rest } = prev;
            return { ...rest, [msg.id]: "sent" };
          });
        }

        // Diffusion WS aux autres participants
        try {
          const sock = getSocket();
          if (selected.contractId) {
            sock.emit("send_message", {
              roomId: selected.contractId,
              message: msg,
            });
          }
        } catch { /* WS non disponible */ }

        // Remplacer le message optimiste
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selected.id
              ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch { /* garder le message optimiste */ }
    finally { setSending(false); }
  };

  const isMe = (msg: Message) => msg.senderId === (currentUser?.id || "me");
  const otherPartyName = selected?.otherPartyName || selected?.title || "Interlocuteur";

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
      {/* ── Modal d'appel WebRTC ─────────────────────── */}
      <CallModal
        callState={call.callState}
        callType={call.callType}
        incomingCall={call.incomingCall}
        otherPartyName={otherPartyName}
        currentUserName={currentUser?.name || (role === "client" ? "Client" : "Freelancer")}
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

      {/* ── Onglets Chat / Emails ─────────────────────── */}
      <div className="flex items-center gap-1 mb-3 rounded-[12px] bg-[#F5F5F0] p-1 w-fit">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition-colors ${
            activeTab === "chat" ? "bg-white text-[#1A1916] shadow-sm" : "text-[#5A5750] hover:text-[#1A1916]"
          }`}
        >
          💬 Messagerie
          {conversations.some((c) => (c.unreadCount ?? 0) > 0) && (
            <span className="h-2 w-2 rounded-full bg-[#2D5BE3]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("emails")}
          className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-semibold transition-colors ${
            activeTab === "emails" ? "bg-white text-[#1A1916] shadow-sm" : "text-[#5A5750] hover:text-[#1A1916]"
          }`}
        >
          ✉️ Emails
          {unreadEmailsCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2D5BE3] px-1 text-[10px] font-bold text-white">
              {unreadEmailsCount > 9 ? "9+" : unreadEmailsCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "emails" ? (
        <div className="h-[calc(100vh-11rem)] flex rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
          {/* ── Liste des emails ── */}
          <div className="w-80 border-r border-[#E2E0D9] flex flex-col bg-white shrink-0">
            <div className="px-4 py-3.5 border-b border-[#E2E0D9]">
              <h2 className="font-semibold text-[15px] text-[#1A1916]">Emails reçus</h2>
              <p className="text-[12px] text-[#9C9A95] mt-0.5">Activation, offres, contrats, paiements…</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {emailsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse h-16 rounded-[10px] bg-[#F5F5F0]" />
                  ))}
                </div>
              ) : emails.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-[32px] mb-2">✉️</p>
                  <p className="text-[13px] font-medium text-[#1A1916]">Aucun email</p>
                  <p className="mt-1 text-[12px] text-[#9C9A95] leading-snug">
                    Vos notifications par email apparaîtront ici.
                  </p>
                </div>
              ) : (
                emails.map((mail) => (
                  <button
                    key={mail.id}
                    onClick={() => openEmail(mail)}
                    className={`w-full text-left p-3 border-b border-[#E2E0D9] last:border-b-0 transition-colors hover:bg-[#EEF2FD] ${
                      selectedEmail?.id === mail.id ? "bg-[#EEF2FD]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[15px]">
                        {EMAIL_CATEGORY_ICONS[mail.category] ?? "🔔"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className={`text-[13px] truncate ${!mail.readAt ? "font-semibold text-[#1A1916]" : "font-medium text-[#5A5750]"}`}>
                            {mail.subject}
                          </p>
                        </div>
                        <p className="text-[11px] text-[#9C9A95] mt-0.5 truncate">{mail.preview}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-[#9C9A95]">{fmtEmailDate(mail.createdAt)}</span>
                          {!mail.readAt && <span className="h-1.5 w-1.5 rounded-full bg-[#2D5BE3]" />}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Détail de l'email sélectionné ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAF8]">
            {selectedEmail ? (
              <>
                <div className="px-6 py-4 border-b border-[#E2E0D9] bg-white">
                  <p className="text-[12px] text-[#9C9A95]">{fmtEmailDate(selectedEmail.createdAt)}</p>
                  <h3 className="text-[17px] font-semibold text-[#1A1916] mt-1">{selectedEmail.subject}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {emailDetail ? (
                    <div
                      className="rounded-[12px] bg-white border border-[#E2E0D9] p-6 shadow-sm"
                      dangerouslySetInnerHTML={{ __html: emailDetail.html }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2D5BE3] border-t-transparent" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EEF2FD]">
                    <span className="text-[32px]">✉️</span>
                  </div>
                  <p className="text-[15px] font-semibold text-[#1A1916]">Sélectionnez un email</p>
                  <p className="mt-1.5 text-[13px] text-[#5A5750] leading-snug">
                    Consultez l&apos;historique de vos notifications par email
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="h-[calc(100vh-11rem)] flex rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">

        {/* ── Colonne gauche : liste des conversations ── */}
        <div className="w-72 border-r border-[#E2E0D9] flex flex-col bg-white shrink-0">
          <div className="px-4 py-3.5 border-b border-[#E2E0D9] flex items-center justify-between">
            <h2 className="font-semibold text-[15px] text-[#1A1916]">Messages</h2>
            {/* Indicateur de connexion global */}
            <span
              title={wsConnected ? "WebSocket actif" : "Connexion…"}
              className={`flex h-2 w-2 rounded-full transition-colors ${
                wsConnected ? "bg-[#1A7A4A]" : "bg-[#D1CFC8]"
              }`}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-16 rounded-[10px] bg-[#F5F5F0]" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[32px] mb-2">💬</p>
                <p className="text-[13px] font-medium text-[#1A1916]">Aucune conversation</p>
                <p className="mt-1 text-[12px] text-[#9C9A95] leading-snug">
                  Les conversations apparaissent dès qu'un contrat est signé.
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left p-3 border-b border-[#E2E0D9] last:border-b-0 transition-colors hover:bg-[#EEF2FD] ${
                    selected?.id === conv.id ? "bg-[#EEF2FD]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar initiales */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[12px] font-semibold text-[#2D5BE3]">
                      {initials(conv.otherPartyName || conv.title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-[13px] font-semibold text-[#1A1916] truncate">{conv.otherPartyName || conv.title}</p>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-[#9C9A95] shrink-0">
                            {fmtTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className="text-[12px] text-[#5A5750] truncate flex-1">
                          {conv.lastMessage || "Aucun message"}
                        </p>
                        {(conv.unreadCount ?? 0) > 0 && (
                          <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#2D5BE3] text-[10px] font-bold text-white shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Zone principale : chat ─────────────────── */}
        {selected ? (
          <div className="flex-1 flex flex-col min-w-0">

            {/* Header de la conversation */}
            <div className="px-[18px] py-4 border-b border-[#DADFDD] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-medium relative shrink-0"
                  style={{ background: "linear-gradient(155deg,#2DA579,#14523B)", color: "#fff", fontFamily: "var(--font-fraunces, serif)" }}
                >
                  {initials(otherPartyName)}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: "#2DA579" }} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[14.5px] text-[#0D1526] truncate">{otherPartyName}</p>
                  <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: otherOnline ? "#2DA579" : wsConnected ? "#6B7280" : "#D1CFC8" }} />
                    {otherOnline ? "En ligne" : wsConnected ? "Hors ligne" : "Connexion…"}
                  </p>
                </div>
              </div>

              {/* Actions : voir le contrat + appels */}
              <div className="flex items-center gap-[6px] shrink-0">
                {selected.contractId && (
                  <a
                    href={contractUrl(role, selected.contractId)}
                    title="Voir l'espace contrat"
                    className="w-[34px] h-[34px] rounded-[9px] border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] hover:bg-[#E4F1EC] transition-all text-[14px]"
                  >
                    📋
                  </a>
                )}
                <button
                  onClick={() => call.startCall("audio")}
                  disabled={call.callState !== "idle" || !socket}
                  title="Appel audio"
                  className="w-[34px] h-[34px] rounded-[9px] border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] hover:bg-[#E4F1EC] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 3.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.66-1.85.991.991 0 01-.56-.9v-3.1A17.6 17.6 0 0012 9z"/></svg>
                </button>
                <button
                  onClick={() => call.startCall("video")}
                  disabled={call.callState !== "idle" || !socket}
                  title="Appel vidéo"
                  className="w-[34px] h-[34px] rounded-[9px] border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] hover:bg-[#E4F1EC] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                </button>
              </div>
            </div>

            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#F5F6F4]"
              style={{ background: "radial-gradient(circle at 90% -10%, rgba(31,122,92,0.05), transparent 40%), #F5F6F4" }}
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-[40px] mb-3">👋</p>
                    <p className="text-[14px] font-medium text-[#0D1526]">Démarrez la conversation</p>
                    <p className="mt-1 text-[12px] text-[#6B7280]">
                      Envoyez un message à{" "}
                      {role === "client" ? "votre freelancer" : "votre client"}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = isMe(m);
                  const isTemp = m.id.startsWith("tmp-");
                  const status = mine ? deliveryStatus[m.id] : undefined;
                  return (
                    <div key={m.id} className={`flex flex-col mb-[10px] ${mine ? "items-end" : "items-start"} max-w-[78%] ${mine ? "self-end" : "self-start"}`}>
                      <div className={`px-3 py-2.5 rounded-[14px] text-[13.5px] leading-relaxed ${
                        mine
                          ? `bg-[#1F7A5C] text-white rounded-br-[4px] ${isTemp ? "opacity-70" : ""}`
                          : "bg-[#F0F1F5] text-[#0D1526] rounded-bl-[4px]"
                      }`}>
                        {!mine && m.senderName && (
                          <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#1F7A5C" }}>
                            {m.senderName}
                          </p>
                        )}
                        <p className="text-[13.5px] whitespace-pre-wrap break-words leading-relaxed">
                          {m.content}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 mt-[3px] px-[3px] text-[10.5px] font-mono ${mine ? "justify-end" : "justify-start"}`}
                        style={{ color: "#6B7280", fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {isTemp ? "Envoi…" : new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {mine && status && (
                          <span style={{ color: status === "read" ? "#1F7A5C" : "#6B7280" }}>
                            {status === "read" || status === "delivered" ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Indicateur de frappe */}
              {typingUser && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#E8E6E0] text-[11px] font-semibold text-[#5A5750]">
                    {initials(typingUser)}
                  </div>
                  <div className="bg-[#F0F1F5] rounded-[14px] rounded-bl-[4px] px-4 py-2.5">
                    <p className="text-[12px] text-[#6B7280] italic">{typingUser} écrit…</p>
                    <div className="flex gap-1 mt-1.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-[#8B93B0]"
                          style={{ animation: `tdot 1.2s ease-in-out infinite`, animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 sm:px-[14px] py-3 border-t border-[#DADFDD] bg-white">
              <div className="flex items-end gap-2">
                <input
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Écrire un message…"
                  disabled={sending}
                  className="flex-1 bg-[#F5F6F4] rounded-[18px] px-[14px] py-2.5 text-[13.5px] text-[#0D1526] outline-none leading-relaxed disabled:opacity-60"
                  style={{ maxHeight: 100 }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!draft.trim() || sending}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] text-white transition-all shrink-0"
                  style={{ background: draft.trim() && !sending ? "#1F7A5C" : "#DADFDD", color: draft.trim() && !sending ? "#fff" : "#6B7280" }}
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#FAFAF8]">
            <div className="text-center px-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#EEF2FD]">
                <span className="text-[32px]">💬</span>
              </div>
              <p className="text-[15px] font-semibold text-[#1A1916]">
                Sélectionnez une conversation
              </p>
              <p className="mt-1.5 text-[13px] text-[#5A5750] leading-snug">
                Vos échanges avec{" "}
                {role === "client" ? "vos freelancers" : "vos clients"} apparaissent ici
              </p>
            </div>
          </div>
        )}
      </div>
      )}
    </>
  );
}
