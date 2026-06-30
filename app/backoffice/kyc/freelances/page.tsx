"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Workflow KYC ──
type KycStep = "PROFIL_INCOMPLET" | "DOCUMENTS_MANQUANTS" | "DOCUMENTS_SOUMIS" | "VERIFICATION_AUTO" | "VERIFICATION_HUMAINE" | "VALIDE" | "REJETE" | "SURVEILLANCE";

const WORKFLOW: { step: KycStep; label: string; icon: string; desc: string }[] = [
  { step: "PROFIL_INCOMPLET",   label: "Profil incomplet",   icon: "📝", desc: "Le freelance n'a pas complété son profil" },
  { step: "DOCUMENTS_MANQUANTS", label: "Docs manquants",    icon: "📄", desc: "Pièces d'identité non téléversées" },
  { step: "DOCUMENTS_SOUMIS",   label: "Documents soumis",   icon: "📤", desc: "En attente de vérification automatique" },
  { step: "VERIFICATION_AUTO",  label: "Vérif. automatique", icon: "🤖", desc: "Contrôle automatique en cours" },
  { step: "VERIFICATION_HUMAINE",label: "Vérif. humaine",     icon: "👁️", desc: "Révision manuelle par un opérateur" },
  { step: "VALIDE",             label: "Validé",             icon: "✅", desc: "Compte vérifié avec succès" },
  { step: "REJETE",             label: "Rejeté",             icon: "❌", desc: "Vérification refusée" },
  { step: "SURVEILLANCE",       label: "Surveillance",       icon: "🔍", desc: "Monitoring continu actif" },
];

const STEP_INDEX: Record<string, number> = {};
WORKFLOW.forEach((w, i) => { STEP_INDEX[w.step] = i; });

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
}

function resolveStep(entry: { statut: string; profileComplete?: boolean; photoRecto?: string }): KycStep {
  if (entry.statut === "VALIDE") return "SURVEILLANCE";
  if (entry.statut === "REJETE") return "REJETE";
  if (!entry.profileComplete) return "PROFIL_INCOMPLET";
  if (!entry.photoRecto) return "DOCUMENTS_MANQUANTS";
  return "DOCUMENTS_SOUMIS";
}

export default function KycFreelancesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<KycEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycStep | "ALL">("DOCUMENTS_SOUMIS");
  const [selected, setSelected] = useState<KycEntry | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [motif, setMotif] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/validation-utilisateurs");
      const data = await res.json();
      const list = data.data || data || [];
      setEntries(list.map((item: Record<string, unknown>) => {
        const user = item.user as Record<string, unknown> | null;
        const statut = (item.statutValidation as string) || (item.statut as string) || "EN_ATTENTE";
        const entry = {
          id: item.id as string,
          userId: user?.id as string || (item.userId as string) || "",
          userName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || (item.userName as string) || "—",
          userEmail: user?.email as string || (item.userEmail as string) || "",
          userPhone: user?.phone as string || "",
          pieceType: item.pieceType as string || "—",
          numeroPiece: item.numeroPiece as string || "—",
          photoRecto: item.photoRecto as string || "",
          photoVerso: item.photoVerso as string || null,
          selfieUrl: item.selfieUrl as string || null,
          statut: statut as KycEntry["statut"],
          motifRejet: item.motifRejet as string || null,
          dateSoumission: item.dateSoumission as string || item.createdAt as string || "",
          profileComplete: !!user?.firstName && !!user?.phone,
          currentStep: "DOCUMENTS_SOUMIS" as KycStep,
        };
        entry.currentStep = resolveStep({ statut: entry.statut, profileComplete: entry.profileComplete, photoRecto: entry.photoRecto });
        return entry;
      }));
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (entry: KycEntry, action: "VERIFICATION_AUTO" | "VERIFICATION_HUMAINE" | "VALIDE" | "REJETE") => {
    if (action === "REJETE" && !motif.trim()) {
      alert("Veuillez saisir un motif de rejet");
      return;
    }
    setProcessing(entry.id);
    try {
      await fetch("/api/admin/validation-utilisateurs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prestataireMetierId: entry.id,
          statut: action === "VALIDE" ? "VALIDE" : action === "REJETE" ? "REJETE" : "EN_ATTENTE",
          motifRejet: action === "REJETE" ? motif : null,
          kycStep: action,
        }),
      });
      setMotif("");
      await load();
    } finally { setProcessing(null); }
  };

  const filtered = filter === "ALL" ? entries : entries.filter((e) => e.currentStep === filter);

  const counts = WORKFLOW.reduce((acc, w) => {
    acc[w.step] = entries.filter((e) => e.currentStep === w.step).length;
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
              <h2 className="text-xl font-semibold">{selected.userName}</h2>
              <p className="text-sm text-[#5A5750]">{selected.userEmail} · {selected.userPhone}</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              selected.statut === "VALIDE" ? "bg-green-100 text-green-700" :
              selected.statut === "REJETE" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {selected.statut === "VALIDE" ? "✅ Validé" : selected.statut === "REJETE" ? "❌ Rejeté" : "⏳ En attente"}
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

          {/* Documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">Pièce d&apos;identité</h4>
              <p className="text-sm mb-1"><strong>Type :</strong> {selected.pieceType}</p>
              <p className="text-sm mb-3"><strong>N° :</strong> {selected.numeroPiece}</p>
              {selected.photoRecto ? (
                <div className="rounded-lg border border-[#E2E0D9] overflow-hidden bg-gray-100 aspect-[3/2] flex items-center justify-center">
                  <span className="text-4xl">🪪</span>
                </div>
              ) : (
                <p className="text-sm text-[#C0392B]">Photo recto manquante</p>
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">Selfie de vérification</h4>
              {selected.selfieUrl ? (
                <div className="rounded-lg border border-[#E2E0D9] overflow-hidden bg-gray-100 aspect-[3/2] flex items-center justify-center">
                  <span className="text-4xl">🤳</span>
                </div>
              ) : (
                <p className="text-sm text-[#9C9A95]">Selfie non fourni</p>
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
                🤖 Lancer vérif. automatique
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
                ✅ Valider le compte
              </button>
            </div>
            {selected.motifRejet && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-3">
                <strong>Motif de rejet précédent :</strong> {selected.motifRejet}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#1A1916]">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">🪪 Vérifier un freelance</h1>
        <p className="text-[14px] text-[#5A5750] mt-1">Vérification d&apos;identité des prestataires — workflow complet.</p>
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
        <div className="text-center py-12 text-[#5A5750]">Aucune vérification trouvée.</div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E0D9] bg-[#FAFAF8] text-left">
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Freelance</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Pièce</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Étape workflow</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Statut</th>
                <th className="px-4 py-3 font-semibold text-[#5A5750]">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const wf = WORKFLOW.find((w) => w.step === e.currentStep);
                return (
                  <tr key={e.id} className="border-b border-[#F5F5F0] hover:bg-[#FAFAF8] cursor-pointer transition-colors" onClick={() => setSelected(e)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{e.userName}</p>
                      <p className="text-xs text-[#5A5750]">{e.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.pieceType} {e.numeroPiece !== "—" ? `· ${e.numeroPiece}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        {wf?.icon} {wf?.label || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.statut === "VALIDE" ? "bg-green-100 text-green-700" :
                        e.statut === "REJETE" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                      }`}>{e.statut === "VALIDE" ? "Validé" : e.statut === "REJETE" ? "Rejeté" : "En attente"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5A5750]">
                      {e.dateSoumission ? new Date(e.dateSoumission).toLocaleDateString("fr-FR") : "—"}
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
