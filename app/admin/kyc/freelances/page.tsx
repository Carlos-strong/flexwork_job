"use client";

import { useState, useEffect } from "react";

// ── Types ──
type KycStep =
  | "PROFIL_INCOMPLET" | "DOCUMENTS_MANQUANTS" | "DOCUMENTS_SOUMIS"
  | "VERIFICATION_AUTO" | "VERIFICATION_HUMAINE"
  | "VALIDE" | "REJETE" | "SURVEILLANCE";

const WORKFLOW: { step: KycStep; label: string; icon: string; desc: string; color: string }[] = [
  { step: "PROFIL_INCOMPLET",   label: "Profil incomplet",   icon: "📝", desc: "Le freelance n'a pas complété son profil", color: "#9C9A95" },
  { step: "DOCUMENTS_MANQUANTS",label: "Docs manquants",    icon: "📄", desc: "Pièces d'identité non téléversées",     color: "#F39C12" },
  { step: "DOCUMENTS_SOUMIS",   label: "Documents soumis",   icon: "📤", desc: "En attente de vérification",            color: "#2D5BE3" },
  { step: "VERIFICATION_AUTO",  label: "Vérif. automatique", icon: "🤖", desc: "Contrôle automatique en cours",         color: "#8E44AD" },
  { step: "VERIFICATION_HUMAINE",label:"Vérif. humaine",     icon: "👁️", desc: "Révision manuelle par un opérateur",    color: "#E67E22" },
  { step: "VALIDE",             label: "Validé",             icon: "✅", desc: "Compte vérifié avec succès",             color: "#27AE60" },
  { step: "REJETE",             label: "Rejeté",             icon: "❌", desc: "Vérification refusée",                   color: "#E74C3C" },
  { step: "SURVEILLANCE",       label: "Surveillance",       icon: "🔍", desc: "Monitoring continu actif",              color: "#1A7A4A" },
];

interface KycEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  pieceType: string;
  numeroPiece: string;
  photoRecto: string;
  photoVerso: string | null;
  selfieUrl: string | null;
  statut: "EN_ATTENTE" | "VALIDE" | "REJETE";
  motifRejet: string | null;
  dateSoumission: string;
  profileComplete: boolean;
  currentStep: KycStep;
  _missingDocs?: boolean;
}

function resolveStep(entry: { statut: string; profileComplete?: boolean; photoRecto?: string }): KycStep {
  if (entry.statut === "VALIDE") return "SURVEILLANCE";
  if (entry.statut === "REJETE") return "REJETE";
  if (!entry.profileComplete) return "PROFIL_INCOMPLET";
  if (!entry.photoRecto) return "DOCUMENTS_MANQUANTS";
  return "DOCUMENTS_SOUMIS";
}

