"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────

interface OfferMilestone {
  title?: string;
  desc?: string;
  unit?: string;
  qty?: number;
  amount?: number;
  unitPrice?: number;
  delay?: string;
  dueDate?: string;
  status?: string;
}

interface Offer {
  id?: string;
  title?: string;
  description?: string;
  offerType?: "FIXED" | "HOURLY";
  totalBudget?: number;
  hourlyRate?: number;
  startDate?: string;
  endDate?: string;
  milestones?: OfferMilestone[];
  /** Date d'expiration ISO (7 jours après l'envoi) */
  expiresAt?: string;
  /** Date d'envoi ISO */
  sentAt?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  from: "client" | "freelancer";
  isFile?: boolean;
  fileName?: string;
  fileSize?: string;
}

export interface ApplicationViewProps {
  applicationId: string;
  missionId: string;
  missionTitle: string;
  clientName: string;
  proposedBudget: number;
  status: string;
  coverLetter?: string;
  createdAt: string;
  offer?: Offer | null;
  contractId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { label: "Candidature", statuses: ["UNREAD","READ","PENDING"] },
  { label: "Présélection", statuses: ["SHORTLISTED"] },
  { label: "Entretien", statuses: ["DISCUSSION","INTERVIEW","INTERVIEW_PENDING","INTERVIEW_COMPLETED"] },
  { label: "Offre", statuses: ["OFFER_SENT","OFFER_ACCEPTED"] },
  { label: "Contrat", statuses: ["ACCEPTED","SELECTED"] },
];

function getStageIndex(status: string) {
  const idx = PIPELINE_STAGES.findIndex((s) => s.statuses.includes(status));
  return idx === -1 ? 0 : idx;
}

function fmtEuro(n?: number) {
  if (!n) return "—";
  return n.toLocaleString("fr-FR") + " €";
}

function fmtDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────

