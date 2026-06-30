"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TimeTracker, FileUploader } from "@/lib/dynamic-imports";
import { ChatBox } from "@/components/chat/chat-box";
import { GoogleMeetButton } from "@/components/chat/google-meet-button";

interface ContractData {
  id: string; missionTitle: string; clientName: string; clientId: string;
  status: string; escrowAmount?: number; escrowId?: string;
  missionId?: string; createdAt?: string;
}

interface MilestoneData {
  id: string; title: string; description: string; amount: number;
  status: string; dueDate: string; completedAt?: string;
}

interface PaymentData {
  id: string; type: string; amount: number; currency: string;
  status: string; createdAt: string;
}

type TabId = "overview" | "chat" | "files" | "meetings" | "milestones" | "contract" | "payments" | "activity";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "📋 Aperçu" },
  { id: "chat", label: "💬 Chat" },
  { id: "files", label: "📎 Fichiers" },
  { id: "meetings", label: "📹 Réunions" },
  { id: "milestones", label: "🏁 Jalons" },
  { id: "contract", label: "📝 Contrat" },
  { id: "payments", label: "💰 Paiements" },
  { id: "activity", label: "📊 Activité" },
];

export default function WorkRoomPage() {
  const params = useParams();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    const load = async () => {
      const authRes = await fetch("/api/auth/me");
      if (authRes.ok) {
        const authData = await authRes.json();
        setCurrentUser(authData.user);
      }

      const [cRes, mRes, pRes] = await Promise.all([
        fetch("/api/contracts"),
        fetch(`/api/contracts/${params.id}/milestones`),
        fetch(`/api/payments?contractId=${params.id}`),
      ]);

      const contracts = cRes.ok ? await cRes.json() : [];
      const list = Array.isArray(contracts) ? contracts : (contracts.data ?? []);
      setContract(list.find((c: { id: string }) => c.id === params.id) || null);

      const ms = mRes.ok ? await mRes.json() : [];
      setMilestones(Array.isArray(ms) ? ms : []);

      const ps = pRes.ok ? await pRes.json() : [];
      setPayments(Array.isArray(ps) ? ps : (ps.data ?? []));
    };
    load();
  }, [params.id]);

  const handleDeclineContract = async () => {
    if (!confirm("Êtes-vous sûr de vouloir refuser ce contrat ?")) return;
    setDeclining(true);
    try {
      // Trouver la candidature associée via l'applicationId dans le titre de la conversation
      const res = await fetch(`/api/contracts/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DECLINED" }),
      });
      if (res.ok) {
        setContract((prev) => prev ? { ...prev, status: "DECLINED" } : null);
      }
    } catch { /* ignore */ }
    setDeclining(false);
  };

  if (!contract) {
    return <div className="text-center py-12 text-[#5A5750]">Chargement...</div>;
  }

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      PENDING: "bg-yellow-100 text-yellow-700",
      DECLINED: "bg-red-100 text-red-700",
      COMPLETED: "bg-blue-100 text-blue-700",
      DISPUTED: "bg-red-100 text-red-700",
    };
    return colors[s] || "bg-[#F5F5F0] text-[#5A5750]";
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const formatCurrency = (amount?: number) =>
    amount ? `${amount.toLocaleString()} €` : "—";

  return (
    <div className="max-w-5xl">
      {/* En-tête avec toutes les infos */}
      <div className="rounded-xl border border-[#E2E0D9] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold">{contract.missionTitle}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor(contract.status)}`}>
                {contract.status === "PENDING" ? "En attente" : contract.status === "DECLINED" ? "Refusé" : contract.status}
              </span>
            </div>
            <p className="text-sm text-[#5A5750] mt-1">Client : {contract.clientName}</p>
          </div>
          <div className="flex items-center gap-3">
            {contract.status === "PENDING" && (
              <button
                onClick={handleDeclineContract}
                disabled={declining}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {declining ? "..." : "❌ Refuser le contrat"}
              </button>
            )}
            <div className="text-right">
              <p className="text-xl font-bold text-[#2D5BE3]">{formatCurrency(contract.escrowAmount)}</p>
              <p className="text-xs text-[#5A5750]">
                Créé le {formatDate(contract.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-lg bg-[#F5F5F0] p-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white shadow-sm"
                : "text-[#5A5750] hover:text-[#1A1916]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ─────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#E2E0D9] p-5">
              <p className="text-sm text-[#5A5750]">Statut</p>
              <p className="mt-1 text-lg font-semibold capitalize">{contract.status.toLowerCase()}</p>
            </div>
            <div className="rounded-xl border border-[#E2E0D9] p-5">
              <p className="text-sm text-[#5A5750]">Montant total</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(contract.escrowAmount)}</p>
            </div>
            <div className="rounded-xl border border-[#E2E0D9] p-5">
              <p className="text-sm text-[#5A5750]">Escrow ID</p>
              <p className="mt-1 text-lg font-semibold font-mono text-xs">{contract.escrowId || "—"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E0D9] p-6">
            <h3 className="font-semibold mb-3">📋 Détails du contrat</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#5A5750]">Client</span>
                <p className="font-medium">{contract.clientName}</p>
              </div>
              <div>
                <span className="text-[#5A5750]">Date de création</span>
                <p className="font-medium">{formatDate(contract.createdAt)}</p>
              </div>
              <div>
                <span className="text-[#5A5750]">Statut</span>
                <p className="font-medium capitalize">{contract.status.toLowerCase()}</p>
              </div>
              <div>
                <span className="text-[#5A5750]">Fonds</span>
                <p className="font-medium text-green-600">🔒 Séquestrés (TrustEngine + Stripe)</p>
              </div>
            </div>
          </div>

          <TimeTracker contractId={params.id as string} />
        </div>
      )}

      {/* ─── CHAT ─────────────── */}
      {activeTab === "chat" && (
        <ChatBox
          contractId={params.id as string}
          currentUserId={currentUser?.id || "guest"}
          currentUserName={currentUser?.name || "Freelancer"}
          otherPartyName={contract.clientName}
        />
      )}

      {/* ─── FILES ─────────────── */}
      {activeTab === "files" && <FileUploader contractId={params.id as string} />}

      {/* ─── MEETINGS ─────────────── */}
      {activeTab === "meetings" && (
        <div className="space-y-4">
          <GoogleMeetButton
            meetingTitle={`${contract.missionTitle} — ${contract.clientName}`}
            duration={30}
          />
        </div>
      )}

      {/* ─── MILESTONES ─────────────── */}
      {activeTab === "milestones" && (
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <h3 className="font-semibold mb-4">🏁 Jalons & Paiements</h3>
          {milestones.length === 0 ? (
            <p className="text-sm text-[#5A5750] text-center py-8">
              Aucun jalon défini pour ce contrat.
            </p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="rounded-lg border border-[#E2E0D9] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-[#5A5750]">{m.description}</p>
                    </div>
                    <span className="font-semibold text-[#2D5BE3]">{m.amount} €</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "APPROVED" || m.status === "RELEASED"
                        ? "bg-green-100 text-green-700"
                        : m.status === "IN_REVIEW"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-[#F5F5F0] text-[#5A5750]"
                    }`}>
                      {m.status === "APPROVED" ? "✅ Validé" :
                       m.status === "RELEASED" ? "💰 Libéré" :
                       m.status === "IN_REVIEW" ? "🔄 En révision" :
                       "⏳ En attente"}
                    </span>
                    <span className="text-xs text-[#5A5750]">
                      Échéance: {new Date(m.dueDate).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── CONTRACT ─────────────── */}
      {activeTab === "contract" && (
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <h3 className="font-semibold mb-4">📝 Termes du contrat</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#5A5750] uppercase tracking-wide">Parties</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-sm font-bold text-blue-700">
                      {contract.clientName?.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{contract.clientName}</p>
                      <p className="text-xs text-[#5A5750]">Client</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-sm font-bold text-green-700">
                      {currentUser?.name?.charAt(0) || "F"}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{currentUser?.name || "Freelancer"}</p>
                      <p className="text-xs text-[#5A5750]">Freelancer</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-[#5A5750] uppercase tracking-wide">Montant & Escrow</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Montant total</span>
                    <span className="font-semibold">{formatCurrency(contract.escrowAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Fonds</span>
                    <span className="font-medium text-green-600">🔒 Séquestrés</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Escrow ID</span>
                    <span className="font-mono text-xs">{contract.escrowId || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-[#5A5750] uppercase tracking-wide">Statut & Dates</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Statut</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Créé le</span>
                    <span>{formatDate(contract.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Mission ID</span>
                    <span className="font-mono text-xs">{contract.missionId || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Contrat ID</span>
                    <span className="font-mono text-xs">{contract.id}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-[#F5F5F0]/50 p-4">
                <p className="text-xs text-[#5A5750]">🔐 Sécurité</p>
                <p className="mt-1 text-sm">
                  Les fonds sont sécurisés via <strong>TrustEngine</strong> et <strong>Stripe Connect</strong>.
                  Les paiements sont libérés automatiquement à l&apos;approbation des jalons.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENTS ─────────────── */}
      {activeTab === "payments" && (
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <h3 className="font-semibold mb-4">💰 Historique des paiements</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-[#5A5750] text-center py-8">
              Aucun paiement enregistré pour ce contrat.
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => {
                const typeLabels: Record<string, string> = {
                  DEPOSIT: "Dépôt escrow",
                  RELEASE: "Libération",
                  PAYOUT: "Virement",
                  REFUND: "Remboursement",
                };
                const statusColors: Record<string, string> = {
                  SUCCEEDED: "text-green-600",
                  PENDING: "text-yellow-600",
                  FAILED: "text-red-600",
                };
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#F5F5F0]/30 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#5A5750]">{p.id}</span>
                      <span>{typeLabels[p.type] || p.type}</span>
                      <span className={`text-xs font-medium ${statusColors[p.status] || "text-[#5A5750]"}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{p.amount.toLocaleString()} {p.currency}</span>
                      <p className="text-xs text-[#5A5750]">{formatDate(p.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── ACTIVITY ─────────────── */}
      {activeTab === "activity" && (
        <div className="rounded-xl border border-[#E2E0D9] p-6">
          <h3 className="font-semibold mb-4">📊 Activité récente</h3>
          {payments.length === 0 && milestones.length === 0 ? (
            <p className="text-sm text-[#5A5750] text-center py-8">
              Aucune activité pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Timeline */}
              <div className="relative pl-6 border-l-2 border-[#E2E0D9] space-y-4">
                {[...milestones, ...payments]
                  .sort((a, b) => {
                    const dateA = "createdAt" in a ? a.createdAt : a.dueDate;
                    const dateB = "createdAt" in b ? b.createdAt : b.dueDate;
                    return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime();
                  })
                  .slice(0, 10)
                  .map((item, i) => {
                    const isMilestone = "title" in item && "description" in item;
                    const date = isMilestone
                      ? (item as MilestoneData).dueDate
                      : (item as PaymentData).createdAt;
                    const label = isMilestone
                      ? `🏁 Jalon : ${(item as MilestoneData).title} — ${(item as MilestoneData).status}`
                      : `💰 Paiement : ${(item as PaymentData).type} — ${(item as PaymentData).amount.toLocaleString()} €`;
                    return (
                      <div key={i} className="relative">
                        <div className="absolute -left-[25px] mt-1.5 h-3 w-3 rounded-full bg-[#2D5BE3]" />
                        <p className="text-sm">{label}</p>
                        <p className="text-xs text-[#5A5750]">{formatDate(date)}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
