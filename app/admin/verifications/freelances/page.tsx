"use client";

import { useState, useEffect } from "react";

interface KycEntry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  pieceType?: string;
  numeroPiece?: string;
  statut: "EN_ATTENTE" | "VALIDE" | "REJETE" | "A_REVOIR";
  dateSoumission: string;
  photoRecto?: string;
  selfieUrl?: string;
}

const STATUS_CONFIG = {
  EN_ATTENTE: { label: "En attente", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
  A_REVOIR:   { label: "À revoir",   color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  VALIDE:     { label: "Validé",     color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  REJETE:     { label: "Rejeté",     color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export default function AdminVerificationsFreelancesPage() {
  const [entries, setEntries] = useState<KycEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "EN_ATTENTE" | "A_REVOIR" | "VALIDE" | "REJETE">("EN_ATTENTE");
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/validation-utilisateurs");
      const data = await res.json();
      const list = data.data || data || [];
      // Adapter le format existant à notre interface
      setEntries(list.map((item: Record<string, unknown>) => ({
        id: (item.id as string),
        userId: ((item.user as Record<string, unknown>)?.id as string) || (item.userId as string) || "",
        userEmail: ((item.user as Record<string, unknown>)?.email as string) || (item.userEmail as string) || "",
        userName: [
          (item.user as Record<string, unknown>)?.firstName,
          (item.user as Record<string, unknown>)?.lastName
        ].filter(Boolean).join(" ") || (item.userName as string) || "Utilisateur",
        statut: (item.statutValidation as string) || (item.statut as string) || "EN_ATTENTE",
        dateSoumission: (item.createdAt as string) || (item.dateSoumission as string),
        pieceType: (item.pieceType as string),
        numeroPiece: (item.numeroPiece as string),
      })));
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handle = async (id: string, action: "VALIDE" | "REJETE") => {
    let motif: string | null = null;
    if (action === "REJETE") {
      motif = prompt("Motif du rejet :");
      if (!motif) return;
    }
    setProcessing(id);
    try {
      await fetch("/api/admin/validation-utilisateurs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prestataireMetierId: id, statut: action, motifRejet: motif }),
      });
      await load();
    } finally { setProcessing(null); }
  };

  const counts = {
    EN_ATTENTE: entries.filter((e) => e.statut === "EN_ATTENTE").length,
    A_REVOIR:   entries.filter((e) => e.statut === "A_REVOIR").length,
    VALIDE:     entries.filter((e) => e.statut === "VALIDE").length,
    REJETE:     entries.filter((e) => e.statut === "REJETE").length,
  };

  const displayed = filter === "ALL" ? entries : entries.filter((e) => e.statut === filter);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Vérifications Freelances</h2>
        <p className="text-sm text-[#5A5750]">File de traitement des KYC freelances (pièces d&apos;identité)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["EN_ATTENTE", "A_REVOIR", "VALIDE", "REJETE"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
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

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 rounded-xl bg-[#F5F5F0]" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D9] p-12 text-center">
          <p className="text-3xl mb-3">🪪</p>
          <p className="font-semibold">Aucune vérification {STATUS_CONFIG[filter === "ALL" ? "EN_ATTENTE" : filter]?.label?.toLowerCase()}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-[#F5F5F0]/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Utilisateur</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Type pièce</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Soumis le</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-[#5A5750]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((e) => {
                const cfg = STATUS_CONFIG[e.statut] || STATUS_CONFIG.EN_ATTENTE;
                const isProcessing = processing === e.id;
                return (
                  <tr key={e.id} className="hover:bg-[#F5F5F0]/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.userName}</p>
                      <p className="text-xs text-[#5A5750]">{e.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-[#5A5750]">
                      {e.pieceType?.replace("_", " ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#5A5750]">
                      {new Date(e.dateSoumission).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(e.statut === "EN_ATTENTE" || e.statut === "A_REVOIR") && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handle(e.id, "VALIDE")}
                            disabled={isProcessing}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {isProcessing ? "…" : "Approuver"}
                          </button>
                          <button
                            onClick={() => handle(e.id, "REJETE")}
                            disabled={isProcessing}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            Rejeter
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
