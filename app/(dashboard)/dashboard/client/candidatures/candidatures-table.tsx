"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientApplication } from "./page";

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SUBMITTED:      { label: "En attente",       color: "bg-amber-100 text-amber-700" },
  PENDING:        { label: "En attente",       color: "bg-amber-100 text-amber-700" },
  UNREAD:         { label: "Non lue",          color: "bg-amber-100 text-amber-700" },
  READ:           { label: "Lue",              color: "bg-slate-100 text-slate-600" },
  IDENTITY_PENDING:{ label: "KYC en attente",  color: "bg-purple-100 text-purple-700" },
  SHORTLISTED:    { label: "Présélectionnée",  color: "bg-cyan-100 text-cyan-700" },
  DISCUSSION:     { label: "En discussion",    color: "bg-blue-100 text-blue-700" },
  INTERVIEW:      { label: "Entretien",        color: "bg-indigo-100 text-indigo-700" },
  OFFER_SENT:     { label: "Offre envoyée",    color: "bg-orange-100 text-orange-700" },
  OFFER_ACCEPTED: { label: "Offre acceptée",   color: "bg-green-100 text-green-700" },
  OFFER_DECLINED: { label: "Offre refusée",    color: "bg-red-100 text-red-700" },
  ARCHIVED:       { label: "Archivée",         color: "bg-gray-100 text-gray-500" },
  REJECTED:       { label: "Refusée",          color: "bg-red-100 text-red-600" },
  WITHDRAWN:      { label: "Retirée",          color: "bg-gray-100 text-gray-400" },
  ACCEPTED:       { label: "Acceptée",         color: "bg-green-100 text-green-700" },
  UNDER_REVIEW:   { label: "En révision",      color: "bg-blue-100 text-blue-600" },
};

const KYC_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  "VALIDÉ":    { label: "KYC Validé",    color: "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]",  icon: "✅" },
  "EN_ATTENTE":{ label: "KYC En attente",color: "bg-[#FEF9E7] text-[#B7950B] border-[#F9E79F]", icon: "⏳" },
  "REJETÉ":    { label: "KYC Rejeté",   color: "bg-[#FDEDEC] text-[#C0392B] border-[#F5B7B1]",  icon: "❌" },
  "AUCUN":     { label: "Sans KYC",     color: "bg-[#FAFAF8] text-[#5A5750] border-[#E2E0D9]",  icon: "—" },
};

const REJECTION_REASONS = [
  "Budget trop élevé",
  "Compétences insuffisantes",
  "Disponibilité incompatible",
  "Expérience insuffisante",
  "Profil ne correspond pas",
  "Poste pourvu",
  "Autre",
] as const;

const INTERVIEW_FORMATS = [
  { value: "CHAT",       label: "💬 Chat texte",    desc: "Échange écrit" },
  { value: "VIDEO_CALL", label: "📹 Vidéo",         desc: "Appel vidéo" },
  { value: "PHONE",      label: "📞 Téléphone",     desc: "Appel vocal" },
  { value: "MEETING",    label: "🤝 En présentiel", desc: "Réunion physique" },
] as const;

const PIPELINE_STEPS = [
  { key: "SUBMITTED", label: "Reçue" },
  { key: "READ",      label: "Lue" },
  { key: "SHORTLISTED", label: "Présélection" },
  { key: "DISCUSSION",  label: "Discussion" },
  { key: "INTERVIEW",   label: "Entretien" },
  { key: "OFFER_SENT",  label: "Offre" },
  { key: "OFFER_ACCEPTED", label: "Acceptée" },
];
const PIPELINE_INDEX: Record<string, number> = Object.fromEntries(
  PIPELINE_STEPS.map((s, i) => [s.key, i])
);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MilestoneInput { title: string; amount: string; dueDate: string; description: string }

interface InterviewFormData {
  scheduledAt: string;
  format: string;
  duration: string;
  notes: string;
}

interface OfferFormData {
  title: string;
  description: string;
  offerType: "FIXED" | "HOURLY";
  totalBudget: string;
  hourlyRate: string;
  weeklyHourLimit: string;
  startDate: string;
  endDate: string;
  milestones: MilestoneInput[];
}

type SortKey = "date_desc" | "date_asc" | "budget_desc" | "budget_asc";

type ModalState =
  | { type: "reject"; app: ClientApplication }
  | { type: "archive"; app: ClientApplication }
  | { type: "interview"; app: ClientApplication }
  | { type: "offer"; app: ClientApplication }
  | { type: "accept_offer"; app: ClientApplication }
  | { type: "decline_offer"; app: ClientApplication }
  | null;

