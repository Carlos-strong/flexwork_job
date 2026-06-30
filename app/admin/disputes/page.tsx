"use client";

import { useState } from "react";

type DisputeStatus = "OUVERT" | "EN_COURS" | "RESOLU" | "FERME";

const STATUS_CONFIG: Record<DisputeStatus, { label: string; color: string }> = {
  OUVERT:   { label: "Ouvert",    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  EN_COURS: { label: "En cours",  color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  RESOLU:   { label: "Résolu",    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  FERME:    { label: "Fermé",     color: "bg-[#F5F5F0] text-[#5A5750]" },
};

interface Dispute {
  id: string;
  contractId: string;
  missionTitle: string;
  clientName: string;
  freelancerName: string;
  amount: number;
  status: DisputeStatus;
  reason: string;
  openedAt: string;
  resolvedAt?: string;
}

// Données mock — à remplacer par une vraie API /api/disputes
const MOCK_DISPUTES: Dispute[] = [];

export default function AdminDisputesPage() {
  const [disputes] = useState<Dispute[]>(MOCK_DISPUTES);
  const [filter, setFilter] = useState<"ALL" | DisputeStatus>("ALL");
  const [selected, setSelected] = useState<Dispute | null>(null);

  const counts: Record<DisputeStatus, number> = {
    OUVERT:   disputes.filter((d) => d.status === "OUVERT").length,
    EN_COURS: disputes.filter((d) => d.status === "EN_COURS").length,
    RESOLU:   disputes.filter((d) => d.status === "RESOLU").length,
    FERME:    disputes.filter((d) => d.status === "FERME").length,
  };

  const displayed = filter === "ALL" ? disputes : disputes.filter((d) => d.status === filter);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Litiges</h2>
        <p className="text-sm text-[#5A5750]">
          Gestion des litiges entre clients et freelances — arbitrage et résolution
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["OUVERT", "EN_COURS", "RESOLU", "FERME"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "ALL" : s)}
              className={`rounded-xl border p-4 text-left transition-all ${
                filter === s ? "border-primary ring-2 ring-[#2D5BE3]/20" : "border-[#E2E0D9] hover:border-[#C3D1F8]"
              }`}
            >
              <p className="text-2xl font-bold">{counts[s]}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Procédure */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-400">
        <p className="font-semibold mb-1">⚖️ Procédure de résolution</p>
        <ol className="list-decimal list-inside space-y-0.5 text-xs">
          <li>Ouverture du litige par l&apos;une des parties</li>
          <li>Assignation d&apos;un médiateur (passe à EN_COURS)</li>
          <li>Collecte des preuves (14 jours max)</li>
          <li>Décision : remboursement client / paiement freelance / partage</li>
          <li>Fermeture du litige et libération des fonds escrow</li>
        </ol>
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
          <p className="text-4xl mb-3">⚖️</p>
          <h3 className="font-semibold text-lg">Aucun litige</h3>
          <p className="mt-1 text-sm text-[#5A5750]">
            {filter === "ALL"
              ? "Aucun litige n'a été ouvert sur la plateforme."
              : `Aucun litige avec le statut "${STATUS_CONFIG[filter as DisputeStatus]?.label}".`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-[#F5F5F0]/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Mission</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Parties</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Montant</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Ouvert le</th>
                <th className="px-4 py-3 text-right font-medium text-[#5A5750]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((d) => {
                const cfg = STATUS_CONFIG[d.status];
                return (
                  <tr key={d.id} className="hover:bg-[#F5F5F0]/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.missionTitle}</p>
                      <p className="text-xs text-[#5A5750] line-clamp-1">{d.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>Client : {d.clientName}</p>
                      <p className="text-[#5A5750]">FL : {d.freelancerName}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#2D5BE3]">
                      {d.amount.toLocaleString()} €
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5A5750]">
                      {new Date(d.openedAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelected(d)}
                          className="rounded-lg border border-[#E2E0D9] px-3 py-1.5 text-xs font-medium hover:bg-[#EEF2FD] transition-colors"
                        >
                          Traiter
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de traitement */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-1">Litige #{selected.id}</h3>
            <p className="text-sm text-[#5A5750] mb-4">{selected.missionTitle}</p>

            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-[#F5F5F0]/40 p-3">
                <p><span className="font-medium">Motif :</span> {selected.reason}</p>
                <p><span className="font-medium">Montant en jeu :</span> {selected.amount.toLocaleString()} €</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                ✅ Décision : Client remboursé
              </button>
              <button className="flex-1 rounded-lg bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors">
                💸 Décision : Freelance payé
              </button>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-3 w-full rounded-lg border border-[#E2E0D9] px-4 py-2 text-sm text-[#5A5750] hover:bg-[#EEF2FD] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