// ── Modal de rejet ──
function RejectModal({
  entry,
  onConfirm,
  onCancel,
  processing,
}: {
  entry: KycEntry;
  onConfirm: (motif: string) => void;
  onCancel: () => void;
  processing: boolean;
}) {
  const [motif, setMotif] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1916]/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-xl">
        <h3 className="text-[16px] font-semibold text-[#1A1916] mb-1">Rejeter la vérification</h3>
        <p className="text-[13px] text-[#5A5750] mb-4">
          {entry.userName} · {entry.userEmail}
        </p>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Motif du rejet (obligatoire)..."
          rows={3}
          className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] text-[#1A1916] bg-white focus:outline-none focus:border-[#E74C3C] focus:ring-1 focus:ring-[#E74C3C] resize-none mb-4"
        />
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
  entry: KycEntry; onClose: () => void; onValidate: () => void; onReject: () => void; processing: boolean;
}) {
  const wf = WORKFLOW.find((w) => w.step === entry.currentStep);
  const stepIdx = WORKFLOW.findIndex((w) => w.step === entry.currentStep);
  const canValidate = ["DOCUMENTS_SOUMIS", "VERIFICATION_AUTO", "VERIFICATION_HUMAINE"].includes(entry.currentStep);
  const canReject = !["VALIDE", "REJETE", "SURVEILLANCE"].includes(entry.currentStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1916]/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[16px] border border-[#E2E0D9] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1A1916]">{entry.userName}</h2>
            <p className="text-[13px] text-[#5A5750]">{entry.userEmail} · {entry.userPhone || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
              entry.statut === "VALIDE" ? "bg-[#E6F5EE] text-[#1A7A4A]" :
              entry.statut === "REJETE" ? "bg-[#FDEDEC] text-[#C0392B]" : "bg-[#FEF9E7] text-[#B7950B]"
            }`}>{wf?.icon} {wf?.label}</span>
            <button onClick={onClose} className="text-[#9C9A95] hover:text-[#1A1916] text-lg leading-none">&times;</button>
          </div>
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

        {/* Documents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5A5750] mb-2">Pièce d&apos;identité</h4>
            <p className="text-[13px] mb-1"><strong>Type :</strong> {entry.pieceType}</p>
            <p className="text-[13px] mb-3"><strong>N° :</strong> {entry.numeroPiece}</p>
            {entry.photoRecto ? (
              <div className="rounded-lg border border-[#E2E0D9] overflow-hidden bg-[#FAFAF8] aspect-[3/2] flex items-center justify-center">
                <span className="text-4xl">🪪</span>
              </div>
            ) : (
              <p className="text-[12px] text-[#E74C3C] font-medium">⚠️ Photo recto manquante</p>
            )}
          </div>
          <div className="rounded-xl border border-[#E2E0D9] p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5A5750] mb-2">Selfie de vérification</h4>
            {entry.selfieUrl ? (
              <div className="rounded-lg border border-[#E2E0D9] overflow-hidden bg-[#FAFAF8] aspect-[3/2] flex items-center justify-center">
                <span className="text-4xl">🤳</span>
              </div>
            ) : (
              <p className="text-[12px] text-[#9C9A95]">Non fourni</p>
            )}
          </div>
        </div>

        {entry.motifRejet && (
          <div className="mb-4 rounded-xl bg-[#FDEDEC] border border-[#F5B7B1] p-3 text-[12px] text-[#C0392B]">
            <strong>Motif de rejet :</strong> {entry.motifRejet}
          </div>
        )}

        <div className="border-t border-[#E2E0D9] pt-4 flex items-center gap-3">
          <button onClick={onClose} className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8]">Fermer</button>
          {canValidate && (
            <button onClick={onValidate} disabled={processing} className="rounded-[10px] bg-[#27AE60] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#1E8449] disabled:opacity-40 ml-auto">
              {processing ? "Validation..." : "✅ Valider ce compte"}
            </button>
          )}
          {canReject && (
            <button onClick={onReject} disabled={processing} className="rounded-[10px] bg-[#E74C3C] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#C0392B] disabled:opacity-40">
              ❌ Rejeter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ──
export default function KycFreelancesPage() {
  const [entries, setEntries] = useState<KycEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycStep | "ALL">("ALL");
  const [detailEntry, setDetailEntry] = useState<KycEntry | null>(null);
  const [rejectEntry, setRejectEntry] = useState<KycEntry | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kyc/freelances");
      const data = await res.json();
      const list = data.data || data || [];
      setEntries(list.map((item: Record<string, unknown>) => {
        const user = item.user as Record<string, unknown> | null;
        const isMissingDocs = item._missingDocs === true;
        const statut = (item.statut as string) || "EN_ATTENTE";
        const entry: KycEntry = {
          id: item.id as string,
          userId: (user?.id as string) || (item.userId as string) || (item.id as string) || "",
          userName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—",
          userEmail: user?.email as string || "",
          userPhone: user?.phone as string || "",
          pieceType: isMissingDocs ? "—" : (item.pieceType as string || "—"),
          numeroPiece: isMissingDocs ? "—" : (item.numeroPiece as string || "—"),
          photoRecto: isMissingDocs ? "" : (item.photoRecto as string || ""),
          photoVerso: isMissingDocs ? null : (item.photoVerso as string || null),
          selfieUrl: isMissingDocs ? null : (item.selfieUrl as string || null),
          statut: statut as KycEntry["statut"],
          motifRejet: item.motifRejet as string || null,
          dateSoumission: item.dateSoumission as string || item.createdAt as string || "",
          profileComplete: !!user?.firstName && !!user?.phone,
          currentStep: "DOCUMENTS_SOUMIS" as KycStep,
          _missingDocs: isMissingDocs,
        };
        entry.currentStep = resolveStep({ statut: entry.statut, profileComplete: entry.profileComplete, photoRecto: entry.photoRecto });
        return entry;
      }));
    } catch (err) {
      console.error("Erreur chargement verifications:", err);
      setEntries([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleValidate = async (entry: KycEntry) => {
    setProcessing(entry.id);
    try {
      const body: Record<string, unknown> = { statut: "VALIDE", motifRejet: null };
      if (entry._missingDocs || (!entry.photoRecto && !entry.numeroPiece)) {
        body.userId = entry.userId || entry.id;
      } else {
        body.verificationId = entry.id;
      }
      const res = await fetch("/api/kyc/freelances", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Échec validation");
      showToast("success", `✅ ${entry.userName} validé(e) avec succès`);
      setDetailEntry(null);
      await load();
    } catch {
      showToast("error", "Erreur lors de la validation");
    } finally { setProcessing(null); }
  };

  const handleReject = async (motif: string) => {
    if (!rejectEntry || !motif.trim()) return;
    setProcessing(rejectEntry.id);
    try {
      const body: Record<string, unknown> = { statut: "REJETE", motifRejet: motif };
      if (rejectEntry._missingDocs || (!rejectEntry.photoRecto && !rejectEntry.numeroPiece)) {
        body.userId = rejectEntry.userId || rejectEntry.id;
      } else {
        body.verificationId = rejectEntry.id;
      }
      const res = await fetch("/api/kyc/freelances", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Échec rejet");
      showToast("success", `❌ ${rejectEntry.userName} rejeté(e) — motif enregistré`);
      setRejectEntry(null);
      setDetailEntry(null);
      await load();
    } catch {
      showToast("error", "Erreur lors du rejet");
    } finally { setProcessing(null); }
  };

  const filtered = filter === "ALL" ? entries : entries.filter((e) => e.currentStep === filter);
  const counts = WORKFLOW.reduce((acc, w) => { acc[w.step] = entries.filter((e) => e.currentStep === w.step).length; return acc; }, {} as Record<string, number>);
  const totalPending = entries.filter((e) => !["VALIDE", "REJETE", "SURVEILLANCE"].includes(e.currentStep)).length;

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
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">🪪 Vérification des freelances</h1>
          <p className="text-[13px] text-[#5A5750] mt-0.5">Pièces d&apos;identité, selfies, validation manuelle</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5A5750] hover:bg-[#FAFAF8] disabled:opacity-40">↻ Rafraîchir</button>
      </div>

      {/* Compteurs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-[#FEF9E7] border border-[#F9E79F] px-3 py-1.5 text-[12px] font-semibold text-[#B7950B]">⏳ {totalPending} en attente</div>
        <div className="flex items-center gap-2 rounded-full bg-[#E6F5EE] border border-[#9FD4B4] px-3 py-1.5 text-[12px] font-semibold text-[#1A7A4A]">✅ {counts["SURVEILLANCE"] || 0} validés</div>
        <div className="flex items-center gap-2 rounded-full bg-[#FDEDEC] border border-[#F5B7B1] px-3 py-1.5 text-[12px] font-semibold text-[#C0392B]">❌ {counts["REJETE"] || 0} rejetés</div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-1.5">
        {[{ step: "ALL", label: "Tous", icon: "📋" }, ...WORKFLOW].map((w) => (
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
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Freelance</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Pièce d&apos;identité</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Étape</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-center font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F0]">
                {filtered.map((e) => {
                  const wf = WORKFLOW.find((w) => w.step === e.currentStep);
                  const isPending = !["VALIDE", "REJETE", "SURVEILLANCE"].includes(e.currentStep);
                  return (
                    <tr key={e.id} className={`hover:bg-[#FAFAF8] transition-colors ${processing === e.id ? "opacity-50 pointer-events-none" : ""}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => setDetailEntry(e)} className="text-left hover:text-[#2D5BE3] transition-colors">
                          <p className="font-semibold text-[#1A1916]">{e.userName}</p>
                          <p className="text-[11px] text-[#5A5750]">{e.userEmail}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {e.photoRecto ? (
                          <span className="inline-flex items-center gap-1 text-[12px]"><span className="w-1.5 h-1.5 rounded-full bg-[#27AE60]"></span>{e.pieceType} · {e.numeroPiece}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[12px] text-[#E74C3C]"><span className="w-1.5 h-1.5 rounded-full bg-[#E74C3C]"></span>Non fournie</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ backgroundColor: wf?.color + "15", color: wf?.color, border: `1px solid ${wf?.color}30` }}>
                          {wf?.icon} {wf?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          e.statut === "VALIDE" ? "bg-[#E6F5EE] text-[#1A7A4A]" : e.statut === "REJETE" ? "bg-[#FDEDEC] text-[#C0392B]" : "bg-[#FEF9E7] text-[#B7950B]"
                        }`}>{e.statut === "VALIDE" ? "Validé" : e.statut === "REJETE" ? "Rejeté" : "Attente"}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#5A5750]">
                        {e.dateSoumission ? new Date(e.dateSoumission).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setDetailEntry(e)} className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5A5750] hover:bg-[#FAFAF8] hover:border-[#C3D1F8] transition-colors" title="Voir les détails">👁️ Voir</button>
                          {isPending && (
                            <>
                              <button onClick={() => handleValidate(e)} disabled={processing === e.id} className="rounded-lg bg-[#27AE60] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1E8449] disabled:opacity-40 transition-colors" title="Valider directement">✅ Valider</button>
                              <button onClick={() => setRejectEntry(e)} disabled={processing === e.id} className="rounded-lg bg-[#E74C3C] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#C0392B] disabled:opacity-40 transition-colors" title="Rejeter avec motif">❌ Rejeter</button>
                            </>
                          )}
                          {!isPending && (
                            <button onClick={() => setDetailEntry(e)} className="rounded-lg border border-[#E2E0D9] bg-[#FAFAF8] px-3 py-1.5 text-[11px] font-medium text-[#5A5750] hover:bg-white transition-colors">📋 Détail</button>
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
