"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, StatCard } from "@/components/dashboard/ui";

// ── Design tokens — alignés sur la charte principale du dashboard ─────────
// (neutres + typographie unifiés ; sémantique conservée aux teintes de la charte)
const INK = "#1A1916";
const PAPER = "#FAFAF8";
const LINE = "#E2E0D9";
const GREEN = "#0F6E56";
const GREEN_SOFT = "#E1F5EE";
const AMBER = "#854F0B";
const AMBER_SOFT = "#FAEEDA";
const RED = "#A32D2D";
const RED_SOFT = "#FCEBEB";
const MUTED = "#5A5750";

// Typographie harmonisée : plus de serif éditorial, on suit la police du dashboard
const FONT_SERIF = "var(--font-inter, Inter, sans-serif)";
const FONT_MONO = "var(--font-ibm-plex-mono, monospace)";
const FONT_SANS = "var(--font-inter, Inter, sans-serif)";

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
  client: {
    id: string;
    userId: string;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
    companyName: string | null;
  };
  applicationStatus: string;
}

type ViewMode = "list" | "detail";

/** Nombre maximum d'échanges de négociation autorisés (contre-propositions) avant refus automatique. */
const MAX_NEGOTIATION_ROUNDS = 3;

const STATUS_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  SENT:      { label: "En attente de réponse",      bg: AMBER_SOFT, fg: AMBER },
  COUNTERED: { label: "Contre-proposition envoyée",  bg: AMBER_SOFT, fg: AMBER },
  ACCEPTED:  { label: "Acceptée",                    bg: GREEN_SOFT, fg: GREEN },
  DECLINED:  { label: "Déclinée",                    bg: RED_SOFT,   fg: RED },
  EXPIRED:   { label: "Expirée",                     bg: "#F0F0EE",  fg: MUTED },
  WITHDRAWN: { label: "Retirée par le client",       bg: "#F0F0EE",  fg: MUTED },
  DRAFT:     { label: "Brouillon",                   bg: "#EAECF3",  fg: "#4A5178" },
};

