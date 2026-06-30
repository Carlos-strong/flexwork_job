"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  contractId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

interface ChatBoxProps {
  contractId: string;
  currentUserId: string;
  currentUserName: string;
  /** Nom du destinataire (affiché dans le header) */
  otherPartyName?: string;
}

export function ChatBox({
  contractId,
  currentUserId,
  currentUserName,
  otherPartyName = "Interlocuteur",
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Charger les messages
  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/messages?contractId=${contractId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.data ?? []));
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Polling toutes les 5 secondes (simule le temps réel)
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [contractId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          senderId: currentUserId,
          senderName: currentUserName,
          content: newMessage.trim(),
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setNewMessage("");
      }
    } catch {
      // Silencieux
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-[16px] border border-[#E2E0D9] flex flex-col h-[500px] bg-white shadow-sm">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E2E0D9] flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[12px] font-semibold text-[#2D5BE3]">
          {otherPartyName.charAt(0)}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#1A1916]">{otherPartyName}</p>
          <p className="text-[12px] text-[#1A7A4A] flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1A7A4A]" />
            En ligne
          </p>
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
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-[16px] px-4 py-2.5 ${
                  isMe
                    ? "bg-[#2D5BE3] text-white rounded-br-md"
                    : "bg-[#F5F5F0] text-[#1A1916] rounded-bl-md"
                }`}>
                  {!isMe && (
                    <p className="text-[12px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>
                  )}
                  <p className="text-[14px] whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-[#5A5750]"}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-[#E2E0D9] p-3 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Votre message..."
          className="flex-1 rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-2 text-[14px] text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30 placeholder:text-[#9C9A95]"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="rounded-[10px] bg-[#2D5BE3] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
        >
          {sending ? "..." : "Envoyer"}
        </button>
      </form>
    </div>
  );
}