// ─── Overlay ───────────────────────────────────────────────────────────────────

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(26,25,22,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

// ─── Modal Refus ───────────────────────────────────────────────────────────────

function RejectModal({
  app, onConfirm, onClose, loading,
}: { app: ClientApplication; onConfirm: (r: string) => void; onClose: () => void; loading: boolean }) {
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0]);
  const [custom, setCustom] = useState("");
  const finalReason = reason === "Autre" ? (custom.trim() || "Autre") : reason;
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-red-700">❌ Refuser la candidature</h2>
          <button onClick={onClose} className="text-red-400 hover:text-red-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#5A5750]">
            Refus de <span className="font-semibold text-[#1A1916]">{app.freelancerName}</span> pour{" "}
            <span className="font-semibold text-[#1A1916]">«{app.missionTitle}»</span>.
          </p>
          <div>
            <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-2">RAISON DU REFUS</label>
            <div className="space-y-2">
              {REJECTION_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-red-600" />
                  <span className="text-sm text-[#1A1916]">{r}</span>
                </label>
              ))}
            </div>
            {reason === "Autre" && (
              <textarea
                className="mt-2 w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                rows={2} placeholder="Précisez…" value={custom} onChange={(e) => setCustom(e.target.value)}
              />
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm font-medium text-[#5A5750] hover:bg-[#FAFAF8]">Annuler</button>
            <button onClick={() => onConfirm(finalReason)} disabled={loading} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {loading ? "Traitement…" : "Confirmer le refus"}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Modal Confirmation générique ─────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmClass, onConfirm, onClose, loading,
}: { title: string; message: string; confirmLabel: string; confirmClass: string; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="px-6 pt-6 pb-3">
          <h2 className="text-sm font-bold text-[#1A1916]">{title}</h2>
          <p className="mt-2 text-sm text-[#5A5750]">{message}</p>
        </div>
        <div className="flex gap-3 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm font-medium text-[#5A5750] hover:bg-[#FAFAF8]">Annuler</button>
          <button onClick={onConfirm} disabled={loading} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${confirmClass}`}>
            {loading ? "Traitement…" : confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Modal Entretien ───────────────────────────────────────────────────────────

function InterviewModal({
  app, onConfirm, onClose, loading,
}: { app: ClientApplication; onConfirm: (d: InterviewFormData) => void; onClose: () => void; loading: boolean }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [form, setForm] = useState<InterviewFormData>({
    scheduledAt: tomorrow.toISOString().slice(0, 16),
    format: "VIDEO_CALL",
    duration: "60",
    notes: "",
  });
  const set = (f: keyof InterviewFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-4 flex items-center justify-between sticky top-0">
          <h2 className="text-sm font-bold text-indigo-700">📹 Planifier un entretien</h2>
          <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 text-xs text-indigo-600">
            <span className="font-bold">{app.freelancerName}</span> — <span className="font-bold">«{app.missionTitle}»</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-2">FORMAT</label>
            <div className="grid grid-cols-2 gap-2">
              {INTERVIEW_FORMATS.map((f) => (
                <label key={f.value} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer ${form.format === f.value ? "border-indigo-400 bg-indigo-50" : "border-[#E2E0D9] bg-white hover:bg-[#FAFAF8]"}`}>
                  <input type="radio" name="format" value={f.value} checked={form.format === f.value} onChange={set("format")} className="accent-indigo-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[#1A1916] leading-none">{f.label}</p>
                    <p className="text-[10px] text-[#9C9A95] mt-0.5">{f.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">DATE & HEURE</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={set("scheduledAt")} className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">DURÉE</label>
              <select value={form.duration} onChange={set("duration")} className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">NOTES / QUESTIONS</label>
            <textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Questions, points à aborder, lien de réunion…" className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm font-medium text-[#5A5750] hover:bg-[#FAFAF8]">Annuler</button>
            <button onClick={() => onConfirm(form)} disabled={loading || !form.scheduledAt} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Planification…" : "Planifier l'entretien"}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Modal Offre ───────────────────────────────────────────────────────────────

function OfferModal({
  app, onConfirm, onClose, loading,
}: { app: ClientApplication; onConfirm: (d: OfferFormData) => void; onClose: () => void; loading: boolean }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<OfferFormData>({
    title: `Offre pour ${app.missionTitle}`,
    description: "",
    offerType: "FIXED",
    totalBudget: app.proposedBudget > 0 ? String(app.proposedBudget) : String(app.missionBudget || ""),
    hourlyRate: String(app.freelancerRate || ""),
    weeklyHourLimit: "40",
    startDate: today,
    endDate: "",
    milestones: [],
  });
  const set = (f: keyof Omit<OfferFormData, "milestones">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [f]: e.target.value }));
  const addMilestone = () => {
    if (form.milestones.length >= 5) return;
    setForm((f) => ({ ...f, milestones: [...f.milestones, { title: "", amount: "", dueDate: "", description: "" }] }));
  };
  const removeMilestone = (i: number) => setForm((f) => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }));
  const updateMilestone = (i: number, field: keyof MilestoneInput, value: string) =>
    setForm((f) => ({ ...f, milestones: f.milestones.map((m, idx) => idx === i ? { ...m, [field]: value } : m) }));
  const isValid = form.title.trim() && form.startDate &&
    (form.offerType === "FIXED" ? Number(form.totalBudget) > 0 : Number(form.hourlyRate) > 0);

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="bg-orange-50 border-b border-orange-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-orange-700">📨 Envoyer une offre</h2>
          <button onClick={onClose} className="text-orange-400 hover:text-orange-600 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div className="rounded-lg bg-orange-50 border border-orange-100 px-4 py-2.5 text-xs text-orange-600">
            Pour <span className="font-bold">{app.freelancerName}</span> — <span className="font-bold">«{app.missionTitle}»</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">TITRE DE L'OFFRE *</label>
            <input type="text" value={form.title} onChange={set("title")} placeholder="Ex: Offre développeur React" className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-2">TYPE DE RÉMUNÉRATION *</label>
            <div className="flex gap-3">
              {(["FIXED", "HOURLY"] as const).map((t) => (
                <label key={t} className={`flex-1 flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer ${form.offerType === t ? "border-orange-400 bg-orange-50" : "border-[#E2E0D9] bg-white hover:bg-[#FAFAF8]"}`}>
                  <input type="radio" name="offerType" value={t} checked={form.offerType === t} onChange={() => setForm((f) => ({ ...f, offerType: t }))} className="accent-orange-600" />
                  <div>
                    <p className="text-sm font-semibold text-[#1A1916]">{t === "FIXED" ? "🎯 Montant fixe" : "⏱️ Taux horaire"}</p>
                    <p className="text-[10px] text-[#9C9A95]">{t === "FIXED" ? "Budget total défini" : "Facturation à l'heure"}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {form.offerType === "FIXED" ? (
            <div>
              <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">BUDGET TOTAL ({app.missionCurrency}) *</label>
              <input type="number" min="0" step="1000" value={form.totalBudget} onChange={set("totalBudget")} placeholder="Ex: 500000" className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">TAUX HORAIRE ({app.missionCurrency}/h) *</label>
                <input type="number" min="0" value={form.hourlyRate} onChange={set("hourlyRate")} placeholder="Ex: 5000" className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">HEURES MAX / SEMAINE</label>
                <input type="number" min="1" max="80" value={form.weeklyHourLimit} onChange={set("weeklyHourLimit")} className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">DATE DE DÉBUT *</label>
              <input type="date" value={form.startDate} onChange={set("startDate")} min={today} className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">DATE DE FIN (optionnel)</label>
              <input type="date" value={form.endDate} onChange={set("endDate")} min={form.startDate || today} className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wide text-[#5A5750] mb-1.5">DESCRIPTION / CONDITIONS</label>
            <textarea value={form.description} onChange={set("description")} rows={3} placeholder="Livrables, conditions, détails…" className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          {form.offerType === "FIXED" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold tracking-wide text-[#5A5750]">JALONS DE PAIEMENT (optionnel)</label>
                {form.milestones.length < 5 && (
                  <button onClick={addMilestone} className="text-xs font-medium text-[#2D5BE3] hover:underline">+ Ajouter un jalon</button>
                )}
              </div>
              {form.milestones.length === 0 && <p className="text-xs text-[#9C9A95] italic">Aucun jalon — paiement en une fois.</p>}
              <div className="space-y-3">
                {form.milestones.map((m, i) => (
                  <div key={i} className="rounded-lg border border-[#E2E0D9] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#5A5750]">JALON {i + 1}</span>
                      <button onClick={() => removeMilestone(i)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                    </div>
                    <input type="text" value={m.title} onChange={(e) => updateMilestone(i, "title", e.target.value)} placeholder="Titre *" className="w-full rounded border border-[#E2E0D9] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={m.amount} onChange={(e) => updateMilestone(i, "amount", e.target.value)} placeholder={`Montant (${app.missionCurrency}) *`} className="rounded border border-[#E2E0D9] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300" />
                      <input type="date" value={m.dueDate} min={form.startDate || today} onChange={(e) => updateMilestone(i, "dueDate", e.target.value)} className="rounded border border-[#E2E0D9] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-[#E2E0D9] shrink-0">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E0D9] bg-white px-4 py-2.5 text-sm font-medium text-[#5A5750] hover:bg-[#FAFAF8]">Annuler</button>
          <button onClick={() => onConfirm(form)} disabled={loading || !isValid} className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">
            {loading ? "Envoi en cours…" : "📨 Envoyer l'offre"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium ${type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
        <span>{type === "success" ? "✅" : "❌"}</span>
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 text-xs opacity-60 hover:opacity-100">×</button>
      </div>
    </div>
  );
}

// ─── Pipeline visuelle ─────────────────────────────────────────────────────────

function PipelineProgress({ status }: { status: string }) {
  const isTerminal = ["REJECTED", "WITHDRAWN", "ARCHIVED", "OFFER_DECLINED"].includes(status);
  const currentIdx = PIPELINE_INDEX[status] ?? 0;
  if (isTerminal) {
    const c: Record<string, string> = {
      REJECTED: "bg-red-100 text-red-600 border-red-200",
      WITHDRAWN: "bg-gray-100 text-gray-500 border-gray-200",
      ARCHIVED: "bg-gray-50 text-gray-400 border-gray-200",
      OFFER_DECLINED: "bg-orange-100 text-orange-600 border-orange-200",
    };
    return <div className={`rounded-lg border px-4 py-2.5 text-xs font-semibold ${c[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>{STATUS_LABELS[status]?.label || status} — Processus terminé</div>;
  }
  return (
    <div className="flex items-center gap-0">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isLast = i === PIPELINE_STEPS.length - 1;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${isDone ? "bg-[#2D5BE3] border-[#2D5BE3] text-white" : isCurrent ? "bg-white border-[#2D5BE3] text-[#2D5BE3]" : "bg-white border-[#D4D2CB] text-[#9C9A95]"}`}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`mt-1 text-[9px] font-medium leading-none text-center whitespace-nowrap ${isDone || isCurrent ? "text-[#2D5BE3]" : "text-[#9C9A95]"}`}>{step.label}</span>
            </div>
            {!isLast && <div className={`h-0.5 flex-1 mx-0.5 mb-4 ${isDone ? "bg-[#2D5BE3]" : "bg-[#E2E0D9]"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function CandidaturesTable({ applications }: { applications: ClientApplication[] }) {
  const router = useRouter();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kycFilter, setKycFilter] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("date_desc");

  const showToast = useCallback((message: string, type: "success" | "error") => setToast({ message, type }), []);

  // Stats
  const stats = useMemo(() => {
    const byCounts: Record<string, number> = { ALL: applications.length };
    for (const a of applications) byCounts[a.status] = (byCounts[a.status] || 0) + 1;
    return {
      kycValid: applications.filter((a) => a.kycStatus === "VALIDÉ").length,
      kycPending: applications.filter((a) => a.kycStatus === "EN_ATTENTE").length,
      kycRejected: applications.filter((a) => a.kycStatus === "REJETÉ").length,
      kycNone: applications.filter((a) => a.kycStatus === "AUCUN").length,
      byCounts,
      total: applications.length,
    };
  }, [applications]);

  const statusFilterOptions = useMemo(() => {
    const relevant = ["SUBMITTED","UNREAD","READ","SHORTLISTED","DISCUSSION","INTERVIEW","OFFER_SENT","OFFER_ACCEPTED","OFFER_DECLINED","REJECTED","ARCHIVED","WITHDRAWN"];
    return [
      { value: "ALL", label: "Tous", count: stats.total },
      ...relevant.filter((s) => (stats.byCounts[s] || 0) > 0).map((s) => ({ value: s, label: STATUS_LABELS[s]?.label || s, count: stats.byCounts[s] || 0 })),
    ];
  }, [stats]);

  const displayed = useMemo(() => {
    let list = applications;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.freelancerName.toLowerCase().includes(q) || a.missionTitle.toLowerCase().includes(q) || a.freelancerTitle.toLowerCase().includes(q));
    }
    if (statusFilter !== "ALL") list = list.filter((a) => a.status === statusFilter);
    if (kycFilter !== "ALL") list = list.filter((a) => a.kycStatus === kycFilter);
    return [...list].sort((a, b) => {
      if (sort === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "date_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "budget_desc") return (b.proposedBudget || 0) - (a.proposedBudget || 0);
      if (sort === "budget_asc") return (a.proposedBudget || 0) - (b.proposedBudget || 0);
      return 0;
    });
  }, [applications, search, statusFilter, kycFilter, sort]);

  const isActionAllowed = useCallback((targetStatus: string, kycStatus: string): { allowed: boolean; reason?: string } => {
    if (kycStatus === "REJETÉ") {
      if (targetStatus === "REJECTED" || targetStatus === "ARCHIVED") return { allowed: true };
      return { allowed: false, reason: "KYC rejeté — impossible de progresser" };
    }
    if ((targetStatus === "OFFER_SENT" || targetStatus === "OFFER_ACCEPTED") && kycStatus !== "VALIDÉ") {
      return { allowed: false, reason: "KYC doit être validé avant d'envoyer une offre" };
    }
    return { allowed: true };
  }, []);

  const handleStatusChange = useCallback(async (applicationId: string, targetStatus: string, reason?: string): Promise<boolean> => {
    setProcessingId(applicationId);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Erreur lors du changement de statut", "error");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      showToast("Erreur réseau, veuillez réessayer", "error");
      return false;
    } finally {
      setProcessingId(null);
    }
  }, [router, showToast]);

  const handleQuickAction = useCallback((app: ClientApplication, targetStatus: string) => {
    const { allowed, reason } = isActionAllowed(targetStatus, app.kycStatus);
    if (!allowed) { showToast(reason || "Action non autorisée", "error"); return; }
    if (targetStatus === "REJECTED") { setModal({ type: "reject", app }); return; }
    if (targetStatus === "ARCHIVED") { setModal({ type: "archive", app }); return; }
    if (targetStatus === "INTERVIEW") { setModal({ type: "interview", app }); return; }
    if (targetStatus === "OFFER_SENT") { setModal({ type: "offer", app }); return; }
    if (targetStatus === "OFFER_ACCEPTED") { setModal({ type: "accept_offer", app }); return; }
    if (targetStatus === "OFFER_DECLINED") { setModal({ type: "decline_offer", app }); return; }
    handleStatusChange(app.id, targetStatus).then((ok) => {
      if (ok) showToast(`Candidature → ${STATUS_LABELS[targetStatus]?.label || targetStatus}`, "success");
    });
  }, [isActionAllowed, handleStatusChange, showToast]);

  const handleConfirmReject = useCallback(async (reason: string) => {
    if (!modal || modal.type !== "reject") return;
    const ok = await handleStatusChange(modal.app.id, "REJECTED", reason);
    if (ok) { showToast(`Candidature de ${modal.app.freelancerName} refusée`, "success"); setModal(null); }
  }, [modal, handleStatusChange, showToast]);

  const handleConfirmArchive = useCallback(async () => {
    if (!modal || modal.type !== "archive") return;
    const ok = await handleStatusChange(modal.app.id, "ARCHIVED");
    if (ok) { showToast("Candidature archivée", "success"); setModal(null); }
  }, [modal, handleStatusChange, showToast]);

  const handleConfirmAcceptOffer = useCallback(async () => {
    if (!modal || modal.type !== "accept_offer") return;
    const ok = await handleStatusChange(modal.app.id, "OFFER_ACCEPTED");
    if (ok) { showToast("Offre acceptée — créez le contrat !", "success"); setModal(null); }
  }, [modal, handleStatusChange, showToast]);

  const handleConfirmDeclineOffer = useCallback(async () => {
    if (!modal || modal.type !== "decline_offer") return;
    const ok = await handleStatusChange(modal.app.id, "OFFER_DECLINED");
    if (ok) { showToast("Offre marquée comme refusée", "success"); setModal(null); }
  }, [modal, handleStatusChange, showToast]);

  const handleConfirmInterview = useCallback(async (data: InterviewFormData) => {
    if (!modal || modal.type !== "interview") return;
    setProcessingId(modal.app.id);
    try {
      await fetch(`/api/applications/${modal.app.id}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
          format: data.format,
          duration: data.duration ? Number(data.duration) : undefined,
          notes: data.notes || undefined,
        }),
      }).catch(() => {});
      const ok = await handleStatusChange(modal.app.id, "INTERVIEW");
      if (ok) { showToast(`Entretien planifié avec ${modal.app.freelancerName} 📅`, "success"); setModal(null); }
    } catch {
      showToast("Erreur lors de la planification", "error");
    } finally {
      setProcessingId(null);
    }
  }, [modal, handleStatusChange, showToast]);

  const handleConfirmOffer = useCallback(async (data: OfferFormData) => {
    if (!modal || modal.type !== "offer") return;
    setProcessingId(modal.app.id);
    try {
      const offerRes = await fetch(`/api/applications/${modal.app.id}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title.trim(),
          description: data.description.trim() || undefined,
          offerType: data.offerType,
          totalBudget: data.offerType === "FIXED" && data.totalBudget ? Number(data.totalBudget) : undefined,
          hourlyRate: data.offerType === "HOURLY" && data.hourlyRate ? Number(data.hourlyRate) : undefined,
          weeklyHourLimit: data.offerType === "HOURLY" && data.weeklyHourLimit ? Number(data.weeklyHourLimit) : undefined,
          startDate: new Date(data.startDate).toISOString(),
          endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
          milestones: data.milestones.length > 0
            ? data.milestones.filter((m) => m.title.trim() && m.amount).map((m) => ({ title: m.title.trim(), description: m.description.trim() || undefined, amount: Number(m.amount), dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : undefined }))
            : undefined,
        }),
      });
      if (!offerRes.ok) {
        const d = await offerRes.json().catch(() => ({}));
        showToast(d.error || "Erreur lors de la création de l'offre", "error");
        setProcessingId(null); return;
      }
      const ok = await handleStatusChange(modal.app.id, "OFFER_SENT");
      if (ok) { showToast(`Offre envoyée à ${modal.app.freelancerName} 📨`, "success"); setModal(null); }
    } catch {
      showToast("Erreur réseau lors de l'envoi de l'offre", "error");
      setProcessingId(null);
    }
  }, [modal, handleStatusChange, showToast]);

  const getActions = useCallback((app: ClientApplication) => {
    const map: Record<string, { label: string; target: string; icon: string; color: string }[]> = {
      SUBMITTED: [{ label: "Marquer lue", target: "READ", icon: "👁️", color: "bg-white border-slate-300 text-slate-700" }],
      UNREAD:    [{ label: "Marquer lue", target: "READ", icon: "👁️", color: "bg-white border-slate-300 text-slate-700" }],
      READ: [
        { label: "Présélectionner", target: "SHORTLISTED", icon: "⭐", color: "bg-cyan-50 border-cyan-300 text-cyan-700" },
        { label: "Refuser", target: "REJECTED", icon: "✕", color: "bg-red-50 border-red-200 text-red-600" },
        { label: "Archiver", target: "ARCHIVED", icon: "📦", color: "bg-gray-50 border-gray-200 text-gray-600" },
      ],
      SHORTLISTED: [
        { label: "Démarrer discussion", target: "DISCUSSION", icon: "💬", color: "bg-blue-50 border-blue-300 text-blue-700" },
        { label: "Planifier entretien", target: "INTERVIEW", icon: "📹", color: "bg-indigo-50 border-indigo-300 text-indigo-700" },
        { label: "Refuser", target: "REJECTED", icon: "✕", color: "bg-red-50 border-red-200 text-red-600" },
      ],
      DISCUSSION: [
        { label: "Planifier entretien", target: "INTERVIEW", icon: "📹", color: "bg-indigo-50 border-indigo-300 text-indigo-700" },
        { label: "Refuser", target: "REJECTED", icon: "✕", color: "bg-red-50 border-red-200 text-red-600" },
      ],
      INTERVIEW: [
        { label: "Envoyer une offre", target: "OFFER_SENT", icon: "📨", color: "bg-orange-50 border-orange-300 text-orange-700" },
        { label: "Refuser", target: "REJECTED", icon: "✕", color: "bg-red-50 border-red-200 text-red-600" },
      ],
      OFFER_SENT: [
        { label: "Marquer acceptée", target: "OFFER_ACCEPTED", icon: "✅", color: "bg-green-50 border-green-300 text-green-700" },
        { label: "Marquer refusée", target: "OFFER_DECLINED", icon: "↩️", color: "bg-orange-50 border-orange-200 text-orange-600" },
      ],
      OFFER_DECLINED: [{ label: "Retour présélection", target: "SHORTLISTED", icon: "↩️", color: "bg-cyan-50 border-cyan-300 text-cyan-700" }],
      OFFER_ACCEPTED: [],
      ARCHIVED: [{ label: "Désarchiver", target: "READ", icon: "📂", color: "bg-white border-slate-300 text-slate-600" }],
      REJECTED: [], WITHDRAWN: [], ACCEPTED: [], IDENTITY_PENDING: [],
    };
    return map[app.status] || [];
  }, []);

  const processing = (id: string) => processingId === id;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {modal?.type === "reject" && (
        <RejectModal app={modal.app} onConfirm={handleConfirmReject} onClose={() => setModal(null)} loading={processing(modal.app.id)} />
      )}
      {modal?.type === "archive" && (
        <ConfirmModal
          title="📦 Archiver la candidature"
          message={`Archiver la candidature de ${modal.app.freelancerName} pour «${modal.app.missionTitle}» ? Vous pourrez la désarchiver à tout moment.`}
          confirmLabel="Archiver" confirmClass="bg-gray-600 hover:bg-gray-700"
          onConfirm={handleConfirmArchive} onClose={() => setModal(null)} loading={processing(modal.app.id)}
        />
      )}
      {modal?.type === "interview" && (
        <InterviewModal app={modal.app} onConfirm={handleConfirmInterview} onClose={() => setModal(null)} loading={processing(modal.app.id)} />
      )}
      {modal?.type === "offer" && (
        <OfferModal app={modal.app} onConfirm={handleConfirmOffer} onClose={() => setModal(null)} loading={processing(modal.app.id)} />
      )}
      {modal?.type === "accept_offer" && (
        <ConfirmModal
          title="✅ Confirmer l'acceptation de l'offre"
          message={`${modal.app.freelancerName} a accepté votre offre pour «${modal.app.missionTitle}» ? Cette action prépare la création du contrat.`}
          confirmLabel="Confirmer l'acceptation" confirmClass="bg-green-600 hover:bg-green-700"
          onConfirm={handleConfirmAcceptOffer} onClose={() => setModal(null)} loading={processing(modal.app.id)}
        />
      )}
      {modal?.type === "decline_offer" && (
        <ConfirmModal
          title="↩️ Offre refusée par le freelance ?"
          message={`Marquer l'offre envoyée à ${modal.app.freelancerName} comme refusée. La candidature reviendra en présélection.`}
          confirmLabel="Marquer comme refusée" confirmClass="bg-orange-500 hover:bg-orange-600"
          onConfirm={handleConfirmDeclineOffer} onClose={() => setModal(null)} loading={processing(modal.app.id)}
        />
      )}

      <div className="space-y-4">
        {/* KYC Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "TOTAL", value: stats.total, cls: "border-[#E2E0D9] bg-white text-[#1A1916]", lCls: "text-[#5A5750]" },
            { label: "KYC VALIDÉ", value: `✅ ${stats.kycValid}`, cls: "border-[#9FD4B4] bg-[#E6F5EE] text-[#1A7A4A]", lCls: "text-[#1A7A4A]" },
            { label: "EN ATTENTE", value: `⏳ ${stats.kycPending}`, cls: "border-[#F9E79F] bg-[#FEF9E7] text-[#B7950B]", lCls: "text-[#B7950B]" },
            { label: "KYC REJETÉ", value: `❌ ${stats.kycRejected}`, cls: "border-[#F5B7B1] bg-[#FDEDEC] text-[#C0392B]", lCls: "text-[#C0392B]" },
            { label: "SANS KYC", value: `— ${stats.kycNone}`, cls: "border-[#E2E0D9] bg-[#FAFAF8] text-[#5A5750]", lCls: "text-[#5A5750]" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 ${s.cls}`}>
              <p className={`text-[10px] font-bold tracking-wide ${s.lCls}`}>{s.label}</p>
              <p className="text-[20px] font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9A95] w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par freelance ou mission…"
              className="w-full rounded-lg border border-[#E2E0D9] bg-white pl-9 pr-3 py-2 text-sm text-[#1A1916] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-sm text-[#5A5750] focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30">
            <option value="date_desc">📅 Plus récentes</option>
            <option value="date_asc">📅 Plus anciennes</option>
            <option value="budget_desc">💰 Budget décroissant</option>
            <option value="budget_asc">💰 Budget croissant</option>
          </select>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-1.5">
          {statusFilterOptions.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium border transition-colors ${statusFilter === f.value ? "bg-[#1A1916] text-white border-[#1A1916]" : "bg-white border-[#E2E0D9] text-[#5A5750] hover:border-[#1A1916]"}`}>
              {f.label}
              <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded ${statusFilter === f.value ? "bg-white/20 text-white" : "bg-[#F0EFE9] text-[#5A5750]"}`}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* KYC filters */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Tous KYC", value: "ALL", count: stats.total },
            { label: "KYC Validé", value: "VALIDÉ", count: stats.kycValid },
            { label: "En attente", value: "EN_ATTENTE", count: stats.kycPending },
            { label: "KYC Rejeté", value: "REJETÉ", count: stats.kycRejected },
            { label: "Sans KYC", value: "AUCUN", count: stats.kycNone },
          ].map((f) => (
            <button key={f.value} onClick={() => setKycFilter(f.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${kycFilter === f.value ? "bg-[#2D5BE3] text-white border-[#2D5BE3]" : "bg-white border-[#E2E0D9] text-[#5A5750] hover:border-[#2D5BE3]"}`}>
              {f.label}
              <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded ${kycFilter === f.value ? "bg-white/25 text-white" : "bg-[#E2E0D9] text-[#5A5750]"}`}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* Empty filtered state */}
        {displayed.length === 0 && (
          <div className="rounded-xl border border-[#E2E0D9] bg-white p-10 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-semibold text-[#1A1916]">Aucune candidature trouvée</p>
            <p className="text-xs text-[#5A5750] mt-1">Modifiez vos filtres ou votre recherche.</p>
            <button onClick={() => { setSearch(""); setStatusFilter("ALL"); setKycFilter("ALL"); }} className="mt-3 text-xs text-[#2D5BE3] underline">
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* Table */}
        {displayed.length > 0 && (
          <div className="rounded-xl border border-[#E2E0D9] bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E0D9] bg-[#FAFAF8] text-left">
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide">FREELANCE</th>
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide">MISSION</th>
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide">BUDGET</th>
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide">KYC</th>
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide">STATUT</th>
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide">DATE</th>
                    <th className="px-4 py-3 font-semibold text-[#5A5750] text-[11px] tracking-wide text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((app) => {
                    const statusInfo = STATUS_LABELS[app.status] || STATUS_LABELS.SUBMITTED;
                    const kycInfo = KYC_LABELS[app.kycStatus] || KYC_LABELS.AUCUN;
                    const isExpanded = expandedId === app.id;
                    const isProc = processing(app.id);
                    const actions = getActions(app);
                    const inlineActions = actions.slice(0, 2);

                    return (
                      <React.Fragment key={app.id}>
                        <tr className={`border-b border-[#F5F5F0] hover:bg-[#FAFAF8] transition-colors ${isExpanded ? "bg-[#F9F8FE]" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#EEF2FD] flex items-center justify-center text-[#2D5BE3] text-xs font-bold shrink-0">
                                {app.freelancerName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-[#1A1916] truncate max-w-[130px]">{app.freelancerName}</p>
                                <p className="text-[11px] text-[#5A5750] truncate max-w-[130px]">{app.freelancerTitle}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/client/missions/${app.missionId}`} className="text-[#2D5BE3] font-medium text-xs hover:underline truncate block max-w-[140px]">
                              {app.missionTitle}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#1A1916] text-xs">
                              {app.proposedBudget > 0 ? `${app.proposedBudget.toLocaleString()} ${app.missionCurrency}` : <span className="text-[#9C9A95]">—</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${kycInfo.color}`}>
                              {kycInfo.icon} {app.kycStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#9C9A95] text-[11px] whitespace-nowrap">
                            {new Date(app.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {inlineActions.map((action) => {
                                const { allowed, reason: blockReason } = isActionAllowed(action.target, app.kycStatus);
                                return (
                                  <button key={action.target}
                                    onClick={() => handleQuickAction(app, action.target)}
                                    disabled={isProc || !allowed}
                                    title={blockReason || action.label}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-opacity ${allowed ? `${action.color} hover:opacity-80` : "border-[#E2E0D9] bg-[#FAFAF8] text-[#9C9A95] cursor-not-allowed"} ${isProc ? "opacity-50" : ""}`}>
                                    {isProc ? "…" : `${action.icon} ${action.label}`}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : app.id)}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${isExpanded ? "bg-[#EEF2FD] border-[#2D5BE3] text-[#2D5BE3]" : "bg-white border-[#E2E0D9] hover:border-[#2D5BE3] hover:text-[#2D5BE3] text-[#5A5750]"}`}
                                title={isExpanded ? "Réduire" : "Voir détails"}
                              >
                                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${app.id}-detail`} className="bg-[#F9F8FE]">
                            <td colSpan={7} className="px-6 py-5 border-b border-[#E2E0D9]">
                              <div className="space-y-5 max-w-4xl">
                                {/* Pipeline */}
                                <div>
                                  <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-3">PROGRESSION DU DOSSIER</h4>
                                  <PipelineProgress status={app.status} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                  {/* Cover letter */}
                                  <div className="md:col-span-2">
                                    <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-2">LETTRE DE MOTIVATION</h4>
                                    <div className="rounded-lg bg-white border border-[#E2E0D9] px-4 py-3 text-sm text-[#1A1916] whitespace-pre-wrap leading-relaxed min-h-[60px]">
                                      {app.coverLetter || <span className="text-[#9C9A95] italic">Aucune lettre de motivation fournie.</span>}
                                    </div>
                                  </div>

                                  {/* Freelancer info */}
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-2">VÉRIFICATION D'IDENTITÉ</h4>
                                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border ${KYC_LABELS[app.kycStatus]?.color || ""}`}>
                                        {KYC_LABELS[app.kycStatus]?.icon} {KYC_LABELS[app.kycStatus]?.label || app.kycStatus}
                                      </span>
                                      {app.kycStatus === "EN_ATTENTE" && (
                                        <p className="mt-1.5 text-[10px] text-[#B7950B]">Actions restreintes jusqu'à validation KYC.</p>
                                      )}
                                    </div>
                                    <div>
                                      <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-2">COMPÉTENCES</h4>
                                      <div className="flex flex-wrap gap-1">
                                        {app.freelancerSkills.length > 0
                                          ? app.freelancerSkills.map((s: string) => (
                                              <span key={s} className="rounded-full bg-[#EEF2FD] px-2 py-0.5 text-[10px] font-medium text-[#2D5BE3]">{s}</span>
                                            ))
                                          : <span className="text-[11px] text-[#9C9A95] italic">Aucune compétence renseignée</span>}
                                      </div>
                                    </div>
                                    {app.freelancerRate > 0 && (
                                      <div>
                                        <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-1">TAUX HORAIRE</h4>
                                        <p className="text-sm font-bold text-[#1A1916]">{app.freelancerRate.toLocaleString()} {app.missionCurrency}/h</p>
                                      </div>
                                    )}
                                    {app.proposedBudget > 0 && (
                                      <div>
                                        <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-1">BUDGET PROPOSÉ</h4>
                                        <p className="text-sm font-bold text-[#1A1916]">{app.proposedBudget.toLocaleString()} {app.missionCurrency}</p>
                                        {app.missionBudget > 0 && <p className="text-[10px] text-[#9C9A95]">Budget mission : {app.missionBudget.toLocaleString()} {app.missionCurrency}</p>}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Actions panel */}
                                <div className="pt-4 border-t border-[#E2E0D9]">
                                  <h4 className="text-[10px] font-bold tracking-wide text-[#5A5750] mb-3">ACTIONS</h4>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {app.status === "OFFER_ACCEPTED" && (
                                      <Link href={`/dashboard/client/missions/${app.missionId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100">
                                        🤝 Créer le contrat
                                      </Link>
                                    )}
                                    {getActions(app).map((action) => {
                                      const { allowed, reason: blockReason } = isActionAllowed(action.target, app.kycStatus);
                                      return (
                                        <button key={action.target}
                                          onClick={() => handleQuickAction(app, action.target)}
                                          disabled={processing(app.id) || !allowed}
                                          title={blockReason || action.label}
                                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-opacity ${allowed ? `${action.color} hover:opacity-80` : "border-[#E2E0D9] bg-[#FAFAF8] text-[#9C9A95] cursor-not-allowed"} ${processing(app.id) ? "opacity-50" : ""}`}>
                                          {processing(app.id) ? "…" : `${action.icon} ${action.label}`}
                                        </button>
                                      );
                                    })}
                                    <Link href={`/dashboard/client/messages?freelancer=${app.freelancerId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-xs font-semibold text-[#5A5750] hover:bg-[#FAFAF8]">
                                      💬 Messagerie
                                    </Link>

                                    {getActions(app).length === 0 && app.status !== "OFFER_ACCEPTED" && (
                                      <span className="text-xs text-[#9C9A95] italic">Aucune action disponible — statut terminal.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E2E0D9] bg-[#FAFAF8] px-4 py-2.5">
              <p className="text-[11px] text-[#9C9A95]">
                {displayed.length} candidature{displayed.length > 1 ? "s" : ""} affichée{displayed.length > 1 ? "s" : ""}
                {displayed.length !== stats.total && ` sur ${stats.total} au total`}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
