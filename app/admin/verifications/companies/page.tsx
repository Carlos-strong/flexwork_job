"use client";

import { useState, useEffect } from "react";

interface CompanyKyc {
  id: string;
  userId: string;
  companyName: string;
  siret?: string;
  kbisUrl?: string;
  ribUrl?: string;
  contactName: string;
  contactEmail: string;
  companyVerificationStatus: "EN_ATTENTE" | "VALIDE" | "REJETE";
  createdAt: string;
}

const STATUS_CONFIG = {
  EN_ATTENTE: { label: "En attente", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
  VALIDE:     { label: "Validée",    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  REJETE:     { label: "Rejetée",    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export default function AdminVerificationsCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "EN_ATTENTE" | "VALIDE" | "REJETE">("EN_ATTENTE");
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const users = Array.isArray(data) ? data : (data.data ?? []);
      const companyUsers = users
        .filter((u: Record<string, unknown>) => {
          const cp = u.clientProfile as Record<string, unknown> | null;
          return cp?.companyName;
        })
        .map((u: Record<string, unknown>) => {
          const cp = u.clientProfile as Record<string, unknown>;
          return {
            id: cp.id as string,
            userId: u.id as string,
            companyName: cp.companyName as string,
            siret: cp.siret as string | undefined,
            kbisUrl: cp.kbisUrl as string | undefined,
            ribUrl: cp.ribUrl as string | undefined,
            contactName: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
            contactEmail: u.email as string,
            companyVerificationStatus: (cp.companyVerificationStatus as CompanyKyc["companyVerificationStatus"]) || "EN_ATTENTE",
            createdAt: u.createdAt as string,
          };
        });
      setCompanies(companyUsers);
    } catch { setCompanies([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handle = async (companyId: string, userId: string, action: "VALIDE" | "REJETE") => {
    let motif: string | null = null;
    if (action === "REJETE") {
      motif = prompt("Motif du rejet :");
      if (!motif) return;
    }
    setProcessing(companyId);
    try {
      // PUT via API admin pour mettre à jour le companyVerificationStatus
      await fetch(`/api/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, companyVerificationStatus: action }),
      });
      await load();
    } finally { setProcessing(null); }
  };

  const counts = {
    EN_ATTENTE: companies.filter((c) => c.companyVerificationStatus === "EN_ATTENTE").length,
    VALIDE:     companies.filter((c) => c.companyVerificationStatus === "VALIDE").length,
    REJETE:     companies.filter((c) => c.companyVerificationStatus === "REJETE").length,
  };

  const displayed = filter === "ALL" ? companies : companies.filter((c) => c.companyVerificationStatus === filter);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Vérifications Entreprises</h2>
        <p className="text-sm text-[#5A5750]">KYC clients entreprise — SIRET, KBIS, RIB</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(["EN_ATTENTE", "VALIDE", "REJETE"] as const).map((s) => {
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 rounded-xl bg-[#F5F5F0]" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D9] p-12 text-center">
          <p className="text-3xl mb-3">🏢</p>
          <p className="font-semibold">Aucune entreprise {filter !== "ALL" ? STATUS_CONFIG[filter as "EN_ATTENTE" | "VALIDE" | "REJETE"].label.toLowerCase() : ""}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-[#F5F5F0]/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Entreprise</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">SIRET</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Documents</th>
                <th className="px-4 py-3 text-left font-medium text-[#5A5750]">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-[#5A5750]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((c) => {
                const cfg = STATUS_CONFIG[c.companyVerificationStatus];
                const isProcessing = processing === c.id;
                return (
                  <tr key={c.id} className="hover:bg-[#F5F5F0]/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.companyName}</p>
                      <p className="text-xs text-[#5A5750]">{c.contactName} · {c.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#5A5750]">
                      {c.siret || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {c.kbisUrl
                          ? <span className="text-xs text-green-600">✅ KBIS</span>
                          : <span className="text-xs text-[#5A5750]">❌ KBIS</span>}
                        {c.ribUrl
                          ? <span className="text-xs text-green-600">✅ RIB</span>
                          : <span className="text-xs text-[#5A5750]">❌ RIB</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.companyVerificationStatus === "EN_ATTENTE" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handle(c.id, c.userId, "VALIDE")}
                            disabled={isProcessing}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {isProcessing ? "…" : "Valider"}
                          </button>
                          <button
                            onClick={() => handle(c.id, c.userId, "REJETE")}
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
