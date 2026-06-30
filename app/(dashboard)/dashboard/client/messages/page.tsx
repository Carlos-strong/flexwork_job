"use client";

import { useState, useEffect, useRef } from "react";

interface Conversation {
  id: string;
  title: string;
  contractId: string;
  lastMessage?: string;
  unreadCount?: number;
  freelancerName?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export default function ClientMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.data ?? []);
        setConversations(list);
        if (list.length > 0) setSelected(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/messages?conversationId=${selected.id}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.data ?? []);
        setMessages(list);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .catch(() => setMessages([]));
  }, [selected]);

  const sendMessage = async () => {
    if (!draft.trim() || !selected) return;
    const content = draft.trim();
    setDraft("");
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, content }),
      });
      setMessages((prev) => [
        ...prev,
        { id: `tmp-${Date.now()}`, conversationId: selected.id, senderId: "me", content, createdAt: new Date().toISOString() },
      ]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
      <div className="w-72 border-r border-[#E2E0D9] flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-[#E2E0D9]">
          <h2 className="font-semibold text-[#1A1916]">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-14 rounded-[10px] bg-[#F5F5F0]" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-[14px] text-[#5A5750]">
              <p className="text-[24px] mb-2">💬</p>
              <p>Aucune conversation</p>
            </div>
          ) : conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className={`w-full text-left p-4 border-b border-[#E2E0D9] last:border-b-0 hover:bg-[#EEF2FD] transition-colors ${selected?.id === conv.id ? "bg-[#EEF2FD]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-medium line-clamp-1 text-[#1A1916]">{conv.title}</p>
                {(conv.unreadCount ?? 0) > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-[20px] bg-[#2D5BE3] text-[10px] font-bold text-white">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className="mt-0.5 text-[12px] text-[#5A5750] line-clamp-1">{conv.lastMessage}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-[#E2E0D9] bg-white">
            <p className="font-semibold text-[#1A1916]">{selected.title}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.senderId === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-[16px] px-4 py-2.5 text-[14px] ${m.senderId === "me" ? "bg-[#2D5BE3] text-white rounded-br-sm" : "bg-[#F5F5F0] text-[#1A1916] rounded-bl-sm"}`}>
                  <p>{m.content}</p>
                  <p className={`mt-1 text-[10px] ${m.senderId === "me" ? "text-white/60" : "text-[#5A5750]"}`}>
                    {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-4 border-t border-[#E2E0D9] bg-white">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Écrivez votre message…"
                className="flex-1 rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[14px] text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30 placeholder:text-[#9C9A95]"
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim()}
                className="rounded-[10px] bg-[#2D5BE3] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#5A5750]">
          <div className="text-center">
            <p className="text-[36px] mb-3">💬</p>
            <p className="text-[14px]">Sélectionnez une conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
