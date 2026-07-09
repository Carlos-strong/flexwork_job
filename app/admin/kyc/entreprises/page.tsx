"use client";

import { useState, useEffect } from "react";

// ── Types ──
type KycStep =
  | "PROFIL_INCOMPLET" | "DOCUMENTS_MANQUANTS" | "DOCUMENTS_SOUMIS"
  | "VERIFICATION_AUTO" | "VERIFICATION_HUMAINE"
  | "VALIDE" | "REJETE" | "SURVEILLANCE";

const WORKFLOW: { step: KycStep; label: string; icon: string; desc: string; color: string }[] = [
  { step: "PROFIL_INCOMPLET",   label: "Profil incomplet",   icon: "📝", desc: "L'entreprise n'a pas complété son profil", color: "#9C9A95" },
  { step: "DOCUMENTS_MANQUANTS",label: "Docs manquants",    icon: "📄", desc: "KBIS, RIB ou SIRET non fournis",          color: "#F39C12" },
  { step: "DOCUMENTS_SOUMIS",   label: "Documents soumis",   icon: "📤", desc: "En attente de vérification",              color: "#2D5BE3" },
  { step: "VERIFICATION_AUTO",  label: "Vérif. automatique", icon: "🤖", desc: "Contrôle automatique du SIRET/KBIS",       color: "#8E44AD" },
  { step: "VERIFICATION_HUMAINE",label:"Vérif. humaine",     icon: "👁️", desc: "Révision manuelle par un opérateur",      color: "#E67E22" },
  { step: "VALIDE",             label: "Validée",            icon: "✅", desc: "Entreprise vérifiée avec succès",          color: "#27AE60" },
  { step: "REJETE",             label: "Rejetée",            icon: "❌", desc: "Vérification refusée",                     color: "#E74C3C" },
  { step: "SURVEILLANCE",       label: "Surveillance",       icon: "🔍", desc: "Monitoring continu actif",                color: "#1A7A4A" },
];

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

