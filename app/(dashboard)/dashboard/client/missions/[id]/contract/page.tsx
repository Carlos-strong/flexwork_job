"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatBox } from "@/components/chat/chat-box";
import { GoogleMeetButton } from "@/components/chat/google-meet-button";
import { FileUploader } from "@/lib/dynamic-imports";

interface ContractData {
  id: string; missionTitle: string; freelancerName: string; freelancerId: string;
  status: string; escrowAmount: number; escrowId?: string;
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

export default function ClientContractWorkroomPage() {
  const params = useParams();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [approving, setApproving] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async () => {
    try {
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

      const ct = cRes.ok ? await cRes.json() : [];
      const list = Array.isArray(ct) ? ct : (ct.data ?? []);
      const found = list.find((c: { id: string }) => c.id === params.id);
      if (found) {
        const ms = mRes.ok ? await mRes.json() : (found.milestones || []);
        setContract(found);
        setMilestones(Array.isArray(ms) ? ms : []);
      }

      const ps = pRes.ok ? await pRes.json() : [];
      setPayments(Array.isArray(ps) ? ps : (ps.data ?? []));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  const handleMilestoneAction = async (milestoneId: string, newStatus: string) => {
    setApproving(milestoneId);
    try {
      const res = await fetch(`/api/contracts/${params.id}/milestones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, status: newStatus }),
      });
      if (res.ok) await loadData();
    } catch {
      // ignore
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[#5A5750] animate-pulse">Chargement...</div>;
  }

  if (!contract) {
    return <div className="text-center py-12 text-[#5A5750]">Contrat introuvable.</div>;
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

  const activities = [
    ...milestones.map((m) => ({
      date: m.dueDate,
      label: `🏁 Jalon : ${m.title} — ${m.status === "APPROVED" ? "✅ Validé" : m.status === "IN_REVIEW" ? "🔄 En révision" : "⏳ En attente"}`,
    })),
    ...payments.map((p) => ({
      date: p.createdAt,
      label: `💰 ${p.type === "DEPOSIT" ? "Dépôt" : p.type === "RELEASE" ? "Libération" : p.type === "PAYOUT" ? "Virement" : p.type} — ${p.amount.toLocaleString()} € (${p.status})`,
    })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  return (
    <div className="max-w-5xl">
      {/* En-tête */}
      <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[22px] font-semibold text-[#1A1916]">{contract.missionTitle}</h2>
              <span className={`rounded-[20px] px-3 py-1 text-[12px] font-semibold ${statusColor(contract.status)}`}>
                {contract.status}
              </span>
            </div>
            <p className="text-[14px] text-[#5A5750] mt-1">
              Freelancer : <span className="font-medium text-[#1A1916]">{contract.freelancerName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {contract.status === "DECLINED" && (
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-[#5A5750]">Contrat refusé —</span>
                <a
                  href={`/dashboard/client/missions/${contract.missionId}`}
                  className="rounded-[10px] bg-[#2D5BE3] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors"
                >
                  👤 Choisir un autre candidat
                </a>
                <a
                  href={`/dashboard/client/missions/creation`}
                  className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors"
                >
                  📢 Republier la mission
                </a>
              </div>
            )}
            <div className="text-right">
              <p className="text-[20px] font-bold text-[#2D5BE3]">{formatCurrency(contract.escrowAmount)}</p>
              <p className="text-[12px] text-[#5A5750]">Créé le {formatDate(contract.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-[10px] bg-[#F5F5F0] p-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-[8px] px-3 py-2 text-[14px] font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white shadow-sm text-[#1A1916]"
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
            <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm">
              <p className="text-[14px] text-[#5A5750]">Freelancer</p>
              <p className="mt-1 text-[18px] font-semibold text-[#1A1916]">{contract.freelancerName}</p>
            </div>
            <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm">
              <p className="text-[14px] text-[#5A5750]">Montant total</p>
              <p className="mt-1 text-[18px] font-semibold text-[#1A1916]">{formatCurrency(contract.escrowAmount)}</p>
            </div>
            <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 shadow-sm">
              <p className="text-[14px] text-[#5A5750]">Fonds</p>
              <p className="mt-1 text-[18px] font-semibold text-[#1A7A4A]">🔒 Séquestrés</p>
            </div>
          </div>

          <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
            <h3 className="font-semibold mb-3 text-[#1A1916]">📋 Détails du contrat</h3>
            <div className="grid grid-cols-2 gap-4 text-[14px]">
              <div>
                <span className="text-[#5A5750]">Freelancer</span>
                <p className="font-medium text-[#1A1916]">{contract.freelancerName}</p>
              </div>
              <div>
                <span className="text-[#5A5750]">Date de création</span>
                <p className="font-medium text-[#1A1916]">{formatDate(contract.createdAt)}</p>
              </div>
              <div>
                <span className="text-[#5A5750]">Statut</span>
                <p className="font-medium text-[#1A1916] capitalize">{contract.status.toLowerCase()}</p>
              </div>
              <div>
                <span className="text-[#5A5750]">Escrow ID</span>
                <p className="font-medium font-mono text-[12px] text-[#1A1916]">{contract.escrowId || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHAT ─────────────── */}
      {activeTab === "chat" && (
        <ChatBox
          contractId={params.id as string}
          currentUserId={currentUser?.id || "guest"}
          currentUserName={currentUser?.name || "Client"}
          otherPartyName={contract.freelancerName}
        />
      )}

      {/* ─── FILES ─────────────── */}
      {activeTab === "files" && <FileUploader contractId={params.id as string} />}

      {/* ─── MEETINGS ─────────────── */}
      {activeTab === "meetings" && (
        <div className="space-y-4">
          <GoogleMeetButton
            meetingTitle={`${contract.missionTitle} — ${contract.freelancerName}`}
            duration={30}
          />
        </div>
      )}

      {/* ─── MILESTONES ─────────────── */}
      {activeTab === "milestones" && (
        <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-[#1A1916]">🏁 Jalons & Paiements</h3>
          {milestones.length === 0 ? (
            <p className="text-[14px] text-[#5A5750] text-center py-8">Aucun jalon défini.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="rounded-[10px] border border-[#E2E0D9] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-[14px] font-medium text-[#1A1916]">{m.title}</p>
                      <p className="text-[12px] text-[#5A5750]">{m.description}</p>
                    </div>
                    <span className="font-semibold text-[#2D5BE3] ml-4">{m.amount} €</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-[20px] px-2 py-0.5 text-[12px] font-medium ${
                      m.status === "APPROVED" || m.status === "RELEASED"
                        ? "bg-[#E6F5EE] text-[#1A7A4A]"
                        : m.status === "IN_REVIEW"
                        ? "bg-[#FFF3E0] text-[#E67E22]"
                        : "bg-[#F5F5F0] text-[#5A5750]"
                    }`}>
                      {m.status === "APPROVED" ? "✅ Validé" :
                       m.status === "RELEASED" ? "💰 Libéré" :
                       m.status === "IN_REVIEW" ? "🔄 En révision" : "⏳ En attente"}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.dueDate && (
                        <span className="text-[12px] text-[#5A5750]">
                          Échéance: {new Date(m.dueDate).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {m.status === "IN_REVIEW" && (
                        <button
                          onClick={() => handleMilestoneAction(m.id, "APPROVED")}
                          disabled={approving === m.id}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {approving === m.id ? "..." : "✅ Approuver"}
                        </button>
                      )}
                      {m.status === "PENDING" && (
                        <button
                          onClick={() => handleMilestoneAction(m.id, "IN_REVIEW")}
                          disabled={approving === m.id}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {approving === m.id ? "..." : "🔍 Demander révision"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── CONTRACT ─────────────── */}
      {activeTab === "contract" && (
        <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-[#1A1916]">📝 Termes du contrat</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-[12px] text-[#5A5750] uppercase tracking-wide">Parties</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[14px] font-bold text-[#2D5BE3]">
                      {currentUser?.name?.charAt(0) || "C"}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-[#1A1916]">{currentUser?.name || "Client"}</p>
                      <p className="text-[12px] text-[#5A5750]">Client</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#E6F5EE] text-[14px] font-bold text-[#1A7A4A]">
                      {contract.freelancerName?.charAt(0)}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-[#1A1916]">{contract.freelancerName}</p>
                      <p className="text-[12px] text-[#5A5750]">Freelancer</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[12px] text-[#5A5750] uppercase tracking-wide">Montant & Escrow</p>
                <div className="mt-2 space-y-1 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Montant total</span>
                    <span className="font-semibold text-[#1A1916]">{formatCurrency(contract.escrowAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Fonds</span>
                    <span className="font-medium text-[#1A7A4A]">🔒 Séquestrés</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Escrow ID</span>
                    <span className="font-mono text-[12px] text-[#1A1916]">{contract.escrowId || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[12px] text-[#5A5750] uppercase tracking-wide">Statut & Dates</p>
                <div className="mt-2 space-y-1 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Statut</span>
                    <span className={`rounded-[20px] px-2 py-0.5 text-[12px] font-medium ${statusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Créé le</span>
                    <span className="text-[#1A1916]">{formatDate(contract.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Freelancer ID</span>
                    <span className="font-mono text-[12px] text-[#1A1916]">{contract.freelancerId || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A5750]">Contrat ID</span>
                    <span className="font-mono text-[12px] text-[#1A1916]">{contract.id}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[10px] bg-[#FAFAF8] p-4 border border-[#E2E0D9]">
                <p className="text-[12px] text-[#5A5750]">🔐 Sécurité</p>
                <p className="mt-1 text-[14px] text-[#1A1916]">
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
        <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-[#1A1916]">💰 Historique des paiements</h3>
          {payments.length === 0 ? (
            <p className="text-[14px] text-[#5A5750] text-center py-8">Aucun paiement enregistré.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-[10px] bg-[#FAFAF8] px-4 py-3 text-[14px] border border-[#E2E0D9]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-[#5A5750]">{p.id}</span>
                    <span className="text-[#1A1916]">{p.type === "DEPOSIT" ? "Dépôt escrow" : p.type === "RELEASE" ? "Libération" : p.type === "PAYOUT" ? "Virement" : p.type}</span>
                    <span className={`text-[12px] font-medium ${p.status === "SUCCEEDED" ? "text-[#1A7A4A]" : p.status === "PENDING" ? "text-[#E67E22]" : "text-[#C0392B]"}`}>{p.status}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-[#1A1916]">{p.amount.toLocaleString()} {p.currency}</span>
                    <p className="text-[12px] text-[#5A5750]">{formatDate(p.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ACTIVITY ─────────────── */}
      {activeTab === "activity" && (
        <div className="rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-[#1A1916]">📊 Activité récente</h3>
          {activities.length === 0 ? (
            <p className="text-[14px] text-[#5A5750] text-center py-8">Aucune activité pour le moment.</p>
          ) : (
            <div className="relative pl-6 border-l-2 border-[#E2E0D9] space-y-4">
              {activities.slice(0, 10).map((a, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[25px] mt-1.5 h-3 w-3 rounded-full bg-[#2D5BE3]" />
                  <p className="text-[14px] text-[#1A1916]">{a.label}</p>
                  <p className="text-[12px] text-[#5A5750]">{formatDate(a.date)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
