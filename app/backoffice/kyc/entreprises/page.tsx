"use client";

import { useState, useEffect } from "react";

type KycStep = "PROFIL_INCOMPLET" | "DOCUMENTS_MANQUANTS" | "DOCUMENTS_SOUMIS" | "VERIFICATION_AUTO" | "VERIFICATION_HUMAINE" | "VALIDE" | "REJETE" | "SURVEILLANCE";

const WORKFLOW: { step: KycStep; label: string; icon: string; desc: string }[] = [
  { step: "PROFIL_INCOMPLET",   label: "Profil incomplet",   icon: "📝", desc: "L'entreprise n'a pas complété son profil" },
  { step: "DOCUMENTS_MANQUANTS", label: "Docs manquants",    icon: "📄", desc: "KBIS, RIB ou SIRET non fournis" },
  { step: "DOCUMENTS_SOUMIS",   label: "Documents soumis",   icon: "📤", desc: "En attente de vérification" },
  { step: "VERIFICATION_AUTO",  label: "Vérif. automatique", icon: "🤖", desc: "Contrôle automatique du SIRET/KBIS" },
  { step: "VERIFICATION_HUMAINE",label: "Vérif. humaine",     icon: "👁️", desc: "Révision manuelle par un opérateur" },
  { step: "VALIDE",             label: "Validé",             icon: "✅", desc: "Entreprise vérifiée avec succès" },
  { step: "REJETE",             label: "Rejeté",             icon: "❌", desc: "Vérification refusée" },
  { step: "SURVEILLANCE",       label: "Surveillance",       icon: "🔍", desc: "Monitoring continu actif" },
];

const STEP_INDEX: Record<string, number> = {};
WORKFLOW.forEach((w, i) => { STEP_INDEX[w.step] = i; });

interface CompanyKyc {
  id: string;
  userId: string;
  companyName: string;
  siret: string | null;
  kbisUrl: string | null;
  ribUrl: string | null;
  contactName: string;
  contactEmail: string;
  secteur: string | null;
  companyVerificationStatus: "EN_ATTENTE" | "VALIDE" | "REJETE";
  companyVerifiedAt: string | null;
  createdAt: string;
  currentStep: KycStep;
}

function resolveStep(entry: { companyVerificationStatus: string; kbisUrl?: string | null; siret?: string | null }): KycStep {
  if (entry.companyVerificationStatus === "VALIDE") return "SURVEILLANCE";
  if (entry.companyVerificationStatus === "REJETE") return "REJETE";
  if (!entry.kbisUrl && !entry.siret) return "DOCUMENTS_MANQUANTS";
  return "DOCUMENTS_SOUMIS";
}