// ── Modal de rejet ──
function RejectModal({
  entry, onConfirm, onCancel, processing,
}: {
  entry: CompanyKyc; onConfirm: (motif: string) => void; onCancel: () => void; processing: boolean;
}) {
  const [motif, setMotif] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1916]/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-xl">
        <h3 className="text-[16px] font-semibold text-[#1A1916] mb-1">Rejeter la vérification</h3>
        <p className="text-[13px] text-[#5A5750] mb-4">{entry.companyName} · {entry.contactEmail}</p>
        <textarea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif du rejet (obligatoire)..." rows={3}
          className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] text-[#1A1916] bg-white focus:outline-none focus:border-[#E74C3C] focus:ring-1 focus:ring-[#E74C3C] resize-none mb-4" />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={processing} className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] disabled:opacity-40">Annuler</button>
          <button onClick={() => onConfirm(motif)} disabled={!motif.trim() || processing} className="rounded-[10px] bg-[#E74C3C] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#C0392B] disabled:opacity-40">
            {processing ? "Rejet..." : "Confirmer le rejet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de détail ──
function DetailModal({
  entry, onClose, onValidate, onReject, processing,
}: {
  entry: CompanyKyc; onClose: () => void; onValidate: () => void; onReject: () => void; processing: boolean;
}) {
  const stepIdx = WORKFLOW.findIndex((w) => w.step === entry.currentStep);
  const canValidate = ["DOCUMENTS_SOUMIS", "VERIFICATION_AUTO", "VERIFICATION_HUMAINE"].includes(entry.currentStep);
  const canReject = !["VALIDE", "REJETE", "SURVEILLANCE"].includes(entry.currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1916]/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1A1916]">{entry.companyName}</h2>
            <p className="text-[13px] text-[#5A5750]">Contact: {entry.contactName} · {entry.contactEmail}</p>
            {entry.secteur && <p className="text-[12px] text-[#5A5750]">Secteur: {entry.secteur}</p>}
          </div>
          <button onClick={onClose} className="text-[#9C9A95] hover:text-[#1A1916] text-lg leading-none">&times;</button>
        </div>

        {/* Workflow */}
        <div className="mb-6">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5A5750] mb-3">Progression</h4>
          <div className="flex flex-wrap items-center gap-1">
            {WORKFLOW.map((w, i) => (
              <div key={w.step} className="flex items-center gap-1">
                <div className={`flex flex-col items-center px-2.5 py-2 rounded-lg border text-[11px] transition-colors ${
                  i < stepIdx ? "bg-[#E6F5EE] border-[#9FD4B4] text-[#1A7A4A]" :
                  i === stepIdx ? "bg-[#EEF2FD] border-[#2D5BE3] text-[#2D5BE3] font-bold" :
                  "bg-gray-50 border-[#E2E0D9] text-[#9C9A95]"
                }`} title={w.desc}>
                  <span className="text-base">{w.icon}</span>
                  <span className="whitespace-nowrap">{w.label}</span>
                </div>
                {i < WORKFLOW.length - 1 && (
                  <span className={`text-sm ${i < stepIdx ? "text-[#1A7A4A]" : "text-[#E2E0D9]"}`}>→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Documents entreprise */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5A5750] mb-2">SIRET</h4>
            {entry.siret ? <p className="text-[13px] font-mono">{entry.siret}</p> : <p className="text-[12px] text-[#E74C3C]">Non renseigné</p>}
          </div>
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5A5750] mb-2">KBIS</h4>
            {entry.kbisUrl ? <div className="flex items-center gap-2 text-[13px] text-[#1A7A4A]"><span>📄</span> Document fourni</div> : <p className="text-[12px] text-[#E74C3C]">Non fourni</p>}
          </div>
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5A5750] mb-2">RIB</h4>
            {entry.ribUrl ? <div className="flex items-center gap-2 text-[13px] text-[#1A7A4A]"><span>🏦</span> Document fourni</div> : <p className="text-[12px] text-[#9C9A95]">Non fourni</p>}
          </div>
        </div>

        <div className="border-t border-[#E2E0D9] pt-4 flex items-center gap-3">
          <button onClick={onClose} className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8]">Fermer</button>
          {canValidate && (
            <button onClick={onValidate} disabled={processing} className="rounded-[10px] bg-[#27AE60] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#1E8449] disabled:opacity-40 ml-auto">
              {processing ? "Validation..." : "✅ Valider cette entreprise"}
            </button>
          )}
          {canReject && (
            <button onClick={onReject} disabled={processing} className="rounded-[10px] bg-[#E74C3C] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#C0392B] disabled:opacity-40">❌ Rejeter</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ──
export default function KycEntreprisesPage() {
  const [companies, setCompanies] = useState<CompanyKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycStep | "ALL">("ALL");
  const [detailEntry, setDetailEntry] = useState<CompanyKyc | null>(null);
  const [rejectEntry, setRejectEntry] = useState<CompanyKyc | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kyc/companies");
      const data = await res.json();
      const list = data.data || data || [];
      setCompanies(list.map((cp: Record<string, unknown>) => {
        const u = cp.user as Record<string, unknown>;
        const entry: CompanyKyc = {
          id: cp.id as string,
          userId: u?.id as string,
          companyName: cp.companyName as string,
          siret: cp.siret as string | null,
          kbisUrl: cp.kbisUrl as string | null,
          ribUrl: cp.ribUrl as string | null,
          contactName: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "—",
          contactEmail: u?.email as string,
          secteur: cp.companySector as string | null,
          companyVerificationStatus: (cp.companyVerificationStatus as CompanyKyc["companyVerificationStatus"]) || "EN_ATTENTE",
          companyVerifiedAt: cp.companyVerifiedAt as string | null,
          createdAt: cp.createdAt as string,
          currentStep: "DOCUMENTS_SOUMIS" as KycStep,
        };
        entry.currentStep = resolveStep({ companyVerificationStatus: entry.companyVerificationStatus, kbisUrl: entry.kbisUrl, siret: entry.siret });
        return entry;
      }));
    } catch (err) { console.error("Erreur chargement:", err); setCompanies([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleValidate = async (entry: CompanyKyc) => {
    setProcessing(entry.id);
    try {
      const res = await fetch("/api/kyc/companies", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfileId: entry.id, statut: "VALIDE", motifRejet: null }),
      });
      if (!res.ok) throw new Error("Échec");
      showToast("success", `✅ ${entry.companyName} validée avec succès`);
      setDetailEntry(null);
      await load();
    } catch { showToast("error", "Erreur lors de la validation"); }
    finally { setProcessing(null); }
  };

  const handleReject = async (motif: string) => {
    if (!rejectEntry || !motif.trim()) return;
    setProcessing(rejectEntry.id);
    try {
      const res = await fetch("/api/kyc/companies", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfileId: rejectEntry.id, statut: "REJETE", motifRejet: motif }),
      });
      if (!res.ok) throw new Error("Échec");
      showToast("success", `❌ ${rejectEntry.companyName} rejetée`);
      setRejectEntry(null); setDetailEntry(null);
      await load();
    } catch { showToast("error", "Erreur lors du rejet"); }
    finally { setProcessing(null); }
  };

  const filtered = filter === "ALL" ? companies : companies.filter((c) => c.currentStep === filter);
  const counts = WORKFLOW.reduce((acc, w) => { acc[w.step] = companies.filter((c) => c.currentStep === w.step).length; return acc; }, {} as Record<string, number>);
  const totalPending = companies.filter((c) => !["VALIDE", "REJETE", "SURVEILLANCE"].includes(c.currentStep)).length;

  return (
    <div className="space-y-5 text-[#1A1916]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] rounded-xl px-4 py-3 text-[13px] font-semibold shadow-lg animate-in slide-in-from-right-2 ${
          toast.type === "success" ? "bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4]" : "bg-[#FDEDEC] text-[#C0392B] border border-[#F5B7B1]"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">🏢 Vérification des entreprises</h1>
          <p className="text-[13px] text-[#5A5750] mt-0.5">SIRET, KBIS, RIB — validation manuelle</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5A5750] hover:bg-[#FAFAF8] disabled:opacity-40">↻ Rafraîchir</button>
      </div>

      {/* Compteurs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-[#FEF9E7] border border-[#F9E79F] px-3 py-1.5 text-[12px] font-semibold text-[#B7950B]">⏳ {totalPending} en attente</div>
        <div className="flex items-center gap-2 rounded-full bg-[#E6F5EE] border border-[#9FD4B4] px-3 py-1.5 text-[12px] font-semibold text-[#1A7A4A]">✅ {counts["SURVEILLANCE"] || 0} validées</div>
        <div className="flex items-center gap-2 rounded-full bg-[#FDEDEC] border border-[#F5B7B1] px-3 py-1.5 text-[12px] font-semibold text-[#C0392B]">❌ {counts["REJETE"] || 0} rejetées</div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-1.5">
        {[{ step: "ALL", label: "Toutes", icon: "📋" }, ...WORKFLOW].map((w) => (
          <button key={w.step} onClick={() => setFilter(w.step as KycStep | "ALL")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
              filter === w.step ? "bg-[#2D5BE3] text-white shadow-sm" : "bg-[#FAFAF8] border border-[#E2E0D9] text-[#5A5750] hover:border-[#C3D1F8] hover:text-[#2D5BE3]"
            }`}>
            {w.icon && <span>{w.icon}</span>}{w.label}
            {w.step !== "ALL" && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === w.step ? "bg-white/20 text-white" : "bg-[#E2E0D9] text-[#5A5750]"}`}>{counts[w.step] || 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="rounded-xl border border-[#E2E0D9] bg-white p-12 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#EEF2FD] mb-3"><div className="animate-spin h-5 w-5 border-2 border-[#2D5BE3] border-t-transparent rounded-full"></div></div>
          <p className="text-[13px] text-[#5A5750]">Chargement des vérifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E2E0D9] bg-white p-12 text-center">
          <span className="text-3xl">📭</span>
          <p className="text-[14px] text-[#5A5750] mt-2">Aucune vérification trouvée pour ce filtre.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E0D9] bg-[#FAFAF8]">
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Entreprise</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Documents</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Étape</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F0]">
                {filtered.map((c) => {
                  const wf = WORKFLOW.find((w) => w.step === c.currentStep);
                  const isPending = !["VALIDE", "REJETE", "SURVEILLANCE"].includes(c.currentStep);
                  const docCount = [c.siret, c.kbisUrl, c.ribUrl].filter(Boolean).length;
                  return (
                    <tr key={c.id} className={`hover:bg-[#FAFAF8] transition-colors ${processing === c.id ? "opacity-50 pointer-events-none" : ""}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => setDetailEntry(c)} className="text-left hover:text-[#2D5BE3] transition-colors">
                          <p className="font-semibold text-[#1A1916]">{c.companyName}</p>
                          {c.secteur && <p className="text-[11px] text-[#5A5750]">{c.secteur}</p>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${c.siret ? "bg-[#27AE60]" : "bg-[#E2E0D9]"}`}></span>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.kbisUrl ? "bg-[#27AE60]" : "bg-[#E2E0D9]"}`}></span>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.ribUrl ? "bg-[#27AE60]" : "bg-[#E2E0D9]"}`}></span>
                          <span className="text-[11px] text-[#5A5750] ml-1">{docCount}/3 docs</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ backgroundColor: wf?.color + "15", color: wf?.color, border: `1px solid ${wf?.color}30` }}>
                          {wf?.icon} {wf?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          c.companyVerificationStatus === "VALIDE" ? "bg-[#E6F5EE] text-[#1A7A4A]" :
                          c.companyVerificationStatus === "REJETE" ? "bg-[#FDEDEC] text-[#C0392B]" :
                          "bg-[#FEF9E7] text-[#B7950B]"
                        }`}>
                          {c.companyVerificationStatus === "VALIDE" ? "Validée" : c.companyVerificationStatus === "REJETE" ? "Rejetée" : "Attente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#5A5750]">{c.contactName}<br />{c.contactEmail}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setDetailEntry(c)} className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5A5750] hover:bg-[#FAFAF8] hover:border-[#C3D1F8] transition-colors">👁️ Voir</button>
                          {isPending && (
                            <>
                              <button onClick={() => handleValidate(c)} disabled={processing === c.id} className="rounded-lg bg-[#27AE60] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1E8449] disabled:opacity-40 transition-colors">✅ Valider</button>
                              <button onClick={() => setRejectEntry(c)} disabled={processing === c.id} className="rounded-lg bg-[#E74C3C] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#C0392B] disabled:opacity-40 transition-colors">❌ Rejeter</button>
                            </>
                          )}
                          {!isPending && (
                            <button onClick={() => setDetailEntry(c)} className="rounded-lg border border-[#E2E0D9] bg-[#FAFAF8] px-3 py-1.5 text-[11px] font-medium text-[#5A5750] hover:bg-white transition-colors">📋 Détail</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {detailEntry && (
        <DetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onValidate={() => handleValidate(detailEntry)} onReject={() => { setRejectEntry(detailEntry); setDetailEntry(null); }} processing={processing === detailEntry.id} />
      )}
      {rejectEntry && (
        <RejectModal entry={rejectEntry} onConfirm={handleReject} onCancel={() => setRejectEntry(null)} processing={processing === rejectEntry.id} />
      )}
    </div>
  );
}
