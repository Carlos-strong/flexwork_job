"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────
interface MilestoneData {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  executionRate: number;
  status: string;
  dueDate: string | null;
  originalAmount?: number | null;
  originalDueDate?: string | null;
}

interface OfferData {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  offerType: "FIXED" | "HOURLY";
  totalBudget: number | null;
  hourlyRate: number | null;
  weeklyHourLimit: number | null;
  startDate: string;
  endDate: string | null;
  status: "DRAFT" | "SENT" | "COUNTERED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN";
  sentAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  counteredAt: string | null;
  counterNote: string | null;
  negotiationRounds: number;
  lastCounterBy: string | null;
  createdAt: string;
  milestones: MilestoneData[];
  mission: {
    id: string;
    title: string;
    description: string | null;
    budget: number | null;
    budgetType: string;
    duration: string | null;
  };
  freelancer: {
    id: string;
    userId: string;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
    title: string | null;
  };
  applicationStatus: string;
}

type ViewMode = "list" | "detail";

/** Nombre maximum d'échanges de négociation autorisés (contre-propositions) avant refus automatique. */
const MAX_NEGOTIATION_ROUNDS = 3;

// Édition locale d'un jalon avant envoi d'une contre-proposition
interface MilestoneEdit {
  amount: number;
  dueDate: string; // "YYYY-MM-DD"
  modified: boolean;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  SENT:      { label: "En attente de réponse",       color: "bg-yellow-100 text-yellow-700" },
  COUNTERED: { label: "Contre-proposition reçue",    color: "bg-orange-100 text-orange-700" },
  ACCEPTED:  { label: "Acceptée",                    color: "bg-green-100 text-green-700" },
  DECLINED:  { label: "Refusée",                     color: "bg-red-100 text-red-700" },
  EXPIRED:   { label: "Expirée",                     color: "bg-gray-100 text-gray-600" },
  WITHDRAWN: { label: "Retirée",                     color: "bg-gray-100 text-gray-600" },
  DRAFT:     { label: "Brouillon",                   color: "bg-blue-100 text-blue-700" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtEuro(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR") + " €";
}

function getFreelancerName(f: OfferData["freelancer"]): string {
  return `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim() || "Freelance";
}

function getFreelancerInitials(f: OfferData["freelancer"]): string {
  const fn = f.firstName?.[0] ?? "";
  const ln = f.lastName?.[0] ?? "";
  return (fn + ln).toUpperCase() || "F";
}

export default function ClientOffresPage() {
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Détail
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedOffer, setSelectedOffer] = useState<OfferData | null>(null);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Retrait / refus
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Contre-proposition (négociation)
  const [milestoneEdits, setMilestoneEdits] = useState<Record<string, MilestoneEdit>>({});
  const [counterModalId, setCounterModalId] = useState<string | null>(null);
  const [cAmount, setCAmount] = useState<string>("");
  const [cDueDate, setCDueDate] = useState<string>("");
  const [counterNoteInput, setCounterNoteInput] = useState("");

  const loadOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/offers/client");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setOffers(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("Erreur chargement offres:", err);
      setError("Impossible de charger les offres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  // Filtrage
  const filteredOffers = offers.filter((offer) => {
    if (statusFilter !== "ALL" && offer.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = offer.title.toLowerCase().includes(q);
      const matchFreelancer = getFreelancerName(offer.freelancer).toLowerCase().includes(q);
      const matchMission = offer.mission.title.toLowerCase().includes(q);
      if (!matchTitle && !matchFreelancer && !matchMission) return false;
    }
    return true;
  });

  // Statistiques
  const stats = {
    total: offers.length,
    enAttente: offers.filter((o) => o.status === "SENT" || o.status === "COUNTERED").length,
    acceptees: offers.filter((o) => o.status === "ACCEPTED").length,
    refusees: offers.filter((o) => o.status === "DECLINED" || o.status === "EXPIRED" || o.status === "WITHDRAWN").length,
  };

  // Actions
  const handleWithdraw = useCallback(async () => {
    if (!selectedOffer) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/offers/${selectedOffer.id}?action=withdraw`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: withdrawReason || "Offre retirée par le client" }),
      });
      if (!res.ok) throw new Error("Erreur lors du retrait");
      await loadOffers();
      setSelectedOffer((prev) =>
        prev ? { ...prev, status: "WITHDRAWN", declineReason: withdrawReason } : prev
      );
      setWithdrawOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du retrait de l'offre.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, withdrawReason, loadOffers]);

  // Accepter la contre-proposition du freelance
  const handleAcceptCounter = useCallback(async () => {
    if (!selectedOffer) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/offers/${selectedOffer.id}?action=accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Erreur lors de l'acceptation");
      await loadOffers();
      setSelectedOffer((prev) =>
        prev ? { ...prev, status: "ACCEPTED", acceptedAt: new Date().toISOString() } : prev
      );
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'acceptation de la contre-proposition.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, loadOffers]);

  // Refuser la contre-proposition du freelance
  const handleDeclineCounter = useCallback(async () => {
    if (!selectedOffer) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/offers/${selectedOffer.id}?action=decline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: withdrawReason || "Contre-proposition refusée par le client" }),
      });
      if (!res.ok) throw new Error("Erreur lors du refus");
      await loadOffers();
      setSelectedOffer((prev) =>
        prev ? { ...prev, status: "DECLINED", declinedAt: new Date().toISOString(), declineReason: withdrawReason } : prev
      );
      setWithdrawOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du refus de la contre-proposition.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, withdrawReason, loadOffers]);

  // Envoyer une contre-proposition (négociation) au freelance
  const handleSendCounter = useCallback(async () => {
    if (!selectedOffer) return;
    const updates = Object.entries(milestoneEdits)
      .filter(([, edit]) => edit.modified)
      .map(([milestoneId, edit]) => ({
        milestoneId,
        amount: edit.amount,
        dueDate: edit.dueDate || undefined,
      }));
    if (updates.length === 0) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/offers/${selectedOffer.id}?action=counter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: updates, note: counterNoteInput || undefined }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'envoi de la contre-proposition");
      const json = await res.json();
      await loadOffers();
      if (json.autoDeclined) {
        setSelectedOffer((prev) =>
          prev ? { ...prev, status: "DECLINED", declinedAt: new Date().toISOString(), declineReason: "Nombre maximum de négociations atteint (3) — offre refusée automatiquement" } : prev
        );
        alert("La limite de négociation (3 échanges) a été atteinte : l'offre a été automatiquement refusée.");
      } else {
        setSelectedOffer((prev) =>
          prev ? { ...prev, status: "COUNTERED", counteredAt: new Date().toISOString(), negotiationRounds: (prev.negotiationRounds ?? 0) + 1, lastCounterBy: "CLIENT" } : prev
        );
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de la contre-proposition.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, milestoneEdits, counterNoteInput, loadOffers]);

  const openDetail = useCallback((offer: OfferData) => {
    setSelectedOffer(offer);
    setWithdrawReason("");
    setCounterNoteInput("");
    const edits: Record<string, MilestoneEdit> = {};
    offer.milestones.forEach((m) => {
      edits[m.id] = { amount: m.amount, dueDate: toDateInput(m.dueDate), modified: false };
    });
    setMilestoneEdits(edits);
    setViewMode("detail");
  }, []);

  const backToList = useCallback(() => {
    setViewMode("list");
    setSelectedOffer(null);
    setWithdrawOpen(false);
    setCounterModalId(null);
  }, []);

  // ── Modal contre-proposition (par jalon) ──
  const openCounterModal = useCallback((milestoneId: string) => {
    const edit = milestoneEdits[milestoneId];
    setCAmount(edit ? String(edit.amount) : "");
    setCDueDate(edit ? edit.dueDate : "");
    setCounterModalId(milestoneId);
  }, [milestoneEdits]);

  const closeCounterModal = useCallback(() => setCounterModalId(null), []);

  const applyCounterModal = useCallback(() => {
    if (!counterModalId || !selectedOffer) return;
    const original = selectedOffer.milestones.find((m) => m.id === counterModalId);
    if (!original) return;
    const amount = parseFloat(cAmount) || original.amount;
    const dueDate = cDueDate || toDateInput(original.dueDate);
    const modified = amount !== original.amount || dueDate !== toDateInput(original.dueDate);
    setMilestoneEdits((prev) => ({
      ...prev,
      [counterModalId]: { amount, dueDate, modified },
    }));
    setCounterModalId(null);
  }, [counterModalId, selectedOffer, cAmount, cDueDate]);

  const resetMilestoneEdit = useCallback((milestoneId: string) => {
    const original = selectedOffer?.milestones.find((m) => m.id === milestoneId);
    if (!original) return;
    setMilestoneEdits((prev) => ({
      ...prev,
      [milestoneId]: { amount: original.amount, dueDate: toDateInput(original.dueDate), modified: false },
    }));
  }, [selectedOffer]);

  // ── Render: chargement ──
  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto py-10 px-4 sm:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#F5F5F0] rounded-xl w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-[#F5F5F0] rounded-xl" />)}
          </div>
          <div className="h-24 bg-[#F5F5F0] rounded-xl" />
          <div className="h-24 bg-[#F5F5F0] rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Render: erreur ──
  if (error) {
    return (
      <div className="max-w-[1000px] mx-auto py-10 px-4 sm:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={loadOffers} className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Réessayer</button>
        </div>
      </div>
    );
  }

  // ── Render: liste ──
  if (viewMode === "list") {
    return (
      <div className="max-w-[1000px] mx-auto py-10 px-4 sm:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Offres envoyées</h2>
            <p className="text-sm text-[#5A5750] mt-1">
              Suivez et gérez les offres que vous avez envoyées aux freelances
            </p>
          </div>
          <Link
            href="/dashboard/client/candidatures"
            className="inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            Candidatures
          </Link>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total envoyées", value: stats.total, color: "text-[#2D5BE3]" },
            { label: "En attente", value: stats.enAttente, color: "text-yellow-600" },
            { label: "Acceptées", value: stats.acceptees, color: "text-green-600" },
            { label: "Clôturées", value: stats.refusees, color: "text-gray-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#E2E0D9] p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#5A5750] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, freelance, mission..."
              className="w-full rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 pl-9 text-sm focus:outline-none focus:border-[#2D5BE3]"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA0A6] text-sm">🔍</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#2D5BE3]"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="SENT">En attente</option>
            <option value="COUNTERED">Contre-proposition reçue</option>
            <option value="ACCEPTED">Acceptées</option>
            <option value="DECLINED">Refusées</option>
            <option value="EXPIRED">Expirées</option>
            <option value="WITHDRAWN">Retirées</option>
          </select>
        </div>

        {/* Liste */}
        {filteredOffers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
            <p className="text-3xl mb-3">📨</p>
            <h3 className="font-semibold text-lg">
              {offers.length === 0 ? "Aucune offre envoyée" : "Aucune offre ne correspond aux filtres"}
            </h3>
            <p className="mt-1 text-sm text-[#5A5750]">
              {offers.length === 0
                ? "Les offres apparaîtront ici lorsque vous enverrez une proposition depuis les candidatures."
                : "Essayez de modifier vos filtres de recherche."}
            </p>
            {offers.length === 0 && (
              <Link
                href="/dashboard/client/candidatures"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Voir les candidatures
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOffers.map((offer) => {
              const cfg = STATUS_CFG[offer.status] || STATUS_CFG.SENT;
              const isExpired = offer.expiresAt && new Date(offer.expiresAt) < new Date();
              return (
                <button
                  key={offer.id}
                  onClick={() => openDetail(offer)}
                  className="w-full text-left rounded-xl border border-[#E2E0D9] p-5 bg-white hover:border-[#C3D1F8] hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{offer.title}</p>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {isExpired && offer.status === "SENT" && (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">Expirée</span>
                        )}
                      </div>
                      <p className="text-sm text-[#5A5750]">
                        Freelance : <b>{getFreelancerName(offer.freelancer)}</b>
                        {offer.freelancer.title ? ` · ${offer.freelancer.title}` : ""}
                      </p>
                      <p className="text-xs text-[#5A5750] mt-0.5">
                        Mission : {offer.mission.title} · Envoyée le {formatDate(offer.sentAt ?? offer.createdAt)}
                        {offer.acceptedAt ? ` · Acceptée le ${formatDate(offer.acceptedAt)}` : ""}
                        {offer.declinedAt ? ` · Refusée le ${formatDate(offer.declinedAt)}` : ""}
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-lg font-bold text-[#2D5BE3]">
                        {offer.offerType === "FIXED"
                          ? fmtEuro(offer.totalBudget)
                          : `${fmtEuro(offer.hourlyRate)}/h`}
                      </p>
                      <p className="text-xs text-[#5A5750]">
                        {offer.offerType === "FIXED" ? "Prix fixe" : "Taux horaire"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Render: détail ──
  const offer = selectedOffer!;
  const cfg = STATUS_CFG[offer.status] || STATUS_CFG.SENT;
  const isPending = offer.status === "SENT";
  const isCountered = offer.status === "COUNTERED";
  // Le freelance a contre-proposé en dernier → c'est au tour du client de répondre (accepter / refuser / re-négocier)
  const awaitingClientAction = isCountered && offer.lastCounterBy === "FREELANCER";
  // Le client a contre-proposé en dernier → en attente de la réponse du freelance
  const awaitingFreelanceResponse = isCountered && offer.lastCounterBy === "CLIENT";
  const isAccepted = offer.status === "ACCEPTED";
  const isWithdrawn = offer.status === "WITHDRAWN";
  const isExpired = offer.status === "EXPIRED";
  const isTerminal = isAccepted || isWithdrawn || isExpired || offer.status === "DECLINED";
  const milestones = offer.milestones;
  const grandTotal = milestones.reduce((s, m) => s + m.amount, 0);

  const negotiationRounds = offer.negotiationRounds ?? 0;
  const remainingRounds = Math.max(0, MAX_NEGOTIATION_ROUNDS - negotiationRounds);
  const anyModified = Object.values(milestoneEdits).some((e) => e.modified);
  const currentTotal = offer.offerType === "FIXED"
    ? milestones.reduce((s, m) => s + (milestoneEdits[m.id]?.amount ?? m.amount), 0)
    : (offer.hourlyRate ?? 0);
  const editingMilestone = counterModalId
    ? milestones.find((m) => m.id === counterModalId)
    : null;

  return (
    <div className="max-w-[1000px] mx-auto py-10 px-4 sm:px-8">
      {/* Bouton retour */}
      <button
        onClick={backToList}
        className="mb-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#5A5750] hover:text-[#1A1916] hover:bg-gray-100 transition-all"
      >
        ← Toutes les offres
      </button>

      {/* ── HEADER ── */}
      <div className="flex items-start gap-4 p-6 bg-white border border-[#E2E0D9] rounded-xl mb-7">
        <div className="w-12 h-12 rounded-full bg-[#1A1916] text-[#EDEFF5] flex items-center justify-center font-serif text-lg font-medium flex-shrink-0">
          {getFreelancerInitials(offer.freelancer)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono uppercase tracking-wider text-green-700 mb-1.5">
            Offre envoyée · {offer.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="font-serif font-medium text-[22px] leading-tight tracking-tight m-0">
            {offer.title}
          </h1>
          <p className="text-sm text-[#5A5750] mt-1">
            À <b>{getFreelancerName(offer.freelancer)}</b> ·{" "}
            {offer.offerType === "FIXED" ? "Prix fixe" : "Taux horaire"} · envoyée le{" "}
            {formatDate(offer.sentAt ?? offer.createdAt)}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap flex-shrink-0 ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* ── RESULTAT: Contre-proposition reçue (à votre tour de répondre) ── */}
      {awaitingClientAction && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl bg-orange-600 text-white mb-6">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">↔</div>
          <div>
            <p className="font-serif text-lg font-medium">Contre-proposition reçue</p>
            <p className="text-xs opacity-85 mt-0.5">
              {getFreelancerName(offer.freelancer)} a proposé des modifications sur un ou plusieurs jalons.
              {offer.counteredAt ? ` Reçue le ${formatDate(offer.counteredAt)}.` : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── RESULTAT: Contre-proposition envoyée (en attente du freelance) ── */}
      {awaitingFreelanceResponse && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl bg-amber-600 text-white mb-6">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">↔</div>
          <div>
            <p className="font-serif text-lg font-medium">Contre-proposition envoyée</p>
            <p className="text-xs opacity-85 mt-0.5">
              {getFreelancerName(offer.freelancer)} va examiner vos modifications et vous répondra prochainement.
              {offer.counteredAt ? ` Envoyée le ${formatDate(offer.counteredAt)}.` : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── Avertissement : tentatives de négociation restantes ── */}
      {negotiationRounds > 0 && isCountered && (
        <div className="flex items-center gap-3 p-4 rounded-xl border mb-6" style={{ borderColor: "#F5CBA7", background: "#FDF0E3" }}>
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-orange-800">
              Négociation : {negotiationRounds}/{MAX_NEGOTIATION_ROUNDS} tentative(s) utilisée(s)
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              {remainingRounds > 0
                ? `${remainingRounds} tentative(s) restante(s) avant refus automatique de l'offre.`
                : "Aucune tentative restante — toute nouvelle contre-proposition entraînera un refus automatique."}
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Acceptée ── */}
      {isAccepted && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl bg-green-600 text-white mb-6">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">✓</div>
          <div>
            <p className="font-serif text-lg font-medium">Offre acceptée par le freelance</p>
            <p className="text-xs opacity-85 mt-0.5">
              {offer.acceptedAt
                ? `Acceptée le ${formatDate(offer.acceptedAt)}. `
                : ""}
              Le contrat a été créé automatiquement. Vous pouvez le consulter dans la section Contrats.
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Refusée ── */}
      {offer.status === "DECLINED" && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl bg-red-600 text-white mb-6">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">✕</div>
          <div>
            <p className="font-serif text-lg font-medium">Offre refusée par le freelance</p>
            <p className="text-xs opacity-85 mt-0.5">
              {offer.declineReason
                ? `Motif : « ${offer.declineReason} »`
                : "Le freelance a refusé l'offre."}
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Retirée ── */}
      {isWithdrawn && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl bg-gray-600 text-white mb-6">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">✕</div>
          <div>
            <p className="font-serif text-lg font-medium">Offre retirée</p>
            <p className="text-xs opacity-85 mt-0.5">
              {offer.declineReason
                ? `Motif : « ${offer.declineReason} »`
                : "Vous avez retiré cette offre."}
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Expirée ── */}
      {isExpired && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl bg-orange-600 text-white mb-6">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">⏰</div>
          <div>
            <p className="font-serif text-lg font-medium">Offre expirée</p>
            <p className="text-xs opacity-85 mt-0.5">
              Le freelance n&apos;a pas répondu dans le délai imparti.
            </p>
          </div>
        </div>
      )}

      {/* ── DÉTAILS DE LA MISSION ── */}
      <div className="mb-7">
        <p className="text-xs uppercase tracking-wider text-[#5A5750] font-semibold mb-3">
          Détails de l&apos;offre
        </p>
        <div className="bg-white border border-[#E2E0D9] rounded-xl">
          <div className="flex gap-0 border border-[#E2E0D9] rounded-lg w-fit ml-6 mt-5 overflow-hidden">
            <span className={`px-4 py-2 text-sm font-semibold ${offer.offerType === "FIXED" ? "bg-green-700 text-white" : "text-[#5A5750]"}`}>
              Prix fixe
            </span>
            <span className={`px-4 py-2 text-sm font-semibold ${offer.offerType === "HOURLY" ? "bg-green-700 text-white" : "text-[#5A5750]"}`}>
              Taux horaire
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Description</label>
              <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm min-h-[56px]">
                {offer.description || offer.mission.description || "Aucune description fournie."}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Freelance</label>
              <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                {getFreelancerName(offer.freelancer)}
                {offer.freelancer.title ? ` — ${offer.freelancer.title}` : ""}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Mission associée</label>
              <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                {offer.mission.title}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Date de début souhaitée</label>
              <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                {formatDate(offer.startDate)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Durée estimée</label>
              <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                {offer.mission.duration || "Non spécifiée"}
              </div>
            </div>
            {offer.offerType === "FIXED" && (
              <div>
                <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Montant total</label>
                <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm font-bold text-green-700">
                  {fmtEuro(offer.totalBudget)}
                </div>
              </div>
            )}
            {offer.offerType === "HOURLY" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Taux horaire</label>
                  <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                    {fmtEuro(offer.hourlyRate)}/h
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Limite hebdomadaire</label>
                  <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                    {offer.weeklyHourLimit ? `${offer.weeklyHourLimit}h/semaine` : "Non spécifiée"}
                  </div>
                </div>
              </>
            )}
            {offer.endDate && (
              <div>
                <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Date de fin</label>
                <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                  {formatDate(offer.endDate)}
                </div>
              </div>
            )}
            {offer.expiresAt && (
              <div>
                <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Expire le</label>
                <div className="bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg px-3.5 py-2.5 text-sm">
                  {formatDate(offer.expiresAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Message du freelance (contre-proposition) ── */}
      {(awaitingClientAction || awaitingFreelanceResponse) && offer.counterNote && (
        <div className="mb-7">
          <p className="text-xs uppercase tracking-wider text-[#5A5750] font-semibold mb-3">
            {offer.lastCounterBy === "FREELANCER" ? "Message du freelance" : "Votre message"}
          </p>
          <div className="bg-white border border-[#E2E0D9] rounded-xl p-5 text-sm">
            {offer.counterNote}
          </div>
        </div>
      )}

      {/* ── JALONS (FIXED uniquement) ── */}
      {offer.offerType === "FIXED" && milestones.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs uppercase tracking-wider text-[#5A5750] font-semibold m-0">
              Jalons de paiement proposés
            </h3>
            {awaitingClientAction ? (
              <span className="text-xs text-[#5A5750]">Cliquez sur ✎ pour proposer un nouveau montant ou délai</span>
            ) : (
              <span className="text-xs text-[#5A5750]">
                {milestones.length} jalon{milestones.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="bg-white border border-[#E2E0D9] rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[#5A5750] font-semibold">
                  <th className="px-3 py-2.5 border-b border-[#E2E0D9] w-8">#</th>
                  <th className="px-3 py-2.5 border-b border-[#E2E0D9]">Description</th>
                  <th className="px-3 py-2.5 border-b border-[#E2E0D9]">Montant</th>
                  <th className="px-3 py-2.5 border-b border-[#E2E0D9]">Date limite</th>
                  <th className="px-3 py-2.5 border-b border-[#E2E0D9]">Exécution</th>
                  {awaitingClientAction && <th className="px-3 py-2.5 border-b border-[#E2E0D9]"></th>}
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => {
                  const edit = milestoneEdits[m.id];
                  const isModified = !!edit?.modified;
                  const displayAmount = edit ? edit.amount : m.amount;
                  const wasCountered = !awaitingClientAction && m.originalAmount != null;
                  return (
                    <tr key={m.id} className="text-sm border-b border-[#E2E0D9] last:border-b-0">
                      <td className="px-3 py-3 font-mono text-[#5A5750] align-top">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-3 align-top max-w-[260px]">
                        <span className="font-medium">{m.title}</span>
                        {m.description && (
                          <p className="text-xs text-[#5A5750] mt-0.5">{m.description}</p>
                        )}
                        {(isModified || wasCountered) && (
                          <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            Modifié
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right font-mono whitespace-nowrap">
                        {isModified ? (
                          <>
                            <span className="block text-[11px] line-through text-[#5A5750]">{fmtEuro(m.amount)}</span>
                            <span className="text-orange-700">{fmtEuro(displayAmount)}</span>
                          </>
                        ) : wasCountered ? (
                          <>
                            <span className="block text-[11px] line-through text-[#5A5750]">{fmtEuro(m.originalAmount)}</span>
                            <span className="text-orange-700">{fmtEuro(m.amount)}</span>
                          </>
                        ) : (
                          fmtEuro(displayAmount)
                        )}
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-sm whitespace-nowrap">
                        {isModified && edit.dueDate !== toDateInput(m.dueDate) ? (
                          <>
                            <span className="block text-[11px] line-through text-[#5A5750]">{m.dueDate ? formatDate(m.dueDate) : "—"}</span>
                            <span className="text-orange-700">{formatDate(edit.dueDate)}</span>
                          </>
                        ) : wasCountered && m.originalDueDate ? (
                          <>
                            <span className="block text-[11px] line-through text-[#5A5750]">{formatDate(m.originalDueDate)}</span>
                            <span className="text-orange-700">{m.dueDate ? formatDate(m.dueDate) : "—"}</span>
                          </>
                        ) : (
                          m.dueDate ? formatDate(m.dueDate) : "—"
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="text-xs font-medium">{m.executionRate}%</span>
                      </td>
                      {awaitingClientAction && (
                        <td className="px-3 py-3 align-top">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => openCounterModal(m.id)}
                              title="Proposer une modification"
                              className="w-7 h-7 rounded-md border border-[#E2E0D9] bg-white flex items-center justify-center text-xs text-[#5A5750] hover:border-orange-500"
                            >
                              ✎
                            </button>
                            {isModified && (
                              <button
                                onClick={() => resetMilestoneEdit(m.id)}
                                title="Rétablir l'original"
                                className="w-7 h-7 rounded-md border border-[#E2E0D9] bg-white flex items-center justify-center text-xs text-[#5A5750] hover:border-green-600"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-mono text-sm">
                  <td colSpan={awaitingClientAction ? 3 : 2} className="px-3 py-3 border-t-2 border-[#1A1916] text-right text-[#5A5750] font-semibold font-sans">
                    Montant total
                  </td>
                  <td className="px-3 py-3 border-t-2 border-[#1A1916] text-right font-bold">
                    {anyModified ? (
                      <>
                        <span className="block text-[11px] line-through font-normal text-[#5A5750]">{fmtEuro(offer.totalBudget ?? grandTotal)}</span>
                        <span>{fmtEuro(currentTotal)}</span>
                      </>
                    ) : (
                      fmtEuro(offer.totalBudget ?? grandTotal)
                    )}
                  </td>
                  <td className="border-t-2 border-[#1A1916]" colSpan={awaitingClientAction ? 1 : 1}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Message pour le freelance (si c'est votre tour de répondre) ── */}
      {awaitingClientAction && (
        <div className="mb-7">
          <p className="text-xs uppercase tracking-wider text-[#5A5750] font-semibold mb-3">
            Message pour le freelance
          </p>
          <div className="bg-white border border-[#E2E0D9] rounded-xl p-5">
            <textarea
              value={counterNoteInput}
              onChange={(e) => setCounterNoteInput(e.target.value)}
              placeholder={`Ajoutez un commentaire pour ${getFreelancerName(offer.freelancer)} — par exemple pour justifier une contre-proposition…`}
              className="w-full min-h-[80px] resize-y bg-[#F4F3EF] border border-[#E2E0D9] rounded-lg p-3 text-sm text-[#1A1916] font-sans leading-relaxed focus:outline-none focus:border-orange-600 placeholder:text-[#9AA0A6]"
            />
          </div>
        </div>
      )}

      {/* ── Actions (uniquement si en attente) ── */}
      {isPending && (
        <div className="sticky bottom-0 flex items-center justify-between bg-white border border-[#E2E0D9] rounded-xl p-4 mt-2 shadow-[0_-8px_24px_rgba(20,33,61,0.06)]">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#5A5750] font-semibold">
              {offer.offerType === "FIXED" ? "Montant total" : "Taux horaire"}
            </p>
            <p className="font-serif text-xl font-medium">
              {offer.offerType === "FIXED"
                ? fmtEuro(offer.totalBudget)
                : `${fmtEuro(offer.hourlyRate)}/h`
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/client/candidatures?mission=${offer.mission.id}`}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#E2E0D9] bg-white text-[#1A1916] hover:bg-gray-50 transition-all"
            >
              Voir la candidature
            </Link>
            <button
              onClick={() => setWithdrawOpen(true)}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 transition-all disabled:opacity-40"
            >
              Retirer l&apos;offre
            </button>
          </div>
        </div>
      )}

      {/* ── Actions (contre-proposition reçue ─ accepter, refuser ou re-négocier) ── */}
      {awaitingClientAction && (
        <div className="sticky bottom-0 flex items-center justify-between bg-white border border-[#E2E0D9] rounded-xl p-4 mt-2 shadow-[0_-8px_24px_rgba(20,33,61,0.06)]">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#5A5750] font-semibold">
              {anyModified ? "Votre contre-proposition" : "Montant proposé"}
            </p>
            <p className="font-serif text-xl font-medium">
              {offer.offerType === "FIXED" ? (
                anyModified ? (
                  <>
                    <span className="text-xs font-mono line-through mr-1.5 text-[#5A5750]">{fmtEuro(offer.totalBudget)}</span>
                    {fmtEuro(currentTotal)}
                  </>
                ) : fmtEuro(offer.totalBudget)
              ) : (
                `${fmtEuro(offer.hourlyRate)}/h`
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWithdrawOpen(true)}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 transition-all disabled:opacity-40"
            >
              Refuser
            </button>
            {offer.offerType === "FIXED" && (
              <button
                onClick={handleSendCounter}
                disabled={actionLoading || !anyModified}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 transition-all disabled:opacity-40"
              >
                {remainingRounds > 0 ? "Envoyer ma contre-proposition" : "Envoyer (refus auto si envoyée)"}
              </button>
            )}
            <button
              onClick={handleAcceptCounter}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-700 text-white border border-green-700 hover:bg-green-800 transition-all disabled:opacity-40 inline-flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Traitement…
                </>
              ) : (
                "Accepter la contre-proposition"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── En attente de la réponse du freelance (votre contre-proposition a été envoyée) ── */}
      {awaitingFreelanceResponse && (
        <div className="bg-white border border-[#E2E0D9] rounded-xl p-4">
          <Link
            href={`/dashboard/client/candidatures?mission=${offer.mission.id}`}
            className="inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-all"
          >
            Voir la candidature associée
          </Link>
        </div>
      )}

      {/* ── Actions pour offres terminales ── */}
      {isTerminal && (
        <div className="bg-white border border-[#E2E0D9] rounded-xl p-4">
          <Link
            href={`/dashboard/client/candidatures?mission=${offer.mission.id}`}
            className="inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-all"
          >
            Voir la candidature associée
          </Link>
        </div>
      )}

      {/* ── MODAL: Contre-proposition sur un jalon ── */}
      {counterModalId && editingMilestone && (
        <div
          className="fixed inset-0 bg-black/35 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) closeCounterModal(); }}
        >
          <div className="bg-white rounded-xl w-[420px] max-w-[90vw] shadow-[0_20px_60px_rgba(20,33,61,0.25)]">
            <div className="flex items-center gap-3.5 px-6 py-5 border-b border-[#E2E0D9]">
              <div>
                <p className="font-serif text-lg font-medium">Proposer une modification</p>
                <p className="text-xs text-[#5A5750] mt-0.5">{editingMilestone.title}</p>
              </div>
              <button
                onClick={closeCounterModal}
                className="ml-auto w-7 h-7 rounded-full border border-[#E2E0D9] bg-white flex items-center justify-center text-xs text-[#5A5750] flex-shrink-0 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Montant proposé (€)</label>
                <input
                  type="number" min={0} step={10}
                  value={cAmount}
                  onChange={(e) => setCAmount(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2.5 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Date limite proposée</label>
                <input
                  type="date"
                  value={cDueDate}
                  onChange={(e) => setCDueDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2.5 text-sm focus:outline-none"
                />
              </div>
              <div className="text-xs text-[#5A5750]">
                Montant actuel : {fmtEuro(editingMilestone.amount)}
                {editingMilestone.dueDate ? ` · Délai actuel : ${formatDate(editingMilestone.dueDate)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-6 py-4 border-t border-[#E2E0D9]">
              <button
                onClick={() => { resetMilestoneEdit(editingMilestone.id); closeCounterModal(); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#E2E0D9] bg-white text-[#1A1916] hover:bg-gray-50 transition-all"
              >
                Rétablir l&apos;original
              </button>
              <button
                onClick={closeCounterModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#E2E0D9] bg-white text-[#1A1916] hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={applyCounterModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto transition-all bg-orange-600 hover:bg-orange-700"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Retirer / Refuser la contre-proposition ── */}
      {withdrawOpen && (
        <div
          className="fixed inset-0 bg-black/35 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setWithdrawOpen(false); }}
        >
          <div className="bg-white rounded-xl w-[420px] max-w-[90vw] shadow-[0_20px_60px_rgba(20,33,61,0.25)]">
            <div className="flex items-center gap-3.5 px-6 py-5 border-b border-[#E2E0D9]">
              <div>
                <p className="font-serif text-lg font-medium">
                  {awaitingClientAction ? "Refuser la contre-proposition" : "Retirer l'offre"}
                </p>
                <p className="text-xs text-[#5A5750] mt-0.5">
                  {awaitingClientAction
                    ? "Un motif aide le freelance à comprendre votre décision"
                    : "Cette action informera le freelance que l'offre n'est plus valable"}
                </p>
              </div>
              <button
                onClick={() => setWithdrawOpen(false)}
                className="ml-auto w-7 h-7 rounded-full border border-[#E2E0D9] bg-white flex items-center justify-center text-xs text-[#5A5750] flex-shrink-0 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold text-[#5A5750] mb-1.5">Motif (optionnel)</label>
              <textarea
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder={awaitingClientAction ? "Ex. Le nouveau montant dépasse notre budget…" : "Ex. Nous avons trouvé un autre profil plus adapté…"}
                className="w-full min-h-[80px] resize-y bg-white border border-[#E2E0D9] rounded-lg p-3 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex items-center gap-2.5 px-6 py-4 border-t border-[#E2E0D9]">
              <button
                onClick={() => setWithdrawOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#E2E0D9] bg-white text-[#1A1916] hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={awaitingClientAction ? handleDeclineCounter : handleWithdraw}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white border border-red-600 ml-auto hover:bg-red-700 transition-all disabled:opacity-40 inline-flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Traitement…
                  </>
                ) : awaitingClientAction ? (
                  "Confirmer le refus"
                ) : (
                  "Confirmer le retrait"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