export function FreelancerApplicationView({
  applicationId,
  missionId,
  missionTitle,
  clientName,
  proposedBudget,
  status,
  coverLetter,
  createdAt,
  offer,
  contractId,
}: ApplicationViewProps) {
  const currentStage = getStageIndex(status);
  const isNegative = ["REJECTED", "WITHDRAWN", "ARCHIVED"].includes(status);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "i1", content: "Bonjour ! Merci pour votre candidature. Seriez-vous disponible pour un échange cette semaine ?", from: "client" },
    { id: "i2", content: "Oui, bien sûr ! Je suis disponible jeudi ou vendredi.", from: "freelancer" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const [offerAction, setOfferAction] = useState<"idle" | "accepting" | "declining" | "done">("idle");
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [acceptResult, setAcceptResult] = useState<{ contractId?: string } | null>(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, content: chatInput.trim(), from: "freelancer" },
    ]);
    setChatInput("");
  };

  const handleAcceptOffer = async () => {
    setOfferAction("accepting");
    try {
      // Appeler le PATCH /api/offers/[id]?action=accept — crée le contrat automatiquement
      const endpoint = offer?.id
        ? `/api/offers/${offer.id}?action=accept`
        : `/api/applications/${applicationId}`;
      const method = offer?.id ? "PATCH" : "PUT";
      const body = offer?.id ? {} : { status: "OFFER_ACCEPTED" };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Échec acceptation");

      // Récupérer le contractId depuis la réponse (OfferService.acceptOffer retourne {contract, application})
      const data = await res.json();
      if (data?.contract?.id) {
        setAcceptResult({ contractId: data.contract.id });
      }
      setOfferAction("done");
    } catch {
      setOfferAction("idle");
    }
  };

  const handleDeclineOffer = async () => {
    if (!declineReason.trim()) return;
    setOfferAction("declining");
    try {
      // Appeler le PATCH /api/offers/[id]?action=decline
      const endpoint = offer?.id
        ? `/api/offers/${offer.id}?action=decline`
        : `/api/applications/${applicationId}`;
      const body = offer?.id
        ? { reason: declineReason }
        : { status: "OFFER_DECLINED", declineReason };

      const res = await fetch(endpoint, {
        method: offer?.id ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Échec refus");
      setOfferAction("done");
    } catch {
      setOfferAction("idle");
    }
  };

  const showChat = ["DISCUSSION", "INTERVIEW", "INTERVIEW_PENDING", "INTERVIEW_COMPLETED"].includes(status) ||
    status === "OFFER_SENT";
  const showOffer = (status === "OFFER_SENT" || status === "OFFER_ACCEPTED") && offer;
  const isOfferAccepted = status === "OFFER_ACCEPTED" || offerAction === "done";

  return (
    <div style={{ fontFamily: "var(--font-space-grotesk, Inter, sans-serif)" }}>

      {/* ── Back link ─────────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href="/dashboard/freelancer/candidatures"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-[#1F7A5C] transition-colors"
        >
          ← Mes candidatures
        </Link>
      </div>

      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className="rounded-[12px] border bg-white overflow-hidden mb-6"
        style={{ borderColor: "#DADFDD" }}
      >
        {/* Top banner */}
        <div className="px-6 py-5 border-b" style={{ borderColor: "#DADFDD" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.08em] font-medium mb-1"
                style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
              >
                Candidature · {fmtDate(createdAt)}
              </p>
              <h1
                className="text-[22px] font-medium tracking-[-0.01em]"
                style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
              >
                {missionTitle}
              </h1>
              <p className="text-[13.5px] text-[#6B7280] mt-1">Client : {clientName}</p>
            </div>
            {proposedBudget > 0 && (
              <div className="text-right">
                <p
                  className="text-[20px] font-bold"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#14213D" }}
                >
                  {proposedBudget.toLocaleString()} €
                </p>
                <p className="text-[12px] text-[#6B7280]">Budget proposé</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline progress */}
        {!isNegative ? (
          <div className="px-6 py-5">
            <div className="flex items-center">
              {PIPELINE_STAGES.map((stage, i) => {
                const done = i < currentStage;
                const active = i === currentStage;
                return (
                  <div key={stage.label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center" style={{ minWidth: 60 }}>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                        style={{
                          background: done || active ? "#1F7A5C" : "#EAECF3",
                          color: done || active ? "#fff" : "#9CA3AF",
                          border: active ? "2px solid #B7E4D4" : "2px solid transparent",
                          boxShadow: active ? "0 0 0 4px rgba(31,122,92,0.2)" : "none",
                        }}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      <span
                        className="text-[10.5px] mt-1.5 text-center leading-tight"
                        style={{ color: done || active ? "#1F7A5C" : "#9CA3AF", fontWeight: active ? 600 : 400 }}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div
                        className="flex-1 h-[2px] mb-4 mx-1"
                        style={{ background: done ? "#1F7A5C" : "#DADFDD" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 flex items-center gap-2">
            <span
              className="text-[11px] font-mono font-medium px-3 py-1.5 rounded-full"
              style={{ background: "#F8E7E4", color: "#B23A2E" }}
            >
              {status === "REJECTED" ? "Candidature refusée" : status === "WITHDRAWN" ? "Retirée" : "Archivée"}
            </span>
            <p className="text-[13px] text-[#6B7280]">
              {status === "REJECTED" ? "Le client n'a pas retenu votre profil pour cette mission." : ""}
            </p>
          </div>
        )}
      </div>

      {/* ── Offer accepted banner ─────────────────────────────── */}
      {isOfferAccepted && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-[10px] mb-6 text-white"
          style={{ background: "#1F7A5C" }}
        >
          <span className="text-[22px]">✓</span>
          <div className="flex-1">
            <p className="font-semibold text-[14px]">Offre acceptée — Contrat créé</p>
            <p className="text-[12px] opacity-90 mt-0.5">Le client sera notifié. Votre espace de travail est prêt.</p>
          </div>
          {(acceptResult?.contractId || contractId) && (
            <Link
              href={`/dashboard/freelancer/contrat/${acceptResult?.contractId || contractId}`}
              className="px-4 py-2 rounded-[8px] text-[13px] font-semibold bg-white hover:bg-white/90 transition-colors"
              style={{ color: "#1F7A5C" }}
            >
              Ouvrir le contrat
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Offer details or cover letter ────────────── */}
        <div>
          {showOffer ? (
            <div className="bg-white border border-[#DADFDD] rounded-[12px] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#DADFDD]">
                <p
                  className="text-[11px] uppercase tracking-[0.08em] font-medium"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
                >
                  Offre reçue
                </p>
                <h2
                  className="text-[18px] font-medium mt-0.5"
                  style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
                >
                  {offer?.title ?? missionTitle}
                </h2>
                {/* ── Expiration ─────────────────────────── */}
                {offer?.expiresAt && (() => {
                  const now = new Date();
                  const exp = new Date(offer.expiresAt);
                  const diffMs = exp.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  const expired = diffDays <= 0;
                  return (
                    <p className={`text-[12px] mt-1.5 flex items-center gap-1.5 ${expired ? "text-[#B23A2E]" : "text-[#B8720A]"}`}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: expired ? "#B23A2E" : "#B8720A" }} />
                      {expired
                        ? "Offre expirée"
                        : diffDays === 1
                          ? "Expire demain"
                          : `Expire dans ${diffDays} jours`}
                    </p>
                  );
                })()}
              </div>
              <div className="p-5 space-y-4">
                {offer?.description && (
                  <p className="text-[13.5px] text-[#6B7280] leading-[1.6]">{offer.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Type", value: offer?.offerType === "HOURLY" ? "Taux horaire" : "Prix fixe" },
                    { label: "Montant total", value: offer?.totalBudget ? fmtEuro(offer.totalBudget) : offer?.hourlyRate ? `${offer.hourlyRate} €/h` : "—" },
                    { label: "Début", value: fmtDate(offer?.startDate) },
                    { label: "Fin estimée", value: fmtDate(offer?.endDate) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-[8px] p-3" style={{ background: "#F5F6F4" }}>
                      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.04em] mb-1">{label}</p>
                      <p
                        className="text-[13.5px] font-medium"
                        style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#14213D" }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Milestones */}
                {offer?.milestones && offer.milestones.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280] mb-2">
                      Jalons ({offer.milestones.length})
                    </p>
                    <div className="space-y-2">
                      {offer.milestones.map((m, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] border border-[#DADFDD] bg-white"
                        >
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                            style={{ background: "#1F7A5C" }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate">{m.title ?? m.desc}</p>
                            {m.dueDate && (
                              <p className="text-[11px] text-[#6B7280]">Échéance : {fmtDate(m.dueDate)}</p>
                            )}
                          </div>
                          <span
                            className="text-[12.5px] font-medium flex-shrink-0"
                            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#14213D" }}
                          >
                            {fmtEuro(m.amount ?? m.unitPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accept / Decline actions */}
                {status === "OFFER_SENT" && offerAction !== "done" && (
                  <div className="pt-2">
                    {!showDeclineForm ? (
                      <div className="flex gap-2.5">
                        <button
                          onClick={handleAcceptOffer}
                          disabled={offerAction === "accepting"}
                          className="flex-1 py-2.5 rounded-[8px] text-[13.5px] font-semibold text-white transition-colors disabled:opacity-60"
                          style={{ background: "#1F7A5C" }}
                        >
                          {offerAction === "accepting" ? "Acceptation…" : "✓ Accepter l'offre"}
                        </button>
                        <button
                          onClick={() => setShowDeclineForm(true)}
                          className="flex-1 py-2.5 rounded-[8px] text-[13.5px] font-semibold border border-[#DADFDD] bg-white text-[#14213D] hover:border-[#B23A2E] hover:text-[#B23A2E] transition-colors"
                        >
                          Refuser
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[12.5px] font-semibold text-[#6B7280] mb-1.5">
                            Motif du refus (optionnel)
                          </label>
                          <textarea
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            rows={3}
                            placeholder="Expliquez brièvement pourquoi vous refusez cette offre…"
                            className="w-full bg-white border border-[#DADFDD] rounded-[8px] px-3 py-2.5 text-[13px] outline-none resize-none"
                            style={{ borderColor: "#DADFDD" }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDeclineOffer}
                            disabled={offerAction === "declining"}
                            className="flex-1 py-2.5 rounded-[8px] text-[13.5px] font-semibold text-white disabled:opacity-60"
                            style={{ background: "#B23A2E" }}
                          >
                            {offerAction === "declining" ? "Envoi…" : "Confirmer le refus"}
                          </button>
                          <button
                            onClick={() => setShowDeclineForm(false)}
                            className="px-4 py-2.5 rounded-[8px] text-[13.5px] font-semibold border border-[#DADFDD] bg-white text-[#14213D]"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#DADFDD] rounded-[12px] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#DADFDD]">
                <p
                  className="text-[11px] uppercase tracking-[0.08em] font-medium"
                  style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
                >
                  Votre candidature
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6B7280] mb-2">Lettre de motivation</p>
                  <p className="text-[13.5px] text-[#14213D] leading-[1.6]">
                    {coverLetter || <span className="text-[#6B7280] italic">Aucune lettre de motivation</span>}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[8px] p-3" style={{ background: "#F5F6F4" }}>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.04em] mb-1">Budget proposé</p>
                    <p
                      className="text-[14px] font-bold"
                      style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#14213D" }}
                    >
                      {proposedBudget ? `${proposedBudget.toLocaleString()} €` : "—"}
                    </p>
                  </div>
                  <div className="rounded-[8px] p-3" style={{ background: "#F5F6F4" }}>
                    <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.04em] mb-1">Envoyée le</p>
                    <p className="text-[13.5px] font-medium" style={{ color: "#14213D" }}>
                      {fmtDate(createdAt)}
                    </p>
                  </div>
                </div>
                <div className="rounded-[8px] p-3 border border-[#DADFDD]">
                  <p className="text-[12.5px] text-[#6B7280]">
                    💡 <strong>En attente</strong> — Le client examine votre profil. Vous serez notifié(e) dès qu&apos;il passera à l&apos;étape suivante.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Chat ────────────────────────────────────── */}
        {showChat && (
          <div
            className="flex flex-col border border-[#DADFDD] rounded-[12px] bg-white overflow-hidden"
            style={{ height: 480 }}
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DADFDD]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                style={{ background: "#EAECF3", color: "#4A5178", fontFamily: "var(--font-fraunces, serif)" }}
              >
                {clientName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[14px]" style={{ color: "#14213D" }}>{clientName}</p>
                <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#1F7A5C" }} />
                  En ligne
                </p>
              </div>
              <p
                className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: "#FBEDD8", color: "#B8720A", fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
              >
                {status === "OFFER_SENT" ? "Offre reçue" : "Entretien en cours"}
              </p>
            </div>

            {/* Messages */}
            <div
              ref={chatBodyRef}
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[70%] px-3 py-2 rounded-[12px] text-[13.5px] leading-[1.5] ${
                    msg.from === "freelancer"
                      ? "self-end rounded-br-[3px] text-white"
                      : "self-start rounded-bl-[3px]"
                  }`}
                  style={{
                    background: msg.from === "freelancer" ? "#1F7A5C" : "#F0F1F5",
                  }}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3.5 py-3 border-t border-[#DADFDD]">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Écrire un message…"
                className="flex-1 bg-[#F5F6F4] rounded-[8px] px-3.5 py-2.5 text-[13px] text-[#6B7280] outline-none"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 rounded-[8px] text-[13.5px] font-semibold text-white"
                style={{ background: "#1F7A5C" }}
              >
                Envoyer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