export default function KycEntreprisesPage() {
  const [companies, setCompanies] = useState<CompanyKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycStep | "ALL">("DOCUMENTS_SOUMIS");
  const [selected, setSelected] = useState<CompanyKyc | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [motif, setMotif] = useState("");

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
          const entry = {
            id: cp.id as string,
            userId: u.id as string,
            companyName: cp.companyName as string,
            siret: cp.siret as string | null,
            kbisUrl: cp.kbisUrl as string | null,
            ribUrl: cp.ribUrl as string | null,
            contactName: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
            contactEmail: u.email as string,
            secteur: cp.companySector as string | null,
            companyVerificationStatus: (cp.companyVerificationStatus as CompanyKyc["companyVerificationStatus"]) || "EN_ATTENTE",
            companyVerifiedAt: cp.companyVerifiedAt as string | null,
            createdAt: u.createdAt as string,
            currentStep: "DOCUMENTS_SOUMIS" as KycStep,
          };
          entry.currentStep = resolveStep({ companyVerificationStatus: entry.companyVerificationStatus, kbisUrl: entry.kbisUrl, siret: entry.siret });
          return entry;
        });
      setCompanies(companyUsers);
    } catch { setCompanies([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (entry: CompanyKyc, action: "VERIFICATION_AUTO" | "VERIFICATION_HUMAINE" | "VALIDE" | "REJETE") => {
    if (action === "REJETE" && !motif.trim()) {
      alert("Veuillez saisir un motif de rejet");
      return;
    }
    setProcessing(entry.id);
    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.userId,
          companyVerificationStatus: action === "VALIDE" ? "VALIDE" : action === "REJETE" ? "REJETE" : "EN_ATTENTE",
          companyVerifiedAt: action === "VALIDE" ? new Date().toISOString() : null,
        }),
      });
      setMotif("");
      await load();
    } finally { setProcessing(null); }
  };

  const filtered = filter === "ALL" ? companies : companies.filter((c) => c.currentStep === filter);

  const counts = WORKFLOW.reduce((acc, w) => {
    acc[w.step] = companies.filter((c) => c.currentStep === w.step).length;
    return acc;
  }, {} as Record<string, number>);

  if (selected) {
    const stepIdx = STEP_INDEX[selected.currentStep] ?? 0;
    return (
      <div className="space-y-6 text-[#1A1916]">
        <button onClick={() => setSelected(null)} className="text-sm text-[#2D5BE3] hover:underline flex items-center gap-1">
          ← Retour à la liste
        </button>

        <div className="rounded-xl border border-[#E2E0D9] bg-white p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">{selected.companyName}</h2>
              <p className="text-sm text-[#5A5750]">Contact : {selected.contactName} · {selected.contactEmail}</p>
              {selected.secteur && <p className="text-xs text-[#5A5750]">Secteur : {selected.secteur}</p>}
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              selected.companyVerificationStatus === "VALIDE" ? "bg-green-100 text-green-700" :
              selected.companyVerificationStatus === "REJETE" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {selected.companyVerificationStatus === "VALIDE" ? "✅ Validée" : selected.companyVerificationStatus === "REJETE" ? "❌ Rejetée" : "⏳ En attente"}
            </span>
          </div>

          {/* Workflow progress */}
          <div className="mb-8">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-4">Progression workflow</h4>
            <div className="flex flex-wrap items-center gap-1">
              {WORKFLOW.map((w, i) => (
                <div key={w.step} className="flex items-center gap-1">
                  <div className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-colors ${
                    i < stepIdx ? "bg-green-50 border-green-300 text-green-700" :
                    i === stepIdx ? "bg-[#EEF2FD] border-[#2D5BE3] text-[#2D5BE3] font-bold" :
                    "bg-gray-50 border-[#E2E0D9] text-[#9C9A95]"
                  }`}>
                    <span className="text-lg">{w.icon}</span>
                    <span className="whitespace-nowrap">{w.label}</span>
                  </div>
                  {i < WORKFLOW.length - 1 && (
                    <span className={`text-lg ${i < stepIdx ? "text-green-400" : "text-[#E2E0D9]"}`}>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Documents entreprise */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-lg border border-[#E2E0D9] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">SIRET</h4>
              {selected.siret ? (
                <p className="text-sm font-mono">{selected.siret}</p>
              ) : (
                <p className="text-sm text-[#C0392B]">Non renseigné</p>
              )}
            </div>
            <div className="rounded-lg border border-[#E2E0D9] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">KBIS</h4>
              {selected.kbisUrl ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <span>📄</span> Document fourni
                </div>
              ) : (
                <p className="text-sm text-[#C0392B]">Non fourni</p>
              )}
            </div>
            <div className="rounded-lg border border-[#E2E0D9] p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">RIB</h4>
              {selected.ribUrl ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <span>🏦</span> Document fourni
                </div>
              ) : (
                <p className="text-sm text-[#9C9A95]">Non fourni</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-[#E2E0D9] pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-3">Actions</h4>
            <div className="flex flex-wrap items-end gap-3">
              <button
                onClick={() => handleAction(selected, "VERIFICATION_AUTO")}
                disabled={processing === selected.id || selected.currentStep !== "DOCUMENTS_SOUMIS"}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                🤖 Vérif. automatique SIRET
              </button>
              <button
                onClick={() => handleAction(selected, "VERIFICATION_HUMAINE")}
                disabled={processing === selected.id || !["DOCUMENTS_SOUMIS", "VERIFICATION_AUTO"].includes(selected.currentStep)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                👁️ Envoyer en vérif. humaine
              </button>
              <div className="flex items-end gap-2 flex-1 min-w-[200px]">
                <input
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Motif de rejet..."
                  className="flex-1 rounded-lg border border-[#E2E0D9] px-3 py-2 text-xs"
                />
                <button
                  onClick={() => handleAction(selected, "REJETE")}
                  disabled={processing === selected.id || ["VALIDE", "REJETE", "SURVEILLANCE"].includes(selected.currentStep)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  ❌ Rejeter
                </button>
              </div>
              <button
                onClick={() => handleAction(selected, "VALIDE")}
                disabled={processing === selected.id || ["VALIDE", "REJETE", "SURVEILLANCE"].includes(selected.currentStep)}
                className="rounded-lg bg-green-600 px-6 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                ✅ Valider l&apos;entreprise
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#1A1916]">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">🏢 Vérifier une entreprise</h1>
        <p className="text-[14px] text-[#5A5750] mt-1">Vérification des entreprises clientes — KBIS, RIB, SIRET.</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {[{ step: "ALL", label: "Tous" } as { step: string; label: string }, ...WORKFLOW].map((w) => (
          <button
            key={w.step}
            onClick={() => setFilter(w.step as KycStep | "ALL")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === w.step ? "bg-[#2D5BE3] text-white" : "bg-[#FAFAF8] border border-[#E2E0D9] text-[#5A5750] hover:border-[#C3D1F8]"
            }`}
          >
            {w.step !== "ALL" && WORKFLOW.find((wf) => wf.step === w.step)?.icon}
            {w.label}
            {w.step !== "ALL" && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{counts[w.step] || 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="text-center py-12 text-[#5A5750]">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#5A5750]">Aucune entreprise à vérifier.</div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E0D9] bg-[#FAFAF8] text-left">
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Entreprise</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">SIRET/KBIS</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Étape workflow</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Statut</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const wf = WORKFLOW.find((w) => w.step === c.currentStep);
                return (
                  <tr key={c.id} className="border-b border-[#F5F5F0] hover:bg-[#FAFAF8] cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3 font-medium">{c.companyName}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.siret ? `SIRET: ${c.siret}` : "—"} {c.kbisUrl ? "· KBIS ✓" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        {wf?.icon} {wf?.label || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.companyVerificationStatus === "VALIDE" ? "bg-green-100 text-green-700" :
                        c.companyVerificationStatus === "REJETE" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {c.companyVerificationStatus === "VALIDE" ? "Validée" : c.companyVerificationStatus === "REJETE" ? "Rejetée" : "En attente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5A5750]">{c.contactName}<br/>{c.contactEmail}</td>
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
