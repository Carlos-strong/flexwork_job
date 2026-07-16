"use client";

import { useState, useEffect, useCallback } from "react";

type ContractPhase =
  | "NEGOTIATION"
  | "TERMS_LOCKED"
  | "CONTRACT_GENERATED"
  | "PENDING_FUNDING"
  | "FUNDED"
  | "CONTRACT_ACTIVE"
  | "CLOSING"
  | "COMPLETED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "CANCELLED";

const PHASE_LABELS: Record<ContractPhase, string> = {
  NEGOTIATION: "Négociation",
  TERMS_LOCKED: "Termes verrouillés",
  CONTRACT_GENERATED: "Contrat généré",
  PENDING_FUNDING: "En attente de financement",
  FUNDED: "Financé — en attente de signature",
  CONTRACT_ACTIVE: "Actif — pilotage jalons",
  CLOSING: "Clôture",
  COMPLETED: "Terminé",
  DISPUTE_OPENED: "Litige ouvert",
  DISPUTE_RESOLVED: "Litige résolu",
  CANCELLED: "Annulé",
};

// Phases proposées pour une réinitialisation — CANCELLED exclu (n'a pas de
// sens comme point de redémarrage), COMPLETED déconseillé mais laissé
// disponible pour un correctif exceptionnel côté admin.
const RESET_TARGETS: ContractPhase[] = [
  "NEGOTIATION",
  "CONTRACT_GENERATED",
  "FUNDED",
  "CONTRACT_ACTIVE",
  "CLOSING",
  "DISPUTE_OPENED",
];

interface ContractRow {
  id: string;
  missionTitle: string;
  client: { name: string; email: string };
  freelancer: { name: string; email: string };
  status: string;
  workflowPhase: ContractPhase | null;
  disputeStep: string | null;
  totalBudget: number | null;
  clientSignedAt: string | null;
  freelancerSignedAt: string | null;
  milestones: { id: string; title: string; status: string }[];
  updatedAt: string;
}

