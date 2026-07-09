"use client";

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { useCall } from "@/hooks/use-call";
import { CallModal } from "@/components/chat/call-modal";
import type { Socket } from "socket.io-client";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PipelineApplication {
  id: string;
  freelancerName: string;
  freelancerTitle?: string;
  proposedBudget?: number;
  status: string;
  coverLetter?: string;
  skills?: string[];
  createdAt?: string;
  freelancerId?: string;
  portfolio?: string[];
  reviews?: { label: string; stars: number }[];
  certifications?: string[];
  /** KYC validé par l'admin */
  kycVerified?: boolean;
}

interface Milestone {
  desc: string;
  unit: string;
  qty: number;
  unitPrice: number;
  delay: string;
  executionRate: number; // Taux d'exécution attendu (0-100)
}

interface ChatMessage {
  id: string;
  content: string;
  from: "client" | "freelancer";
  isFile?: boolean;
  fileName?: string;
  fileSize?: string;
  createdAt: string;
}

type ViewId = "v1" | "v2" | "v3" | "v4";

// ─── Helpers ───────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function fmtEuro(n: number) {
  return n.toLocaleString("fr-FR") + " €";
}

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  UNREAD:          { cls: "bg-[#EAECF3] text-[#4A5178]",     label: "Non consulté" },
  READ:            { cls: "bg-[#EAECF3] text-[#4A5178]",     label: "Consulté" },
  PENDING:         { cls: "bg-[#EAECF3] text-[#4A5178]",     label: "En attente" },
  SHORTLISTED:     { cls: "bg-[#E4F1EC] text-[#1F7A5C]",     label: "Présélectionnée" },
  DISCUSSION:      { cls: "bg-[#E4F1EC] text-[#1F7A5C]",     label: "En discussion" },
  INTERVIEW:       { cls: "bg-[#FBEDD8] text-[#B8720A]",     label: "Entretien" },
  OFFER_SENT:      { cls: "bg-[#FBEDD8] text-[#B8720A]",     label: "Offre envoyée" },
  OFFER_ACCEPTED:  { cls: "bg-[#E4F1EC] text-[#1F7A5C]",     label: "Offre acceptée" },
  OFFER_DECLINED:  { cls: "bg-[#F8E7E4] text-[#B23A2E]",     label: "Offre refusée" },
  ACCEPTED:        { cls: "bg-[#1F7A5C] text-white",          label: "Acceptée" },
  REJECTED:        { cls: "bg-[#F8E7E4] text-[#B23A2E]",     label: "Refusée" },
  WITHDRAWN:       { cls: "bg-[#F0F0EE] text-[#6B7280]",     label: "Retirée" },
  ARCHIVED:        { cls: "bg-[#F0F0EE] text-[#6B7280]",     label: "Archivée" },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { cls: "bg-[#EAECF3] text-[#4A5178]", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-[9px] py-[3px] rounded-full whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

// Module-level constant — évite la recréation à chaque render
const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "init-1",
    content: "Bonjour ! J'ai bien vu votre offre, je suis disponible dès la semaine prochaine.",
    from: "freelancer",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "init-2",
    content: "Merci. Pouvez-vous nous en dire plus sur votre expérience ?",
    from: "client",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

// ─── Main Component ────────────────────────────────────────────────────────

interface RecruitmentPipelineProps {
  missionId: string;
  missionTitle: string;
  missionDescription?: string;
  missionSkills?: string[];
  missionBudget?: string;
  missionDuration?: string;
  missionStatus?: string;
  initialApplications: PipelineApplication[];
  contractId?: string;
  editHref?: string;
  /** When true, removes outer border/shadow (used when embedded inside another container) */
  embedded?: boolean;
}

export function RecruitmentPipeline({
  missionId,
  missionTitle,
  missionDescription,
  missionSkills,
  missionBudget,
  missionDuration,
  missionStatus,
  initialApplications,
  contractId,
  editHref,
  embedded = false,
}: RecruitmentPipelineProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewId>(() => {
    // Priorité au paramètre d'URL ?view=v2 (survit au refresh)
    const viewParam = searchParams?.get("view") as ViewId | null;
    if (viewParam && ["v1", "v2", "v3", "v4"].includes(viewParam)) return viewParam;
    if (contractId) return "v4";
    if (initialApplications.some((a) => ["OFFER_SENT", "OFFER_ACCEPTED"].includes(a.status))) return "v3";
    return "v1";
  });

  // Synchroniser activeView → URL ?view= (survit au refresh)
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const current = params.get("view");
    if (current !== activeView) {
      if (activeView === "v1") {
        params.delete("view");
      } else {
        params.set("view", activeView);
      }
      const qs = params.toString();
      router.replace(`${qs ? "?" + qs : window.location.pathname}`, { scroll: false });
    }
  }, [activeView, searchParams, router]);
  const [isPending, startTransition] = useTransition();

  // Applications state
  const [applications, setApplications] = useState<PipelineApplication[]>(initialApplications);
  const shortlisted = useMemo(
    () => applications.filter(
      (a) => ["SHORTLISTED", "DISCUSSION", "INTERVIEW", "OFFER_SENT", "OFFER_ACCEPTED"].includes(a.status)
    ),
    [applications]
  );

  // Profile modal
  const [profileModal, setProfileModal] = useState<PipelineApplication | null>(null);

  // Interview / chat state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    shortlisted[0]?.id ?? null
  );
  const [showVideo, setShowVideo] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatInput, setChatInput] = useState("");

  // ── Utilisateur courant + WebSocket ─────────────────
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomJoinedRef = useRef<Set<string>>(new Set());

  // Récupérer l'utilisateur connecté
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setCurrentUser(d.user);
      })
      .catch(() => {});
  }, []);

  // Initialiser le socket (singleton partagé)
  useEffect(() => {
    try {
      const sock = getSocket();
      socketRef.current = sock;
      setSocket(sock);

      // ── Recevoir les messages en temps réel ──────────
      const onNewMessage = (msg: { id: string; senderId: string; senderName?: string; content: string; createdAt?: string; roomId?: string }) => {
        // Ignorer ses propres messages (déjà ajoutés en optimiste)
        if (msg.senderId === currentUser?.id) return;

        // Convertir le message au format ChatMessage du pipeline
        const newMsg: ChatMessage = {
          id: msg.id,
          content: msg.content,
          from: "freelancer",
          createdAt: msg.createdAt ?? new Date().toISOString(),
        };

        // Déterminer le candidat : utiliser le roomId s'il est fourni
        let candidateId = selectedCandidateId;
        if (msg.roomId) {
          // Le roomId est au format pre-{missionId}-{freelancerProfileId}
          // On cherche le candidat dont le freelancerId correspond
          const matchingApp = applications.find((a) => a.freelancerId && msg.roomId?.includes(a.freelancerId!));
          if (matchingApp) candidateId = matchingApp.id;
        }

        if (candidateId) {
          setChatMessages((prev) => {
            const existing = prev[candidateId] ?? [];
            if (existing.some((m) => m.id === newMsg.id)) return prev;
            return { ...prev, [candidateId]: [...existing, newMsg] };
          });
        }
      };

      sock.on("new_message", onNewMessage);

      return () => {
        sock.off("new_message", onNewMessage);
      };
    } catch {
      // WS non disponible
    }
  }, [currentUser?.id, selectedCandidateId, applications]);

  // ── Charger les messages existants depuis l'API ──
  useEffect(() => {
    const candidates = shortlisted.filter((a) => a.freelancerId);
    if (candidates.length === 0) return;

    let cancelled = false;
    Promise.all(
      candidates.map(async (c) => {
        const cid = `pre-${missionId}-${c.freelancerId}`;
        try {
          const res = await fetch(`/api/messages?contractId=${encodeURIComponent(cid)}`);
          if (!res.ok) return;
          const d = await res.json();
          const msgs: { id: string; senderId: string; senderName?: string; content: string; createdAt: string }[]
            = Array.isArray(d) ? d : (d.data ?? []);
          if (cancelled) return;
          // Convertir au format ChatMessage du pipeline
          const pipelineMsgs: ChatMessage[] = msgs.map((m) => ({
            id: m.id,
            content: m.content,
            from: m.senderId === currentUser?.id ? "client" : "freelancer",
            createdAt: m.createdAt,
          }));
          // Ne garder que les messages réels (pas les templates)
          if (pipelineMsgs.length > 0) {
            setChatMessages((prev) => ({
              ...prev,
              [c.id]: pipelineMsgs,
            }));
          }
        } catch { /* ignore */ }
      }),
    );
    return () => { cancelled = true; };
  }, [shortlisted, missionId, currentUser?.id]);

  // Offer / milestones state
  const [offerType, setOfferType] = useState<"FIXED" | "HOURLY">("FIXED");
  const [offerTitle, setOfferTitle] = useState(missionTitle);
  const [offerDesc, setOfferDesc] = useState(missionDescription ?? "");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerDuration, setOfferDuration] = useState(missionDuration ?? "");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { desc: "Livrable initial", unit: "Forfait", qty: 1, unitPrice: 1000, delay: "2 semaines", executionRate: 100 },
  ]);
  const [milestoneModal, setMilestoneModal] = useState<{ open: boolean; idx: number | null }>({
    open: false,
    idx: null,
  });
  const [mDesc, setMDesc] = useState("");
  const [mUnit, setMUnit] = useState("Forfait");
  const [mQty, setMQty] = useState(1);
  const [mUnitPrice, setMUnitPrice] = useState<number | "">("");
  const [mDelay, setMDelay] = useState("");
  const [mExecutionRate, setMExecutionRate] = useState<number>(100);
  const [mPriceError, setMPriceError] = useState(false);
  const [rateError, setRateError] = useState("");
  const [offerSending, setOfferSending] = useState(false);
  const [offerSent, setOfferSent] = useState(
    () => initialApplications.some((a) => ["OFFER_SENT", "OFFER_ACCEPTED"].includes(a.status))
  );
  const [offerId, setOfferId] = useState<string | null>(null);

  // Contract view
  const [contractView, setContractView] = useState<"summary" | null>(null);

  // Init chat for first shortlisted candidate
  useEffect(() => {
    if (shortlisted.length > 0 && !selectedCandidateId) {
      setSelectedCandidateId(shortlisted[0].id);
    }
  }, [shortlisted, selectedCandidateId]);

  // Cleanup du timer offer au démontage
  useEffect(() => {
    return () => {
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatMessages, selectedCandidateId]);

  // Track fill height
  const views: ViewId[] = ["v1", "v2", "v3", "v4"];
  const viewIdx = views.indexOf(activeView);
  const fillPct = viewIdx === 0 ? 0 : (viewIdx / (views.length - 1)) * 100;

  // ── Application status change ───────────────
  const handleStatusChange = useCallback((appId: string, newStatus: string) => {
    const prev = applications;
    setApplications((apps) => apps.map((a) => (a.id === appId ? { ...a, status: newStatus } : a)));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${appId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          setApplications(prev);
        }
      } catch {
        setApplications(prev);
      }
    });
  }, [applications, startTransition]);

  // ── Chat ───────────────────────────────────
  const getMessages = useCallback((candidateId: string): ChatMessage[] =>
    chatMessages[candidateId] ?? DEFAULT_CHAT_MESSAGES,
    [chatMessages]
  );

  // Messages filtrés pour le candidat sélectionné (optimisation)
  const selectedMessages = useMemo(
    () => selectedCandidateId ? getMessages(selectedCandidateId).filter((m) => !m.id.startsWith("1")) : [],
    [selectedCandidateId, getMessages]
  );

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || !selectedCandidateId || !currentUser?.id) return;

    const content = chatInput.trim();
    const optimisticId = `pipeline-msg-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      content,
      from: "client",
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setChatMessages((prev) => ({
      ...prev,
      [selectedCandidateId]: [...(prev[selectedCandidateId] ?? DEFAULT_CHAT_MESSAGES), optimistic],
    }));
    setChatInput("");

    // Trouver l'application correspondante
    const app = applications.find((a) => a.id === selectedCandidateId);
    if (!app?.freelancerId) return;

    // Utiliser un contractId synthétique pour le pré-contrat
    const syntheticContractId = `pre-${missionId}-${app.freelancerId}`;

    // Rejoindre la room WS une seule fois
    const sock = socketRef.current;
    if (sock?.connected && !roomJoinedRef.current.has(syntheticContractId)) {
      sock.emit("join_room", syntheticContractId);
      roomJoinedRef.current.add(syntheticContractId);
    }

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: syntheticContractId,
          senderId: currentUser.id,
          senderName: currentUser.name || "Client",
          title: missionTitle,
          content,
          receiverId: app.freelancerId,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        const realMsg = saved.data ?? saved;

        // Remplacer le message optimiste
        setChatMessages((prev) => ({
          ...prev,
          [selectedCandidateId]: (prev[selectedCandidateId] ?? DEFAULT_CHAT_MESSAGES).map((m) =>
            m.id === optimisticId
              ? { ...m, id: realMsg.id, createdAt: realMsg.createdAt ?? m.createdAt }
              : m
          ),
        }));

        // Broadcast WebSocket aux autres participants
        sock?.emit("send_message", {
          roomId: syntheticContractId,
          message: {
            id: realMsg.id,
            conversationId: realMsg.conversationId ?? syntheticContractId,
            senderId: currentUser.id,
            senderName: currentUser.name || "Client",
            content,
            createdAt: realMsg.createdAt ?? new Date().toISOString(),
          },
        });
      }
    } catch {
      // Garder le message optimiste en cas d'échec
      console.warn("[PipelineChat] Message non sauvegardé, conservé localement");
    }
  }, [chatInput, selectedCandidateId, currentUser, applications, missionId]);

  const sendFileMessage = useCallback(async () => {
    if (!selectedCandidateId || !currentUser?.id) return;

    const app = applications.find((a) => a.id === selectedCandidateId);
    if (!app?.freelancerId) return;

    const syntheticContractId = `pre-${missionId}-${app.freelancerId}`;
    const optimisticId = `pipeline-file-${Date.now()}`;
    const msg: ChatMessage = {
      id: optimisticId,
      content: "",
      from: "client",
      isFile: true,
      fileName: "Cahier_des_charges.pdf",
      fileSize: "1,1 Mo",
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => ({
      ...prev,
      [selectedCandidateId]: [...(prev[selectedCandidateId] ?? DEFAULT_CHAT_MESSAGES), msg],
    }));

    // Rejoindre la room WS
    const sock = socketRef.current;
    if (sock?.connected && !roomJoinedRef.current.has(syntheticContractId)) {
      sock.emit("join_room", syntheticContractId);
      roomJoinedRef.current.add(syntheticContractId);
    }

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: syntheticContractId,
          senderId: currentUser.id,
          senderName: currentUser.name || "Client",
          title: missionTitle,
          content: "📎 Fichier partagé : Cahier_des_charges.pdf",
          receiverId: app.freelancerId,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        const realMsg = saved.data ?? saved;

        setChatMessages((prev) => ({
          ...prev,
          [selectedCandidateId]: (prev[selectedCandidateId] ?? DEFAULT_CHAT_MESSAGES).map((m) =>
            m.id === optimisticId
              ? { ...m, id: realMsg.id, createdAt: realMsg.createdAt ?? m.createdAt }
              : m
          ),
        }));

        sock?.emit("send_message", {
          roomId: syntheticContractId,
          message: {
            id: realMsg.id,
            conversationId: realMsg.conversationId ?? syntheticContractId,
            senderId: currentUser.id,
            senderName: currentUser.name || "Client",
            content: "📎 Fichier partagé : Cahier_des_charges.pdf",
            createdAt: realMsg.createdAt ?? new Date().toISOString(),
          },
        });
      }
    } catch {
      // Garder le message localement
    }
  }, [selectedCandidateId, currentUser, applications, missionId]);

  // ── Milestones ─────────────────────────────
  const milestonesTotal = useMemo(
    () => milestones.reduce((s, m) => s + m.qty * m.unitPrice, 0),
    [milestones]
  );

  /** Somme des taux d'exécution actuels */
  const milestonesRateSum = useMemo(
    () => milestones.reduce((s, m) => s + m.executionRate, 0),
    [milestones]
  );

  /** Redistribue les taux pour que la somme fasse toujours 100 % */
  /** @deprecated Plus utilisé — les taux sont libres, validation au submit uniquement */
  const redistributeRates = (_list: Milestone[], _changedIdx: number, _newRate: number): Milestone[] => _list;

  const openMilestoneModal = (idx: number | null = null) => {
    if (idx !== null) {
      const m = milestones[idx];
      setMDesc(m.desc);
      setMUnit(m.unit);
      setMQty(m.qty);
      setMUnitPrice(m.unitPrice);
      setMDelay(m.delay);
      setMExecutionRate(m.executionRate);
    } else {
      // Nouveau jalon : proposer le reste disponible
      const remaining = 100 - milestonesRateSum;
      const suggested = remaining > 0 ? remaining : Math.floor(100 / (milestones.length + 1));
      setMDesc("");
      setMUnit("Forfait");
      setMQty(1);
      setMUnitPrice("");
      setMDelay("");
      setMExecutionRate(Math.max(1, suggested));
    }
    setMPriceError(false);
    setRateError("");
    setMilestoneModal({ open: true, idx });
  };

  const saveMilestone = () => {
    const price = typeof mUnitPrice === "number" ? mUnitPrice : parseFloat(String(mUnitPrice)) || 0;
    if (price <= 0) { setMPriceError(true); return; }
    if (!mDesc.trim() || !mDelay.trim()) { alert("Merci de renseigner la description et le délai."); return; }
    const entry: Milestone = {
      desc: mDesc.trim(), unit: mUnit, qty: mQty, unitPrice: price,
      delay: mDelay.trim(), executionRate: Math.min(100, Math.max(0, mExecutionRate)),
    };
    setMilestones((prev) => {
      const next = [...prev];
      if (milestoneModal.idx !== null) {
        next[milestoneModal.idx] = entry;
      } else {
        next.push(entry);
      }
      return next;
    });
    setRateError("");
    setMilestoneModal({ open: false, idx: null });
  };

  const deleteMilestone = (idx: number) =>
    setMilestones((prev) => prev.filter((_, i) => i !== idx));

  const moveMilestone = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= milestones.length) return;
    setMilestones((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  // ── Send offer ────────────────────────────
  const sendOffer = async () => {
    if (!offerTitle.trim() || milestones.length === 0) {
      alert("Renseignez un titre de mission et au moins un jalon.");
      return;
    }
    // Vérifier que la somme des taux d'exécution = 100 %
    const totalRate = milestones.reduce((s, m) => s + m.executionRate, 0);
    if (totalRate !== 100) {
      setRateError(
        `La somme des taux alloués doit être égale à 100% (actuellement ${totalRate}%). Ajustez les jalons.`
      );
      return;
    }
    setRateError("");
    setOfferSending(true);
    try {
      // Mapper les jalons au format attendu par l'API /api/offers
      const mappedMilestones = milestones.map((m) => ({
        title: m.desc,
        description: `${m.qty} × ${m.unit} — Délai: ${m.delay}`,
        amount: m.qty * m.unitPrice,
        executionRate: m.executionRate,
      }));

      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedCandidateId,
          title: offerTitle,
          description: offerDesc || offerTitle,
          offerType,
          totalBudget: offerType === "FIXED" ? milestonesTotal : undefined,
          hourlyRate: offerType === "HOURLY" ? milestonesTotal : undefined,
          startDate: offerStartDate || new Date().toISOString().split("T")[0],
          endDate: undefined,
          milestones: mappedMilestones,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || `Erreur ${res.status}`);
      }

      setOfferSent(true);
      offerTimerRef.current = setTimeout(() => setActiveView("v4"), 800);
    } catch (err) {
      console.error("Erreur envoi offre:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'offre.");
    } finally {
      setOfferSending(false);
    }
  };

  // Dropdown action open state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const close = () => setOpenDropdown(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openDropdown]);

  // Consulter action — marks READ + notification (gérée côté serveur dans le PUT)
  const handleConsulter = useCallback((appId: string) => {
    handleStatusChange(appId, "READ");
  }, [handleStatusChange]);

  // ── Selected candidate info ───────────────
  const selectedCandidate = useMemo(
    () => applications.find((a) => a.id === selectedCandidateId),
    [applications, selectedCandidateId]
  );

  // ── Room ID pour les appels WebRTC ────────
  const callRoomId = selectedCandidate
    ? `pre-${missionId}-${selectedCandidate.freelancerId}`
    : contractId || "";

  // ── WebRTC (appels audio / vidéo) ──────────
  const call = useCall({
    socket,
    roomId: callRoomId,
    currentUserId: currentUser?.id || "",
    currentUserName: currentUser?.name || "Client",
  });

  return (
    <>
      {/* ── Modal d'appel WebRTC ─────────────────────── */}
      <CallModal
        callState={call.callState}
        callType={call.callType}
        incomingCall={call.incomingCall}
        otherPartyName={selectedCandidate?.freelancerName || "Interlocuteur"}
        currentUserName={currentUser?.name || "Client"}
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

      <div
      className={`overflow-hidden ${embedded ? "" : "rounded-[16px] border border-[#DADFDD] shadow-[0_4px_24px_rgba(20,33,61,0.08)]"}`}
      style={{ fontFamily: "var(--font-space-grotesk, Inter, sans-serif)", background: "#F5F6F4" }}
    >
      {/* ── HORIZONTAL STEPPER ──────────────────────────── */}
      <div
        className="px-8 pt-6 pb-0"
        style={{ background: "#fff", borderBottom: "1px solid #DADFDD" }}
      >
        {/* Mission title row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.08em] font-medium mb-0.5"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
            >
              Pipeline de recrutement
            </p>
            <h1
              className="text-[20px] font-medium tracking-[-0.01em] leading-tight"
              style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
            >
              {missionTitle}
            </h1>
          </div>
          {editHref && (
            <Link
              href={editHref}
              className="flex-shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-[8px] border border-[#DADFDD] bg-white text-[#6B7280] hover:border-[#14213D] hover:text-[#14213D] transition-colors mt-0.5"
            >
              ✎ Modifier la mission
            </Link>
          )}
        </div>

        {/* Steps */}
        <div className="flex items-end">
          {(
            [
              { id: "v1", label: "Candidatures", sub: `${applications.length} reçue${applications.length !== 1 ? "s" : ""}` },
              { id: "v2", label: "Entretien",    sub: `${shortlisted.length} présélectionné(s)` },
              { id: "v3", label: "Offre",        sub: offerSent ? "Envoyée ✓" : "Non envoyée" },
              { id: "v4", label: "Contrat",      sub: contractId ? "Actif" : offerSent ? "En attente" : "—" },
            ] as const
          ).map(({ id, label, sub }, i) => {
            const isDone  = i < viewIdx;
            const isActive = id === activeView;
            return (
              <div key={id} className="flex items-center flex-1 last:flex-none">
                {/* Step */}
                <button
                  onClick={() => { if (id !== "v4" || contractId) setActiveView(id as ViewId); }}
                  disabled={id === "v4" && !contractId}
                  className="flex flex-col items-center pb-3.5 px-2 min-w-[90px] focus:outline-none group relative disabled:cursor-not-allowed"
                  style={{ flex: "0 0 auto" }}
                >
                  {/* Dot + number */}
                  <div
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12px] font-bold mb-2 transition-all duration-200"
                    style={{
                      background: isActive ? "#14213D" : isDone ? "#1F7A5C" : "#F0F1F5",
                      color:      isActive ? "#fff"    : isDone ? "#fff"    : "#9CA3AF",
                      border:     isActive ? "2px solid #14213D" : isDone ? "2px solid #1F7A5C" : "2px solid #DADFDD",
                      boxShadow:  isActive ? "0 0 0 4px rgba(20,33,61,0.12)" : "none",
                    }}
                  >
                    {isDone ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}>{i + 1}</span>
                    )}
                  </div>
                  {/* Label */}
                  <span
                    className="text-[13px] font-semibold leading-tight whitespace-nowrap"
                    style={{ color: isActive ? "#14213D" : isDone ? "#1F7A5C" : "#9CA3AF" }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[11px] mt-0.5 whitespace-nowrap"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: isActive ? "#6B7280" : "#B0B7C3" }}
                  >
                    {sub}
                  </span>
                  {/* Active underline */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t"
                      style={{ background: "#14213D" }}
                    />
                  )}
                </button>

                {/* Connector line (not after last) */}
                {i < 3 && (
                  <div
                    className="flex-1 h-[2px] mb-8 mx-1"
                    style={{ background: isDone ? "#1F7A5C" : "#E5E7EB", minWidth: 24 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="p-4 sm:p-6 lg:p-8" style={{ background: "#F5F6F4" }}>

        {/* ════════════════════════════════════════════════════
            VIEW 1 — APPLICATIONS TABLE
        ════════════════════════════════════════════════════ */}
        {activeView === "v1" && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <p
                  className="text-[11px] uppercase tracking-[0.08em] mb-1 font-medium"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
                >
                  Étape 1 — Candidatures
                </p>
                <h2
                  className="text-[26px] font-medium tracking-[-0.01em]"
                  style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
                >
                  Qui a postulé
                </h2>
              </div>
              <span
                className="text-[12px] font-mono px-3 py-1.5 rounded-full"
                style={{ background: "#EAECF3", color: "#4A5178" }}
              >
                {applications.length} candidature{applications.length !== 1 ? "s" : ""}
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="bg-white border border-[#DADFDD] rounded-[12px] p-14 text-center">
                <p className="text-[38px] mb-3">📩</p>
                <p className="text-[15px] font-medium text-[#14213D] mb-1">Aucune candidature pour le moment</p>
                <p className="text-[13px] text-[#6B7280]">Les candidats qui postulent à cette mission apparaîtront ici.</p>
              </div>
            ) : (
              /* overflow-x-auto pour scroll horizontal sur mobile
                 overflow-visible sur le tbody pour que le dropdown ne soit pas coupé */
              <div className="rounded-[12px] border border-[#DADFDD] bg-white overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: "#FAFAF8", borderBottom: "1px solid #DADFDD" }}>
                      {["Candidat", "Profil", "Montant proposé", "Action"].map((h, i) => (
                        <th
                          key={h}
                          className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#6B7280] px-5 py-3"
                          style={{ textAlign: i >= 2 ? "right" : "left", whiteSpace: "nowrap" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app, idx) => {
                      const isConsulted = !["UNREAD", "PENDING"].includes(app.status);
                      const isFinal = ["SHORTLISTED", "ARCHIVED", "REJECTED", "WITHDRAWN", "ACCEPTED"].includes(app.status);
                      const isDropOpen = openDropdown === app.id;

                      return (
                        <tr
                          key={app.id}
                          className="hover:bg-[#FAFAF8] transition-colors"
                          style={{ borderBottom: idx < applications.length - 1 ? "1px solid #DADFDD" : "none" }}
                        >
                          {/* Candidat */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-semibold"
                                style={{ background: "#EAECF3", color: "#4A5178", fontFamily: "var(--font-fraunces, serif)" }}
                              >
                                {initials(app.freelancerName)}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setProfileModal(app)}
                                    className="block font-semibold text-[13.5px] text-[#14213D] hover:text-[#1F7A5C] hover:underline text-left leading-tight"
                                  >
                                    {app.freelancerName}
                                  </button>
                                  {app.kycVerified ? (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-medium px-[7px] py-[2px] rounded-full whitespace-nowrap"
                                      style={{ background: "#E4F1EC", color: "#1F7A5C" }}
                                    >
                                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                      </svg>
                                      KYC vérifié
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-medium px-[7px] py-[2px] rounded-full whitespace-nowrap"
                                      style={{ background: "#FBEDD8", color: "#B8720A" }}
                                    >
                                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                      </svg>
                                      KYC en attente
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-[#6B7280] mt-0.5">
                                  {app.freelancerTitle || "Freelance"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Profil */}
                          <td className="px-5 py-3.5">
                            <Badge status={app.status} />
                          </td>

                          {/* Montant */}
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className="text-[13px] font-medium"
                              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#14213D" }}
                            >
                              {app.proposedBudget ? `${app.proposedBudget.toLocaleString("fr-FR")} €` : "—"}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="px-5 py-3.5" style={{ position: "relative" }}>
                            <div className="flex items-center justify-end gap-2">
                              {!app.kycVerified ? (
                                /* KYC non vérifié — bouton grisé */
                                <button
                                  disabled
                                  title="KYC du candidat non vérifié"
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12.5px] font-semibold text-white opacity-40 cursor-not-allowed whitespace-nowrap"
                                  style={{ background: "#14213D" }}
                                >
                                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Consulter
                                </button>
                              ) : !isConsulted ? (
                                <button
                                  onClick={() => setProfileModal(app)}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12.5px] font-semibold text-white transition-colors whitespace-nowrap"
                                  style={{ background: "#14213D" }}
                                >
                                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  Consulter
                                </button>
                              ) : isFinal ? (
                                <span className="text-[11.5px] text-[#6B7280] italic whitespace-nowrap">Dossier traité</span>
                              ) : (
                                <>
                                  {/* Notification bell — click to re-open profile */}
                                  <button
                                    onClick={() => setProfileModal(app)}
                                    className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 hover:bg-[#D0EBE0] transition-colors cursor-pointer"
                                    style={{ background: "#E4F1EC" }}
                                    title="Rouvrir le profil (notification envoyée)"
                                  >
                                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#1F7A5C" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                  </button>
                                  {/* Dropdown */}
                                  <div style={{ position: "relative" }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setOpenDropdown(isDropOpen ? null : app.id); }}
                                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-semibold border border-[#DADFDD] bg-white text-[#14213D] hover:border-[#14213D] transition-colors whitespace-nowrap"
                                    >
                                      Action
                                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {isDropOpen && (
                                      <div
                                        className="rounded-[10px] border border-[#DADFDD] bg-white shadow-[0_8px_32px_rgba(20,33,61,0.15)]"
                                        style={{
                                          position: "fixed",
                                          zIndex: 9999,
                                          minWidth: 180,
                                          right: "auto",
                                        }}
                                        ref={(el) => {
                                          if (el) {
                                            const btn = el.previousElementSibling as HTMLElement;
                                            if (btn) {
                                              const rect = btn.getBoundingClientRect();
                                              el.style.top = `${rect.bottom + 4}px`;
                                              el.style.left = `${rect.right - 180}px`;
                                            }
                                          }
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        {[
                                          { key: "SHORTLISTED", label: "Présélectionner", color: "#1F7A5C", bg: "#E4F1EC" },
                                          { key: "ARCHIVED",    label: "Archiver",        color: "#6B7280", bg: "#F5F6F4" },
                                          { key: "REJECTED",    label: "Refuser",         color: "#B23A2E", bg: "#F8E7E4" },
                                        ].map(({ key, label, color, bg }) => (
                                          <button
                                            key={key}
                                            onMouseDown={(e) => { e.stopPropagation(); handleStatusChange(app.id, key); setOpenDropdown(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-left transition-colors"
                                            style={{ color }}
                                            onMouseEnter={e => (e.currentTarget.style.background = bg)}
                                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                          >
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                            {label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {shortlisted.length > 0 && (
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setActiveView("v2")}
                  className="inline-flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors"
                  style={{ background: "#1F7A5C" }}
                >
                  Passer aux entretiens ({shortlisted.length}) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            VIEW 2 — INTERVIEW
        ════════════════════════════════════════════════════ */}
        {activeView === "v2" && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <p
              className="text-[11px] uppercase tracking-[0.08em] mb-1.5 font-medium"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
            >
              Étape 2 — Entretien
            </p>
            <h2
              className="text-[22px] sm:text-[28px] font-medium tracking-[-0.01em] mb-1.5"
              style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
            >
              Discuter avec les candidats présélectionnés
            </h2>
            <p className="text-[13px] sm:text-[14.5px] text-[#6B7280] mb-7 max-w-[620px]">
              Seuls les profils présélectionnés apparaissent ici. Ouvrez une discussion pour démarrer l&apos;échange.
            </p>

            {shortlisted.length === 0 ? (
              <div className="bg-white border border-[#DADFDD] rounded-[10px] p-6 sm:p-10 text-center">
                <p className="text-[#6B7280] mb-4">Aucun candidat présélectionné.</p>
                <button
                  onClick={() => setActiveView("v1")}
                  className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white"
                  style={{ background: "#1F7A5C" }}
                >
                  ← Retour aux candidatures
                </button>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-5 items-stretch">
                {/* Candidate list */}
                <div
                  className="w-full lg:w-[260px] flex-shrink-0 flex flex-col overflow-hidden rounded-[10px] border border-[#DADFDD] bg-white max-h-[260px] lg:max-h-none"
                >
                  <div className="px-4 py-3.5 border-b border-[#DADFDD]">
                    <h4 className="text-[12px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold m-0">
                      Présélectionnés ({shortlisted.length})
                    </h4>
                  </div>
                  {shortlisted.map((cand) => {
                    const msgs = getMessages(cand.id);
                    const lastMsg = msgs[msgs.length - 1];
                    const isSelected = cand.id === selectedCandidateId;
                    return (
                      <button
                        key={cand.id}
                        onClick={() => { setSelectedCandidateId(cand.id); setShowVideo(false); }}
                        className="relative flex items-center gap-2.5 px-4 py-3 border-b border-[#DADFDD] last:border-b-0 text-left transition-colors"
                        style={{ background: isSelected ? "#E4F1EC" : undefined }}
                      >
                        {isSelected && (
                          <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: "#1F7A5C" }} />
                        )}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                          style={{ background: "#EAECF3", color: "#4A5178", fontFamily: "var(--font-fraunces, serif)" }}
                        >
                          {initials(cand.freelancerName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#14213D]">{cand.freelancerName}</p>
                          <p className="text-[11.5px] text-[#6B7280] mt-0.5 truncate">
                            {lastMsg?.content || "Aucun message"}
                          </p>
                        </div>
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] flex-shrink-0"
                          style={{ background: isSelected ? "#1F7A5C" : "#E4F1EC", color: isSelected ? "#fff" : "#1F7A5C" }}
                        >
                          💬
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Chat / Video panel */}
                <div className="flex-1 min-w-0">
                  {selectedCandidate && !showVideo && (
                    <div
                      className="flex flex-col border border-[#DADFDD] rounded-[16px] bg-white overflow-hidden shadow-lg w-full"
                      style={{ height: "min(65vh, 460px)", maxWidth: 440 }}
                    >
                      {/* Chat header */}
                      <div className="flex items-center gap-3 px-[18px] py-4 border-b border-[#DADFDD] shrink-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-medium relative shrink-0"
                          style={{ background: "linear-gradient(155deg,#2DA579,#14523B)", color: "#fff", fontFamily: "var(--font-fraunces, serif)" }}
                        >
                          {initials(selectedCandidate.freelancerName)}
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: "#2DA579" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[14.5px] text-[#0D1526]">{selectedCandidate.freelancerName}</p>
                          <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#2DA579" }} />
                            En ligne
                          </p>
                        </div>
                        <div className="flex gap-[6px]">
                          <button onClick={() => call.startCall("audio")} className="w-[34px] h-[34px] rounded-[9px] border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] hover:bg-[#E4F1EC] transition-all" title="Appel audio">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 3.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.66-1.85.991.991 0 01-.56-.9v-3.1A17.6 17.6 0 0012 9z"/></svg>
                          </button>
                          <button onClick={() => call.startCall("video")} className="w-[34px] h-[34px] rounded-[9px] border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] hover:bg-[#E4F1EC] transition-all" title="Appel vidéo">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto px-3 sm:px-[18px] py-[18px] flex flex-col gap-[4px]"
                        style={{ background: "radial-gradient(circle at 90% -10%, rgba(31,122,92,0.05), transparent 40%), #F5F6F4" }}
                        ref={chatBodyRef}
                      >
                        {(() => {
                          const msgs = selectedMessages;
                          if (msgs.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <p className="text-[40px] mb-3">👋</p>
                                  <p className="text-[14px] font-medium text-[#0D1526]">Démarrez la conversation</p>
                                  <p className="mt-1 text-[12px] text-[#6B7280]">Envoyez un message à {selectedCandidate.freelancerName}</p>
                                </div>
                              </div>
                            );
                          }
                          return msgs.map((msg, idx) => {
                            const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                            const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                            return (
                              <div key={msg.id}>
                                {showDate && (
                                  <div className="self-center text-[11px] text-[#6B7280] bg-[#EDEEEC] px-3 py-1 rounded-full my-2 font-mono" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                                    {new Date(msg.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                                  </div>
                                )}
                                <div className={`flex flex-col mb-[10px] ${msg.from === "client" ? "items-end self-end" : "items-start self-start"} max-w-[78%]`}>
                                  {msg.isFile ? (
                                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] rounded-bl-[4px] border border-[#DADFDD] bg-white">
                                      <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[14px]" style={{ background: "#E4F1EC", color: "#1F7A5C" }}>📎</div>
                                      <div>
                                        <p className="text-[12.5px] font-semibold text-[#0D1526]">{msg.fileName}</p>
                                        <p className="text-[11px] text-[#6B7280]">{msg.fileSize}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`px-3 py-2.5 rounded-[14px] text-[13.5px] leading-relaxed ${
                                      msg.from === "client"
                                        ? "bg-[#1F7A5C] text-white rounded-br-[4px]"
                                        : "bg-[#F0F1F5] text-[#0D1526] rounded-bl-[4px]"
                                    }`}>
                                      {msg.content}
                                    </div>
                                  )}
                                  <div className={`flex items-center gap-1 mt-[3px] px-[3px] text-[10.5px] font-mono ${msg.from === "client" ? "justify-end" : "justify-start"}`}
                                    style={{ color: "#6B7280", fontFamily: "'IBM Plex Mono', monospace" }}
                                  >
                                    {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    {msg.from === "client" && <span style={{ color: "#1F7A5C" }}>✓✓</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Input */}
                      <div className="flex items-end gap-2 px-3 sm:px-[14px] py-3 border-t border-[#DADFDD] bg-white shrink-0">
                        <button onClick={sendFileMessage} className="w-[34px] h-[34px] rounded-[9px] border border-[#DADFDD] bg-white flex items-center justify-center text-[15px] text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] hover:bg-[#E4F1EC] transition-all shrink-0" title="Joindre un fichier">📎</button>
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                          placeholder="Écrire un message…"
                          className="flex-1 bg-[#F5F6F4] rounded-[18px] px-[14px] py-2.5 text-[13.5px] text-[#0D1526] outline-none leading-relaxed"
                          style={{ maxHeight: 100 }}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!chatInput.trim()}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] text-white transition-all shrink-0"
                          style={{ background: chatInput.trim() ? "#1F7A5C" : "#DADFDD", color: chatInput.trim() ? "#fff" : "#6B7280" }}
                        >
                          ➤
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Video panel */}
                  {selectedCandidate && showVideo && (
                    <div
                      className="flex flex-col rounded-[10px] overflow-hidden"
                      style={{ height: "min(65vh, 460px)", background: "#0F172A" }}
                    >
                      <div className="flex-1 flex items-center justify-center relative">
                        <span
                          className="absolute top-4 left-4 text-[12.5px] rounded-full px-3 py-1"
                          style={{ background: "rgba(0,0,0,0.3)", color: "#C7CCDE" }}
                        >
                          Appel avec {selectedCandidate.freelancerName} · 00:00
                        </span>
                        <div
                          className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-[32px] font-medium"
                          style={{ background: "#243050", color: "#B7C0E0", fontFamily: "var(--font-fraunces, serif)" }}
                        >
                          {initials(selectedCandidate.freelancerName)}
                        </div>
                        <div
                          className="absolute bottom-4 right-4 w-[100px] h-[74px] rounded-[8px] border flex items-center justify-center text-[11px]"
                          style={{ background: "#1E2A4A", borderColor: "#33406B", color: "#8B93B0" }}
                        >
                          Vous
                        </div>
                      </div>
                      <div className="flex justify-center gap-3.5 p-4">
                        {["🎙️", "📷"].map((ic, i) => (
                          <button
                            key={i}
                            className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] border"
                            style={{ background: "#1E2A4A", borderColor: "#33406B", color: "#EDEFF5" }}
                          >
                            {ic}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowVideo(false)}
                          className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] border"
                          style={{ background: "#B23A2E", borderColor: "#B23A2E", color: "#fff" }}
                        >
                          ⏻
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {shortlisted.length > 0 && (
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setActiveView("v3")}
                  className="inline-flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-[13.5px] font-semibold text-white"
                  style={{ background: "#1F7A5C" }}
                >
                  Créer une offre →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            VIEW 3 — OFFER
        ════════════════════════════════════════════════════ */}
        {activeView === "v3" && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <p
              className="text-[11px] uppercase tracking-[0.08em] mb-1.5 font-medium"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
            >
              Étape 3 — Offre
            </p>
            <h2
              className="text-[28px] font-medium tracking-[-0.01em] mb-1.5"
              style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
            >
              {offerSent
                ? `Offre envoyée${selectedCandidate ? ` à ${selectedCandidate.freelancerName}` : ""}`
                : `Créer l\u2019offre${selectedCandidate ? ` pour ${selectedCandidate.freelancerName}` : ""}`}
            </h2>
            <p className="text-[14.5px] text-[#6B7280] mb-7 max-w-[620px]">
              {offerSent
                ? "L\u2019offre a été envoyée. Le contrat sera créé automatiquement dès que le candidat l\u2019accepte."
                : "Le candidat est sélectionné. Renseignez les termes de la mission, puis détaillez les jalons pour suivre l\u2019avancement."}
            </p>

            {/* Type toggle */}
            <div
              className="flex border border-[#DADFDD] rounded-[8px] overflow-hidden w-fit mb-6"
            >
              {(["FIXED", "HOURLY"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOfferType(t)}
                  className="px-[18px] py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    background: offerType === t ? "#1F7A5C" : "transparent",
                    color: offerType === t ? "#fff" : "#6B7280",
                  }}
                >
                  {t === "FIXED" ? "Prix fixe" : "Taux horaire"}
                </button>
              ))}
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-2 gap-[18px] max-w-[680px] mb-7">
              <div className="col-span-2">
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">
                  Titre de la mission
                </label>
                <input
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3.5 py-2.5 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">
                  Description
                </label>
                <textarea
                  value={offerDesc}
                  onChange={(e) => setOfferDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3.5 py-2.5 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C] resize-none"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">
                  Date de début
                </label>
                <input
                  type="date"
                  value={offerStartDate}
                  onChange={(e) => setOfferStartDate(e.target.value)}
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3.5 py-2.5 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">
                  Durée estimée
                </label>
                <input
                  value={offerDuration}
                  onChange={(e) => setOfferDuration(e.target.value)}
                  placeholder="Ex. 6 semaines"
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3.5 py-2.5 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C]"
                />
              </div>
            </div>

            {/* Milestones */}
            <div className="flex items-center justify-between mb-2.5">
              <h3
                className="text-[13px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold"
              >
                Jalons
              </h3>
              <button
                onClick={() => openMilestoneModal(null)}
                className="px-3.5 py-1.5 text-[12.5px] font-semibold rounded-[8px] text-white"
                style={{ background: "#1F7A5C" }}
              >
                + Ajouter un jalon
              </button>
            </div>

            <table className="w-full border-collapse max-w-[760px] mb-7">
              <thead>
                <tr>
                  {["#", "Description", "Unité", "Prix unitaire", "Prix total", "Taux exécution", "Délai", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] uppercase tracking-[0.04em] text-[#6B7280] px-3 py-2.5 border-b border-[#DADFDD] font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {milestones.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-[13px] text-[#6B7280]">
                      Aucun jalon. Cliquez sur « Ajouter un jalon » pour commencer.
                    </td>
                  </tr>
                ) : (
                  milestones.map((m, i) => (
                    <tr key={i}>
                      <td
                        className="px-3 py-3 border-b border-[#DADFDD] text-[#6B7280] w-6"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", fontSize: 12 }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-3 border-b border-[#DADFDD] text-[13px] max-w-[220px]">{m.desc}</td>
                      <td className="px-3 py-3 border-b border-[#DADFDD] text-[13px]">
                        {m.unit}{m.qty > 1 ? ` × ${m.qty}` : ""}
                      </td>
                      <td
                        className="px-3 py-3 border-b border-[#DADFDD] text-right text-[13px]"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {fmtEuro(m.unitPrice)}
                      </td>
                      <td
                        className="px-3 py-3 border-b border-[#DADFDD] text-right text-[13px]"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                      >
                        {fmtEuro(m.qty * m.unitPrice)}
                      </td>
                      <td className="px-3 py-3 border-b border-[#DADFDD]">
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="h-1.5 rounded-full bg-[#E5E7EB] flex-1" style={{ width: 50 }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, m.executionRate))}%`,
                                background: "#1F7A5C",
                              }}
                            />
                          </div>
                          <span
                            className="text-[11px] font-medium text-[#6B7280]"
                            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                          >
                            {Math.min(100, Math.max(0, m.executionRate))}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 border-b border-[#DADFDD] text-[13px]">{m.delay}</td>
                      <td className="px-3 py-3 border-b border-[#DADFDD]">
                        <div className="flex items-center gap-1 justify-end">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveMilestone(i, -1)}
                              disabled={i === 0}
                              className="w-5 h-3.5 rounded-[3px] border border-[#DADFDD] bg-white flex items-center justify-center text-[9px] text-[#6B7280] disabled:opacity-30"
                            >▲</button>
                            <button
                              onClick={() => moveMilestone(i, 1)}
                              disabled={i === milestones.length - 1}
                              className="w-5 h-3.5 rounded-[3px] border border-[#DADFDD] bg-white flex items-center justify-center text-[9px] text-[#6B7280] disabled:opacity-30"
                            >▼</button>
                          </div>
                          <button
                            onClick={() => openMilestoneModal(i)}
                            className="w-7 h-7 rounded-[6px] border border-[#DADFDD] bg-white flex items-center justify-center text-[12.5px] text-[#6B7280] hover:border-[#1F7A5C] hover:text-[#1F7A5C] transition-colors"
                          >✎</button>
                          <button
                            onClick={() => deleteMilestone(i)}
                            className="w-7 h-7 rounded-[6px] border border-[#DADFDD] bg-white flex items-center justify-center text-[12.5px] text-[#6B7280] hover:border-[#B23A2E] hover:text-[#B23A2E] transition-colors"
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-right text-[13px] font-semibold text-[#6B7280] border-t-2 border-[#14213D]">
                    Montant total du contrat
                  </td>
                  <td
                    className="px-3 py-3 text-right font-bold border-t-2 border-[#14213D]"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", fontSize: 13 }}
                  >
                    {fmtEuro(milestonesTotal)}
                  </td>
                  <td className="px-3 py-3 border-t-2 border-[#14213D]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 rounded-full bg-[#1F7A5C]" style={{ width: `${milestonesRateSum}%` }} />
                      <span
                        className="text-[11px] font-bold"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: milestonesRateSum === 100 ? "#1F7A5C" : "#B23A2E" }}
                      >
                        {milestonesRateSum}%
                      </span>
                    </div>
                  </td>
                  <td colSpan={2} className="border-t-2 border-[#14213D]" />
                </tr>
              </tfoot>
            </table>

            {offerSent ? (
              /* ── Bannière «En attente de réponse» ── */
              <div className="rounded-[12px] border border-[#DADFDD] bg-white p-6 flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[18px]"
                  style={{ background: "#FBEDD8", color: "#B8720A" }}
                >
                  ⏳
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#14213D] mb-1">
                    Offre envoyée — en attente de la réponse du candidat
                  </p>
                  <p className="text-[13px] text-[#6B7280]">
                    {selectedCandidate?.freelancerName ?? "Le candidat"} a reçu l&apos;offre de {fmtEuro(milestonesTotal)}.
                    Le contrat sera créé automatiquement dès son acceptation.
                  </p>
                  <p
                    className="mt-3 text-[11px] font-mono text-[#B8720A]"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    Expire dans 7 jours · {milestones.length} jalon(s)
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {rateError && (
                  <div
                    className="mb-3 px-4 py-3 rounded-[8px] text-[12.5px] flex items-start gap-2.5"
                    style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B23A2E" }}
                  >
                    <span className="text-[15px] mt-0.5">⚠️</span>
                    <div>
                      <p className="font-semibold">Taux d&apos;exécution invalide</p>
                      <p className="mt-0.5 opacity-90">{rateError}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2.5">
                  <button className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold border border-[#DADFDD] bg-white text-[#14213D]">
                    Enregistrer le brouillon
                  </button>
                  <button
                    onClick={sendOffer}
                    disabled={offerSending}
                    className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold text-white transition-colors disabled:opacity-60"
                    style={{ background: "#1F7A5C" }}
                  >
                    {offerSending ? "Envoi…" : "Envoyer l'offre"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            VIEW 4 — CONTRACT
        ════════════════════════════════════════════════════ */}
        {activeView === "v4" && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <p
              className="text-[11px] uppercase tracking-[0.08em] mb-1.5 font-medium"
              style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
            >
              Étape 4 — Contrat
            </p>
            <h2
              className="text-[28px] font-medium tracking-[-0.01em] mb-1.5"
              style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
            >
              {contractId ? "Contrat créé" : "En attente de validation"}
            </h2>
            <p className="text-[14.5px] text-[#6B7280] mb-7 max-w-[620px]">
              {contractId
                ? (selectedCandidate
                    ? `${selectedCandidate.freelancerName} a accepté l’offre.`
                    : "L’offre a été acceptée.")
                    + " L\u2019espace de travail du projet est prêt."
                : "Le candidat doit d’abord accepter l’offre. Le contrat sera généré automatiquement dès son acceptation."}
            </p>

            {contractId ? (
              <>
                {/* Banner — contrat actif */}
                <div
                  className="flex items-center gap-3.5 px-5 py-5 rounded-[10px] text-white mb-6"
                  style={{ background: "#1F7A5C" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[18px] flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.18)" }}
                  >
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] opacity-90">
                      Offre acceptée{selectedCandidate ? ` par ${selectedCandidate.freelancerName}` : ""}
                    </p>
                    <p
                      className="text-[22px] font-medium mt-0.5"
                      style={{ fontFamily: "var(--font-fraunces, serif)" }}
                    >
                      {fmtEuro(milestonesTotal)} · Prix fixe · {milestones.length} jalon(s)
                    </p>
                  </div>
                  <span
                    className="text-[11px] font-mono font-medium px-3 py-1.5 rounded-full"
                    style={{ background: "#1F7A5C", border: "1.5px solid rgba(255,255,255,0.4)", color: "#fff" }}
                  >
                    Contrat actif
                  </span>
                </div>

                {/* Modules grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
                  {[
                    { icon: "📄", title: "Contrat", desc: "Conditions signées, jalons et échéances consultables." },
                    { icon: "💬", title: "Chat projet", desc: "La discussion d'entretien devient le fil de suivi." },
                    { icon: "🗂️", title: "Fichiers", desc: "Espace partagé pour les livrables et documents." },
                    { icon: "💳", title: "Facturation", desc: "Paiements liés aux jalons, déclenchés à validation." },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="bg-white border border-[#DADFDD] rounded-[10px] p-[18px]">
                      <div className="text-[18px] mb-2.5">{icon}</div>
                      <h4 className="text-[13.5px] font-semibold text-[#14213D] mb-1">{title}</h4>
                      <p className="text-[12px] text-[#6B7280] leading-[1.5] m-0">{desc}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href={`/dashboard/client/missions/${missionId}/contract/${contractId}`}
                  className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-[13.5px] font-semibold text-white transition-colors"
                  style={{ background: "#14213D" }}
                >
                  Ouvrir l&apos;espace de travail →
                </Link>
              </>
            ) : (
              /* Pas encore de contrat — attente de la décision du candidat */
              <div className="rounded-[12px] border border-[#DADFDD] bg-white p-8 flex items-start gap-5 max-w-[580px]">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-[22px]"
                  style={{ background: "#FBEDD8", color: "#B8720A" }}
                >
                  ⏳
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#14213D] mb-2">
                    En attente de la décision du candidat
                  </p>
                  <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
                    L&apos;offre a été envoyée
                    {selectedCandidate ? ` à ${selectedCandidate.freelancerName}` : ""}
                    {milestonesTotal > 0 ? ` pour ${fmtEuro(milestonesTotal)}` : ""}.
                    Dès que le candidat l&apos;accepte, le contrat sera automatiquement créé et
                    l&apos;espace de travail sera disponible ici.
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-full"
                    style={{ background: "#FBEDD8", color: "#B8720A", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  >
                    ● Offre en attente · expire dans 7 jours
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── PROFILE MODAL ──────────────────────────────── */}
      {profileModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(20,33,61,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setProfileModal(null); }}
        >
          <div
            className="bg-white rounded-[12px] overflow-y-auto shadow-[0_20px_60px_rgba(20,33,61,0.25)]"
            style={{ width: 600, maxWidth: "92vw", maxHeight: "88vh" }}
          >
            <div className="flex items-center gap-3.5 px-6 py-5 border-b border-[#DADFDD]">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-medium flex-shrink-0"
                style={{ background: "#EAECF3", color: "#4A5178", fontFamily: "var(--font-fraunces, serif)" }}
              >
                {initials(profileModal.freelancerName)}
              </div>
              <div>
                <p
                  className="text-[19px] font-medium"
                  style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
                >
                  {profileModal.freelancerName}
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  {profileModal.proposedBudget ? `${profileModal.proposedBudget} €/j` : ""}
                  {profileModal.freelancerTitle ? ` · ${profileModal.freelancerTitle}` : ""}
                </p>
              </div>
              <button
                onClick={() => setProfileModal(null)}
                className="ml-auto w-[30px] h-[30px] rounded-full border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280] hover:bg-[#F5F6F4] flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-5">
              {profileModal.coverLetter && (
                <div>
                  <h4 className="text-[11.5px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold mb-2.5">
                    Lettre de motivation
                  </h4>
                  <p className="text-[13.5px] leading-[1.6] text-[#14213D]">{profileModal.coverLetter}</p>
                </div>
              )}
              {profileModal.skills && profileModal.skills.length > 0 && (
                <div>
                  <h4 className="text-[11.5px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold mb-2.5">
                    Compétences
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {profileModal.skills.map((s) => (
                      <span key={s} className="bg-[#F0F1F5] rounded-[6px] px-3 py-2 text-[12.5px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {profileModal.reviews && profileModal.reviews.length > 0 && (
                <div>
                  <h4 className="text-[11.5px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold mb-2.5">
                    Avis clients
                  </h4>
                  {profileModal.reviews.map((r, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-[#DADFDD] last:border-b-0 text-[13px]">
                      <span>{r.label}</span>
                      <span style={{ color: "#B8720A" }}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                    </div>
                  ))}
                </div>
              )}
              {profileModal.certifications && profileModal.certifications.length > 0 && (
                <div>
                  <h4 className="text-[11.5px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold mb-2.5">
                    Certifications
                  </h4>
                  {profileModal.certifications.map((c) => (
                    <p key={c} className="text-[13px] py-1">🏅 {c}</p>
                  ))}
                </div>
              )}
              {profileModal.portfolio && profileModal.portfolio.length > 0 && (
                <div>
                  <h4 className="text-[11.5px] uppercase tracking-[0.05em] text-[#6B7280] font-semibold mb-2.5">
                    Portfolio & Documents
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {profileModal.portfolio.map((doc, i) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(doc);
                      const isPdf = /\.pdf$/i.test(doc);
                      return (
                        <a
                          key={i}
                          href={doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-center gap-2 rounded-[10px] border border-[#DADFDD] p-3 hover:border-[#1F7A5C] hover:bg-[#FAFAF8] transition-colors group"
                        >
                          {isImage ? (
                            <div
                              className="w-full h-24 rounded-[6px] bg-cover bg-center"
                              style={{ backgroundImage: `url(${doc})` }}
                            />
                          ) : isPdf ? (
                            <div className="w-full h-24 rounded-[6px] bg-red-50 flex items-center justify-center text-[28px]">
                              📄
                            </div>
                          ) : (
                            <div className="w-full h-24 rounded-[6px] bg-[#F5F6F4] flex items-center justify-center text-[28px]">
                              📎
                            </div>
                          )}
                          <span className="text-[11.5px] font-medium text-[#6B7280] group-hover:text-[#1F7A5C] truncate max-w-full text-center">
                            Document {i + 1}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {(() => {
              const isConsulted = !["UNREAD", "PENDING"].includes(profileModal.status);
              return (
            <div className="flex gap-2.5 px-6 py-4 border-t border-[#DADFDD]">
              <button
                onClick={() => setProfileModal(null)}
                className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold border border-[#DADFDD] bg-white text-[#14213D]"
              >
                Fermer
              </button>
              {isConsulted ? (
                <button
                  onClick={() => {
                    handleStatusChange(profileModal.id, "SHORTLISTED");
                    setProfileModal(null);
                  }}
                  className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold text-white"
                  style={{ background: "#1F7A5C" }}
                >
                  Présélectionner
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleConsulter(profileModal.id);
                    setProfileModal(null);
                  }}
                  className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold text-white"
                  style={{ background: "#14213D" }}
                >
                  ✓ Confirmer la consultation
                </button>
              )}
            </div>
              )})()}
          </div>
        </div>
      )}

      {/* ── MILESTONE MODAL ─────────────────────────────── */}
      {milestoneModal.open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(20,33,61,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setMilestoneModal({ open: false, idx: null }); }}
        >
          <div
            className="bg-white rounded-[12px] shadow-[0_20px_60px_rgba(20,33,61,0.25)]"
            style={{ width: 520, maxWidth: "90vw" }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#DADFDD]">
              <div>
                <p
                  className="text-[19px] font-medium"
                  style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
                >
                  {milestoneModal.idx !== null ? "Modifier le jalon" : "Ajouter un jalon"}
                </p>
                <p className="text-[12.5px] text-[#6B7280]">Décrivez le livrable, son prix et son délai</p>
              </div>
              <button
                onClick={() => setMilestoneModal({ open: false, idx: null })}
                className="w-[30px] h-[30px] rounded-full border border-[#DADFDD] bg-white flex items-center justify-center text-[#6B7280]"
              >
                ✕
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">Description</label>
                <input
                  value={mDesc}
                  onChange={(e) => setMDesc(e.target.value)}
                  placeholder="Ex. Intégration Stripe"
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1F7A5C]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">Unité</label>
                <select
                  value={mUnit}
                  onChange={(e) => setMUnit(e.target.value)}
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1F7A5C]"
                >
                  {["Forfait", "Jour", "Semaine", "Heure"].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">Quantité</label>
                <input
                  type="number"
                  min={1}
                  value={mQty}
                  onChange={(e) => setMQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1F7A5C]"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">Prix unitaire (€)</label>
                <input
                  type="number"
                  min={0}
                  value={mUnitPrice}
                  onChange={(e) => { setMUnitPrice(parseFloat(e.target.value) || ""); setMPriceError(false); }}
                  placeholder="Ex. 1500"
                  className={`w-full bg-white border rounded-[8px] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1F7A5C] ${mPriceError ? "border-[#B23A2E]" : "border-[#DADFDD]"}`}
                />
                {mPriceError && <p className="text-[11.5px] text-[#B23A2E] mt-1.5">Le prix unitaire doit être supérieur à 0.</p>}
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">Prix total (€)</label>
                <input
                  readOnly
                  value={fmtEuro((typeof mUnitPrice === "number" ? mUnitPrice : 0) * mQty)}
                  className="w-full bg-[#F5F6F4] border border-[#DADFDD] rounded-[8px] px-3 py-2.5 text-[13.5px] text-[#6B7280]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">Délai d&apos;exécution</label>
                <input
                  value={mDelay}
                  onChange={(e) => setMDelay(e.target.value)}
                  placeholder="Ex. 2 semaines"
                  className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3 py-2.5 text-[13.5px] outline-none focus:border-[#1F7A5C]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">
                  Pourcentage alloué à ce jalon
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={mExecutionRate}
                    onChange={(e) => setMExecutionRate(parseInt(e.target.value))}
                    className="flex-1 accent-[#1F7A5C]"
                    style={{ height: 6, cursor: "pointer" }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={mExecutionRate}
                    onChange={(e) => setMExecutionRate(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-16 bg-white border border-[#DADFDD] rounded-[8px] px-2 py-2 text-[13.5px] text-center outline-none focus:border-[#1F7A5C]"
                    style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
                  />
                  <span className="text-[13px] text-[#6B7280] font-medium">%</span>
                </div>
                {/* Barre de répartition globale */}
                {(() => {
                  const otherSum = milestoneModal.idx !== null
                    ? milestonesRateSum - (milestones[milestoneModal.idx]?.executionRate ?? 0)
                    : milestonesRateSum;
                  const totalAfterSave = otherSum + mExecutionRate;
                  const isBalanced = totalAfterSave === 100;
                  return (
                    <div className="mt-2.5">
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#E5E7EB]">
                        <div
                          className="h-full transition-all duration-200"
                          style={{ width: `${(mExecutionRate / 100) * 100}%`, background: "#1F7A5C" }}
                          title={`Ce jalon : ${mExecutionRate}%`}
                        />
                        <div
                          className="h-full transition-all duration-200"
                          style={{
                            width: `${(otherSum / 100) * 100}%`,
                            background: isBalanced ? "#D1D5DB" : "#FCA5A5",
                          }}
                          title={`Autres jalons : ${otherSum}%`}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-[#6B7280] mt-1">
                        <span>Ce jalon : <strong>{mExecutionRate}%</strong></span>
                        <span>Autres jalons : <strong>{otherSum}%</strong></span>
                        <span style={{ color: isBalanced ? "#1F7A5C" : "#B23A2E" }}>
                          Total : <strong>{totalAfterSave}%</strong>
                          {isBalanced ? " ✅" : " ⚠️"}
                        </span>
                      </div>
                      {!isBalanced && (
                        <p className="text-[11.5px] text-[#B23A2E] mt-1">
                          ⚠️ Le total doit être de 100% pour envoyer l&apos;offre ({totalAfterSave}% actuellement).
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex gap-2.5 px-6 py-4 border-t border-[#DADFDD]">
              <button
                onClick={() => setMilestoneModal({ open: false, idx: null })}
                className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold border border-[#DADFDD] bg-white text-[#14213D]"
              >
                Annuler
              </button>
              <button
                onClick={saveMilestone}
                className="px-5 py-2.5 rounded-[8px] text-[13.5px] font-semibold text-white"
                style={{ background: "#1F7A5C" }}
              >
                Enregistrer le jalon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