// ── Helpers ──────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
function fmtEuro(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR") + " €";
}
function getClientInitials(client: OfferData["client"]): string {
  const fn = client.firstName?.[0] ?? "";
  const ln = client.lastName?.[0] ?? "";
  return (fn + ln).toUpperCase() || "C";
}
function getClientName(client: OfferData["client"]): string {
  return client.companyName
    ? `${client.companyName}`
    : `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Client";
}

// Édition locale d'un jalon avant envoi de la contre-proposition
interface MilestoneEdit {
  amount: number;
  dueDate: string; // "YYYY-MM-DD"
  modified: boolean;
}

// ── Page principale ─────────────────────────
export default function FreelancerOffresPage() {
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Détail
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedOffer, setSelectedOffer] = useState<OfferData | null>(null);

  // États locaux pour l'interaction
  const [responseNote, setResponseNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Contre-proposition (jalons)
  const [milestoneEdits, setMilestoneEdits] = useState<Record<string, MilestoneEdit>>({});
  const [counterModalId, setCounterModalId] = useState<string | null>(null);
  const [cAmount, setCAmount] = useState<string>("");
  const [cDueDate, setCDueDate] = useState<string>("");

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Chargement des offres
  const loadOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/offers/freelancer");
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json = await res.json();
      setOffers(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("Erreur chargement offres:", err);
      setError("Impossible de charger les offres. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  // ── Actions sur une offre ──
  const handleAccept = useCallback(async () => {
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
      alert("Erreur lors de l'acceptation de l'offre.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, loadOffers]);

  const handleDecline = useCallback(async () => {
    if (!selectedOffer) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/offers/${selectedOffer.id}?action=decline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason || "Offre déclinée" }),
      });
      if (!res.ok) throw new Error("Erreur lors du refus");
      await loadOffers();
      setSelectedOffer((prev) =>
        prev ? { ...prev, status: "DECLINED", declinedAt: new Date().toISOString(), declineReason } : prev
      );
      setDeclineOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du refus de l'offre.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, declineReason, loadOffers]);

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
        body: JSON.stringify({ milestones: updates, note: responseNote || undefined }),
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
          prev ? { ...prev, status: "COUNTERED", counteredAt: new Date().toISOString(), negotiationRounds: (prev.negotiationRounds ?? 0) + 1, lastCounterBy: "FREELANCER" } : prev
        );
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de la contre-proposition.");
    } finally {
      setActionLoading(false);
    }
  }, [selectedOffer, milestoneEdits, responseNote, loadOffers]);

  const openDetail = useCallback((offer: OfferData) => {
    setSelectedOffer(offer);
    setDeclineReason("");
    setResponseNote("");
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
    setDeclineOpen(false);
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

  // Données filtrées (calculées à chaque render, après tous les hooks)
  const filteredOffers = offers.filter((offer) => {
    if (statusFilter !== "ALL" && offer.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = offer.title.toLowerCase().includes(q);
      const matchClient = getClientName(offer.client).toLowerCase().includes(q);
      const matchMission = offer.mission.title.toLowerCase().includes(q);
      if (!matchTitle && !matchClient && !matchMission) return false;
    }
    return true;
  });

  const stats = {
    total: offers.length,
    enAttente: offers.filter((o) => o.status === "SENT").length,
    acceptees: offers.filter((o) => o.status === "ACCEPTED").length,
    termine: offers.filter((o) => ["DECLINED", "EXPIRED", "WITHDRAWN"].includes(o.status)).length,
  };

  // ── Render: chargement ──
  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto py-10 px-4 sm:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 rounded-xl w-48" style={{ background: "#EDEDE7" }} />
          <div className="h-24 rounded-xl" style={{ background: "#EDEDE7" }} />
          <div className="h-24 rounded-xl" style={{ background: "#EDEDE7" }} />
          <div className="h-24 rounded-xl" style={{ background: "#EDEDE7" }} />
        </div>
      </div>
    );
  }

  // ── Render: erreur ──
  if (error) {
    return (
      <div className="max-w-[900px] mx-auto py-10 px-4 sm:px-8">
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: RED_SOFT, background: RED_SOFT }}>
          <p className="text-lg mb-2">⚠️</p>
          <p className="font-medium" style={{ color: RED }}>{error}</p>
          <button
            onClick={loadOffers}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: RED }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── Render: liste ──
  if (viewMode === "list") {
    return (
      <div className="max-w-[1000px] mx-auto py-10 px-4 sm:px-8 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ fontFamily: FONT_SANS, color: INK }}>
        <div className="mb-6">
          <PageHeader
            eyebrow={<span className="uppercase tracking-[0.08em] text-[#1F7A5C]">Offres reçues</span>}
            title="Mes offres reçues"
            subtitle="Consultez et gérez les offres envoyées par les clients."
          />
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
          <StatCard label="Total reçues" value={stats.total} icon="📨" tone="blue" />
          <StatCard label="En attente" value={stats.enAttente} icon="⏳" tone="amber" />
          <StatCard label="Acceptées" value={stats.acceptees} icon="✅" tone="green" />
          <StatCard label="Clôturées" value={stats.termine} icon="📁" tone="neutral" />
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, client, mission..."
              className="w-full rounded-lg border bg-white px-3 py-2 pl-9 text-sm focus:outline-none"
              style={{ borderColor: LINE }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: MUTED }}>🔍</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: LINE }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="SENT">En attente de réponse</option>
            <option value="COUNTERED">Contre-proposition envoyée</option>
            <option value="ACCEPTED">Acceptées</option>
            <option value="DECLINED">Refusées</option>
            <option value="EXPIRED">Expirées</option>
            <option value="WITHDRAWN">Retirées par le client</option>
          </select>
        </div>

        {filteredOffers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center" style={{ borderColor: LINE }}>
            <p className="text-3xl mb-3">📨</p>
            <h3 className="font-semibold text-lg">
              {offers.length === 0 ? "Aucune offre reçue" : "Aucune offre ne correspond aux filtres"}
            </h3>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              {offers.length === 0
                ? "Les offres apparaîtront ici lorsqu'un client vous enverra une proposition."
                : "Essayez de modifier vos filtres de recherche."}
            </p>
            {offers.length === 0 && (
              <Link
                href="/dashboard/freelancer/recherche"
                className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                style={{ background: GREEN }}
              >
                Parcourir les missions
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
                  className="w-full text-left rounded-xl border p-5 bg-white hover:shadow-sm transition-all"
                  style={{ borderColor: LINE }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{offer.title}</p>
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ fontFamily: FONT_MONO, background: cfg.bg, color: cfg.fg }}
                        >
                          {cfg.label}
                        </span>
                        {isExpired && offer.status === "SENT" && (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: RED_SOFT, color: RED }}>Expirée</span>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: MUTED }}>
                        De <b style={{ color: INK }}>{getClientName(offer.client)}</b>
                        {offer.mission.title ? ` · ${offer.mission.title}` : ""}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                        Reçue le {formatDate(offer.sentAt ?? offer.createdAt)}
                        {offer.expiresAt && new Date(offer.expiresAt) > new Date()
                          ? ` · Expire le ${formatDate(offer.expiresAt)}`
                          : ""}
                        {offer.status === "ACCEPTED" && offer.acceptedAt
                          ? ` · Acceptée le ${formatDate(offer.acceptedAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-lg font-bold" style={{ fontFamily: FONT_MONO, color: GREEN }}>
                        {offer.offerType === "FIXED"
                          ? fmtEuro(offer.totalBudget)
                          : `${fmtEuro(offer.hourlyRate)}/h`}
                      </p>
                      <p className="text-xs" style={{ color: MUTED }}>
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
  const isExpiredNow = !!(offer.expiresAt && new Date(offer.expiresAt) < new Date());
  const isCountered = offer.status === "COUNTERED";
  // Le client a contre-proposé en dernier (ou offre initiale non expirée) → à vous de répondre
  const awaitingFreelance = (offer.status === "SENT" && !isExpiredNow) || (isCountered && offer.lastCounterBy === "CLIENT");
  // Vous avez contre-proposé en dernier → en attente de la réponse du client
  const awaitingClient = isCountered && offer.lastCounterBy === "FREELANCER";
  const isAccepted = offer.status === "ACCEPTED";
  const isDeclined = offer.status === "DECLINED";
  const isWithdrawn = offer.status === "WITHDRAWN";
  const milestones = offer.milestones;

  const negotiationRounds = offer.negotiationRounds ?? 0;
  const remainingRounds = Math.max(0, MAX_NEGOTIATION_ROUNDS - negotiationRounds);
  const anyModified = Object.values(milestoneEdits).some((e) => e.modified);
  const currentTotal = offer.offerType === "FIXED"
    ? milestones.reduce((s, m) => s + (milestoneEdits[m.id]?.amount ?? m.amount), 0)
    : (offer.hourlyRate ?? 0);
  const originalTotal = offer.offerType === "FIXED"
    ? milestones.reduce((s, m) => s + m.amount, 0)
    : (offer.hourlyRate ?? 0);

  const editingMilestone = counterModalId
    ? milestones.find((m) => m.id === counterModalId)
    : null;

  return (
    <div className="max-w-[900px] mx-auto py-10 px-4 sm:px-8 pb-24" style={{ fontFamily: FONT_SANS, color: INK }}>
      {/* Bouton retour */}
      <button
        onClick={backToList}
        className="mb-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-all"
        style={{ color: MUTED }}
      >
        ← Toutes les offres
      </button>

      {/* ── HEADER ── */}
      <div className="flex items-start gap-4 p-6 bg-white border rounded-xl mb-7" style={{ borderColor: LINE }}>
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0"
          style={{ width: 52, height: 52, background: INK, color: "#EDEFF5", fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 500 }}
        >
          {getClientInitials(offer.client)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-1.5" style={{ fontFamily: FONT_MONO, color: GREEN }}>
            Offre reçue · {offer.mission.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="text-[22px] leading-tight tracking-tight m-0 mb-1" style={{ fontFamily: FONT_SERIF, fontWeight: 500 }}>
            {offer.title}
          </h1>
          <p className="text-sm" style={{ color: MUTED }}>
            De <b style={{ color: INK }}>{getClientName(offer.client)}</b> ·{" "}
            {offer.offerType === "FIXED" ? "Prix fixe" : "Taux horaire"} · reçue le{" "}
            {formatDate(offer.sentAt ?? offer.createdAt)}
          </p>
        </div>
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
          style={{
            fontFamily: FONT_MONO,
            background: isExpiredNow && offer.status === "SENT" ? RED_SOFT : cfg.bg,
            color: isExpiredNow && offer.status === "SENT" ? RED : cfg.fg,
          }}
        >
          {isExpiredNow && offer.status === "SENT" ? "Expirée" : cfg.label}
        </span>
      </div>

      {/* ── RÉSULTAT: Acceptée ── */}
      {isAccepted && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl text-white mb-6" style={{ background: GREEN }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">✓</div>
          <div>
            <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Offre acceptée</p>
            <p className="text-xs opacity-85 mt-0.5">
              {offer.acceptedAt ? `Acceptée le ${formatDate(offer.acceptedAt)}. ` : ""}
              Le contrat va être généré — vous recevrez une notification dès qu&apos;il sera actif.
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Contre-proposition envoyée (en attente du client) ── */}
      {awaitingClient && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl text-white mb-6" style={{ background: AMBER }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">↔</div>
          <div>
            <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Contre-proposition envoyée</p>
            <p className="text-xs opacity-85 mt-0.5">
              {getClientName(offer.client)} va examiner vos modifications et vous répondra prochainement.
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Contre-proposition du client reçue (à votre tour de répondre) ── */}
      {awaitingFreelance && isCountered && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl text-white mb-6" style={{ background: AMBER }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">↔</div>
          <div>
            <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Contre-proposition du client reçue</p>
            <p className="text-xs opacity-85 mt-0.5">
              {getClientName(offer.client)} a proposé des modifications — à vous de répondre.
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Déclinée ── */}
      {isDeclined && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl text-white mb-6" style={{ background: RED }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">✕</div>
          <div>
            <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Offre déclinée</p>
            <p className="text-xs opacity-85 mt-0.5">
              {offer.declineReason
                ? `Motif : « ${offer.declineReason} »`
                : `${getClientName(offer.client)} a été informé de votre décision.`}
            </p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Retirée par le client ── */}
      {isWithdrawn && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl text-white mb-6" style={{ background: MUTED }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">✕</div>
          <div>
            <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Offre retirée</p>
            <p className="text-xs opacity-85 mt-0.5">{getClientName(offer.client)} a retiré cette offre.</p>
          </div>
        </div>
      )}

      {/* ── RÉSULTAT: Expirée ── */}
      {isExpiredNow && offer.status === "SENT" && (
        <div className="flex items-center gap-3.5 p-5 rounded-xl text-white mb-6" style={{ background: RED }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">⏰</div>
          <div>
            <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Offre expirée</p>
            <p className="text-xs opacity-85 mt-0.5">Le délai de réponse est dépassé.</p>
          </div>
        </div>
      )}

      {/* ── DÉTAILS DE LA MISSION ── */}
      <div className="mb-7">
        <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: MUTED }}>
          Détails de la mission
        </p>
        <div className="bg-white border rounded-xl" style={{ borderColor: LINE }}>
          <div className="flex gap-0 border rounded-lg w-fit ml-6 mt-5 overflow-hidden" style={{ borderColor: LINE }}>
            <span className="px-4 py-2 text-sm font-semibold" style={offer.offerType === "FIXED" ? { background: GREEN, color: "#fff" } : { color: MUTED }}>
              Prix fixe
            </span>
            <span className="px-4 py-2 text-sm font-semibold" style={offer.offerType === "HOURLY" ? { background: GREEN, color: "#fff" } : { color: MUTED }}>
              Taux horaire
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Description</label>
              <div className="rounded-lg px-3.5 py-2.5 text-sm min-h-[56px] border" style={{ background: PAPER, borderColor: LINE }}>
                {offer.description || offer.mission.description || "Aucune description fournie."}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Date de début souhaitée</label>
              <div className="rounded-lg px-3.5 py-2.5 text-sm border" style={{ background: PAPER, borderColor: LINE }}>
                {formatDate(offer.startDate)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Durée estimée</label>
              <div className="rounded-lg px-3.5 py-2.5 text-sm border" style={{ background: PAPER, borderColor: LINE }}>
                {offer.mission.duration || "Non spécifiée"}
              </div>
            </div>
            {offer.offerType === "HOURLY" && (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Taux horaire</label>
                  <div className="rounded-lg px-3.5 py-2.5 text-sm border" style={{ background: PAPER, borderColor: LINE }}>
                    {fmtEuro(offer.hourlyRate)}/h
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Limite hebdomadaire</label>
                  <div className="rounded-lg px-3.5 py-2.5 text-sm border" style={{ background: PAPER, borderColor: LINE }}>
                    {offer.weeklyHourLimit ? `${offer.weeklyHourLimit}h/semaine` : "Non spécifiée"}
                  </div>
                </div>
              </>
            )}
            {offer.endDate && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Date de fin</label>
                <div className="rounded-lg px-3.5 py-2.5 text-sm border" style={{ background: PAPER, borderColor: LINE }}>
                  {formatDate(offer.endDate)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── JALONS (FIXED uniquement) ── */}
      {offer.offerType === "FIXED" && milestones.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs uppercase tracking-wider font-semibold m-0" style={{ color: MUTED }}>
              Jalons proposés
            </h3>
            {awaitingFreelance && (
              <span className="text-xs" style={{ color: MUTED }}>Cliquez sur ✎ pour proposer un nouveau montant ou délai</span>
            )}
          </div>
          <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: LINE }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide font-semibold" style={{ color: MUTED }}>
                  <th className="px-3 py-2.5 border-b w-8" style={{ borderColor: LINE }}>#</th>
                  <th className="px-3 py-2.5 border-b" style={{ borderColor: LINE }}>Description</th>
                  <th className="px-3 py-2.5 border-b" style={{ borderColor: LINE }}>Montant</th>
                  <th className="px-3 py-2.5 border-b" style={{ borderColor: LINE }}>Délai / échéance</th>
                  <th className="px-3 py-2.5 border-b" style={{ borderColor: LINE }}>Exécution</th>
                  {awaitingFreelance && <th className="px-3 py-2.5 border-b" style={{ borderColor: LINE }}></th>}
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => {
                  const edit = milestoneEdits[m.id];
                  const isModified = !!edit?.modified;
                  const displayAmount = edit ? edit.amount : m.amount;
                  const wasCountered = !awaitingFreelance && m.originalAmount != null;
                  return (
                    <tr key={m.id} className="text-sm border-b last:border-b-0" style={{ borderColor: LINE }}>
                      <td className="px-3 py-3 font-mono align-top" style={{ color: MUTED }}>
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-3 align-top max-w-[260px]">
                        <span className="font-medium">{m.title}</span>
                        {m.description && (
                          <p className="text-xs mt-0.5" style={{ color: MUTED }}>{m.description}</p>
                        )}
                        {(isModified || wasCountered) && (
                          <span
                            className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ fontFamily: FONT_MONO, background: AMBER_SOFT, color: AMBER }}
                          >
                            Modifié
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right font-mono whitespace-nowrap">
                        {isModified ? (
                          <>
                            <span className="block text-[11px] line-through" style={{ color: MUTED }}>{fmtEuro(m.amount)}</span>
                            <span style={{ color: AMBER }}>{fmtEuro(displayAmount)}</span>
                          </>
                        ) : wasCountered ? (
                          <>
                            <span className="block text-[11px] line-through" style={{ color: MUTED }}>{fmtEuro(m.originalAmount)}</span>
                            <span style={{ color: AMBER }}>{fmtEuro(m.amount)}</span>
                          </>
                        ) : (
                          fmtEuro(displayAmount)
                        )}
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-sm whitespace-nowrap">
                        {isModified && edit.dueDate !== toDateInput(m.dueDate) ? (
                          <>
                            <span className="block text-[11px] line-through" style={{ color: MUTED }}>{m.dueDate ? formatDate(m.dueDate) : "—"}</span>
                            <span style={{ color: AMBER }}>{formatDate(edit.dueDate)}</span>
                          </>
                        ) : wasCountered && m.originalDueDate ? (
                          <>
                            <span className="block text-[11px] line-through" style={{ color: MUTED }}>{formatDate(m.originalDueDate)}</span>
                            <span style={{ color: AMBER }}>{m.dueDate ? formatDate(m.dueDate) : "—"}</span>
                          </>
                        ) : (
                          m.dueDate ? formatDate(m.dueDate) : "—"
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="text-xs font-medium">{m.executionRate}%</span>
                      </td>
                      {awaitingFreelance && (
                        <td className="px-3 py-3 align-top">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => openCounterModal(m.id)}
                              title="Proposer une modification"
                              className="w-7 h-7 rounded-md border bg-white flex items-center justify-center text-xs hover:border-amber-500"
                              style={{ borderColor: LINE, color: MUTED }}
                            >
                              ✎
                            </button>
                            {isModified && (
                              <button
                                onClick={() => resetMilestoneEdit(m.id)}
                                title="Rétablir l'original"
                                className="w-7 h-7 rounded-md border bg-white flex items-center justify-center text-xs hover:border-green-600"
                                style={{ borderColor: LINE, color: MUTED }}
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
                  <td colSpan={awaitingFreelance ? 3 : 2} className="px-3 py-3 border-t-2 text-right font-semibold font-sans" style={{ borderColor: INK, color: MUTED }}>
                    Montant total de l&apos;offre
                  </td>
                  <td className="px-3 py-3 border-t-2 text-right font-bold" style={{ borderColor: INK }}>
                    {anyModified ? (
                      <>
                        <span className="block text-[11px] line-through font-normal" style={{ color: MUTED }}>{fmtEuro(originalTotal)}</span>
                        <span>{fmtEuro(currentTotal)}</span>
                      </>
                    ) : (
                      fmtEuro(offer.totalBudget ?? currentTotal)
                    )}
                  </td>
                  <td className="border-t-2" style={{ borderColor: INK }} colSpan={awaitingFreelance ? 1 : 0}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Note du freelance déjà envoyée (offre contrée) ── */}
      {(awaitingClient || (isCountered && !awaitingFreelance)) && offer.counterNote && (
        <div className="mb-7">
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: MUTED }}>
            {offer.lastCounterBy === "FREELANCER" ? "Votre message" : "Message du client"}
          </p>
          <div className="bg-white border rounded-xl p-5 text-sm" style={{ borderColor: LINE }}>
            {offer.counterNote}
          </div>
        </div>
      )}

      {/* ── Avertissement : tentatives de négociation restantes ── */}
      {negotiationRounds > 0 && isCountered && (
        <div className="flex items-center gap-3 p-4 rounded-xl border mb-6" style={{ borderColor: "#F5CBA7", background: AMBER_SOFT }}>
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: AMBER }}>
              Négociation : {negotiationRounds}/{MAX_NEGOTIATION_ROUNDS} tentative(s) utilisée(s)
            </p>
            <p className="text-xs mt-0.5" style={{ color: AMBER }}>
              {remainingRounds > 0
                ? `${remainingRounds} tentative(s) restante(s) avant refus automatique de l'offre.`
                : "Aucune tentative restante — toute nouvelle contre-proposition entraînera un refus automatique."}
            </p>
          </div>
        </div>
      )}

      {/* ── Message (uniquement si en attente) ── */}
      {awaitingFreelance && (
        <div className="mb-7">
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: MUTED }}>
            Message pour le client
          </p>
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: LINE }}>
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder={`Ajoutez un commentaire pour ${getClientName(offer.client)} — par exemple pour justifier une contre-proposition, ou confirmer votre disponibilité…`}
              className="w-full min-h-[80px] resize-y rounded-lg p-3 text-sm leading-relaxed focus:outline-none border"
              style={{ background: PAPER, borderColor: LINE, fontFamily: FONT_SANS }}
            />
          </div>
        </div>
      )}

      {/* ── Actions (uniquement si en attente) ── */}
      {awaitingFreelance && (
        <div
          className="sticky bottom-0 flex items-center gap-3 bg-white border rounded-xl p-4 mt-2"
          style={{ borderColor: LINE, boxShadow: "0 -8px 24px rgba(20,33,61,0.06)" }}
        >
          <div className="mr-auto">
            <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: MUTED }}>
              Vous répondez avec
            </p>
            <p className="text-xl font-medium" style={{ fontFamily: FONT_SERIF }}>
              {offer.offerType === "FIXED" ? (
                anyModified ? (
                  <>
                    <span className="text-xs font-mono line-through mr-1.5" style={{ color: MUTED }}>{fmtEuro(originalTotal)}</span>
                    {fmtEuro(currentTotal)}
                  </>
                ) : fmtEuro(currentTotal)
              ) : (
                `${fmtEuro(offer.hourlyRate)}/h`
              )}
            </p>
          </div>
          <button
            onClick={() => setDeclineOpen(true)}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold border bg-white transition-all disabled:opacity-40"
            style={{ borderColor: LINE, color: RED }}
          >
            Décliner
          </button>
          {offer.offerType === "FIXED" && (
            <button
              onClick={handleSendCounter}
              disabled={actionLoading || !anyModified}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all disabled:opacity-40"
              style={{ borderColor: LINE, color: AMBER, background: "#fff" }}
            >
              {remainingRounds > 0 ? "Envoyer ma contre-proposition" : "Envoyer (refus auto si envoyée)"}
            </button>
          )}
          <button
            onClick={handleAccept}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 inline-flex items-center gap-2"
            style={{ background: GREEN }}
          >
            {actionLoading ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Traitement…
              </>
            ) : (
              "Accepter l'offre"
            )}
          </button>
        </div>
      )}

      {/* ── MODAL: Contre-proposition sur un jalon ── */}
      {counterModalId && editingMilestone && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(20,33,61,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCounterModal(); }}
        >
          <div className="bg-white rounded-xl w-[420px] max-w-[90vw]" style={{ boxShadow: "0 20px 60px rgba(20,33,61,0.25)" }}>
            <div className="flex items-center gap-3.5 px-6 py-5 border-b" style={{ borderColor: LINE }}>
              <div>
                <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Proposer une modification</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{editingMilestone.title}</p>
              </div>
              <button
                onClick={closeCounterModal}
                className="ml-auto w-7 h-7 rounded-full border bg-white flex items-center justify-center text-xs flex-shrink-0 hover:bg-gray-100"
                style={{ borderColor: LINE, color: MUTED }}
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Montant proposé (€)</label>
                <input
                  type="number" min={0} step={10}
                  value={cAmount}
                  onChange={(e) => setCAmount(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
                  style={{ borderColor: LINE }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Date limite proposée</label>
                <input
                  type="date"
                  value={cDueDate}
                  onChange={(e) => setCDueDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
                  style={{ borderColor: LINE }}
                />
              </div>
              <div className="text-xs" style={{ color: MUTED }}>
                Montant original : {fmtEuro(editingMilestone.amount)}
                {editingMilestone.dueDate ? ` · Délai original : ${formatDate(editingMilestone.dueDate)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-6 py-4 border-t" style={{ borderColor: LINE }}>
              <button
                onClick={() => { resetMilestoneEdit(editingMilestone.id); closeCounterModal(); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold border bg-white hover:bg-gray-50 transition-all"
                style={{ borderColor: LINE, color: INK }}
              >
                Rétablir l&apos;original
              </button>
              <button
                onClick={closeCounterModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold border bg-white hover:bg-gray-50 transition-all"
                style={{ borderColor: LINE, color: INK }}
              >
                Annuler
              </button>
              <button
                onClick={applyCounterModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto transition-all"
                style={{ background: AMBER }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Décliner ── */}
      {declineOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(20,33,61,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeclineOpen(false); }}
        >
          <div className="bg-white rounded-xl w-[420px] max-w-[90vw]" style={{ boxShadow: "0 20px 60px rgba(20,33,61,0.25)" }}>
            <div className="flex items-center gap-3.5 px-6 py-5 border-b" style={{ borderColor: LINE }}>
              <div>
                <p className="text-lg font-medium" style={{ fontFamily: FONT_SERIF }}>Décliner l&apos;offre</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  Un motif aide le client à comprendre votre décision
                </p>
              </div>
              <button
                onClick={() => setDeclineOpen(false)}
                className="ml-auto w-7 h-7 rounded-full border bg-white flex items-center justify-center text-xs flex-shrink-0 hover:bg-gray-100"
                style={{ borderColor: LINE, color: MUTED }}
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Motif (optionnel)</label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Ex. Le budget ne correspond pas à la charge de travail estimée…"
                className="w-full min-h-[80px] resize-y rounded-lg p-3 text-sm focus:outline-none border"
                style={{ borderColor: LINE }}
              />
            </div>
            <div className="flex items-center gap-2.5 px-6 py-4 border-t" style={{ borderColor: LINE }}>
              <button
                onClick={() => setDeclineOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border bg-white hover:bg-gray-50 transition-all"
                style={{ borderColor: LINE, color: INK }}
              >
                Annuler
              </button>
              <button
                onClick={handleDecline}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto transition-all disabled:opacity-40 inline-flex items-center gap-2"
                style={{ background: RED }}
              >
                {actionLoading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Traitement…
                  </>
                ) : (
                  "Confirmer le refus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