export default function AdminContractsResetPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ContractRow | null>(null);
  const [targetPhase, setTargetPhase] = useState<ContractPhase>("CONTRACT_ACTIVE");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadContracts = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/admin/contrats?q=${encodeURIComponent(q)}` : "/api/admin/contrats";
      const res = await fetch(url);
      const json = await res.json();
      setContracts(res.ok ? json.data ?? [] : []);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContracts("");
  }, [loadContracts]);

  useEffect(() => {
    const t = setTimeout(() => loadContracts(query), 350);
    return () => clearTimeout(t);
  }, [query, loadContracts]);

  const openResetModal = (contract: ContractRow) => {
    setSelected(contract);
    setTargetPhase(contract.workflowPhase ?? "CONTRACT_ACTIVE");
    setReason("");
    setFeedback(null);
  };

  const handleReset = async () => {
    if (!selected) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/contrats/${selected.id}/reset-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: json.error ?? "Échec de la réinitialisation" });
        return;
      }
      setFeedback({ type: "success", message: `Contrat réinitialisé à la phase "${PHASE_LABELS[targetPhase]}".` });
      await loadContracts(query);
      setSelected(null);
    } catch {
      setFeedback({ type: "error", message: "Erreur réseau" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Contrats — Réinitialisation d&apos;étape</h2>
        <p className="text-sm text-[#5A5750]">
          Outil admin pour remettre un contrat à une phase antérieure du workflow (négociation, financement,
          signature, pilotage, clôture, litige) lorsqu&apos;un client ou un freelance est bloqué. Action tracée
          dans l&apos;historique d&apos;audit du contrat.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
        ⚠️ Cette action réécrit directement l&apos;état du contrat (phase, signatures, jalons) sans repasser par les
        garde-fous normaux du workflow. À utiliser uniquement pour débloquer une situation anormale.
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par mission, client ou freelance (nom, email)..."
        className="w-full rounded-lg border border-[#E2E0D9] px-4 py-2.5 text-sm focus:border-[#2D5BE3] focus:outline-none"
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[#E2E0D9] p-5 animate-pulse">
              <div className="h-5 w-48 bg-[#F5F5F0] rounded" />
              <div className="mt-2 h-4 w-32 bg-[#F5F5F0] rounded" />
            </div>
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-[#5A5750] text-center py-8">Aucun contrat trouvé.</p>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-[#F5F5F0]/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Mission</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Client</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Freelance</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Phase actuelle</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Jalons</th>
                <th className="px-4 py-3 text-right font-medium text-[#5A5750]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-[#F5F5F0]/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.missionTitle}</p>
                    <p className="text-xs text-[#5A5750]">{c.totalBudget?.toLocaleString() ?? "—"} €</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium">{c.client.name}</p>
                    <p className="text-[#5A5750]">{c.client.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium">{c.freelancer.name}</p>
                    <p className="text-[#5A5750]">{c.freelancer.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#EEF2FD] text-[#2D5BE3]">
                      {c.workflowPhase ? PHASE_LABELS[c.workflowPhase] ?? c.workflowPhase : c.status}
                    </span>
                    {c.disputeStep && (
                      <p className="mt-1 text-[10px] text-[#5A5750]">Litige : {c.disputeStep}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5A5750]">
                    {c.milestones.length > 0
                      ? `${c.milestones.filter((m) => m.status === "APPROVED" || m.status === "RELEASED").length}/${c.milestones.length} validés`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openResetModal(c)}
                        className="rounded-lg border border-[#E2E0D9] px-3 py-1.5 text-xs font-medium hover:bg-[#EEF2FD] transition-colors"
                      >
                        🔄 Réinitialiser
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !submitting && setSelected(null)}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Réinitialiser le contrat</h3>
            <p className="text-sm text-[#5A5750] mb-4">{selected.missionTitle}</p>

            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-[#F5F5F0]/40 p-3">
                <p>
                  <span className="font-medium">Client :</span> {selected.client.name}
                </p>
                <p>
                  <span className="font-medium">Freelance :</span> {selected.freelancer.name}
                </p>
                <p>
                  <span className="font-medium">Phase actuelle :</span>{" "}
                  {selected.workflowPhase ? PHASE_LABELS[selected.workflowPhase] : selected.status}
                </p>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[#5A5750] uppercase tracking-wider">
                  Réinitialiser vers
                </span>
                <select
                  value={targetPhase}
                  onChange={(e) => setTargetPhase(e.target.value as ContractPhase)}
                  className="mt-1 w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:border-[#2D5BE3] focus:outline-none"
                >
                  {RESET_TARGETS.map((p) => (
                    <option key={p} value={p}>
                      {PHASE_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#5A5750] uppercase tracking-wider">
                  Motif (tracé dans l&apos;audit du contrat)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex : le freelance a soumis un jalon par erreur, on rejoue le pilotage."
                  className="mt-1 w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:border-[#2D5BE3] focus:outline-none"
                  rows={3}
                />
              </label>

              {targetPhase === "CONTRACT_ACTIVE" && (
                <p className="text-xs text-amber-700">
                  Les jalons seront remis à &quot;Non démarré&quot;, preuves et rejets effacés.
                </p>
              )}
              {["NEGOTIATION", "CONTRACT_GENERATED", "FUNDED"].includes(targetPhase) && (
                <p className="text-xs text-amber-700">
                  Les signatures client et freelance seront effacées — une nouvelle double signature sera requise.
                </p>
              )}
            </div>

            {feedback && (
              <p
                className={`mt-3 text-sm ${
                  feedback.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {feedback.message}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReset}
                disabled={submitting}
                className="flex-1 rounded-lg bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
              >
                {submitting ? "Réinitialisation..." : "Confirmer la réinitialisation"}
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={submitting}
                className="rounded-lg border border-[#E2E0D9] px-4 py-2.5 text-sm text-[#5A5750] hover:bg-[#EEF2FD] transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
