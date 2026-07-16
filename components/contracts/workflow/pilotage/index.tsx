"use client";

/**
 * Composant de pilotage par jalons — Vue prestataire et vue client.
 * 
 * Adapté depuis prestataire_jalons.html et client_jalons.html.
 * Offre une gestion complète des preuves (photos, vidéos, documents,
 * géolocalisation, autres) et du workflow de validation/rejet.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ContractWorkflowContext } from "@/lib/contract-workflow";
import { dispatchWorkflowIntent } from "@/lib/workflow-client";
import {
  type PilotageMilestone,
  toPilotageMilestone,
  evCount,
  emptyEvidence,
  PILOTAGE_STATUS_MAP,
  CLIENT_STATUS_MAP,
} from "./types";
import { MilestoneDetailFreelancer } from "./freelancer-detail";
import { MilestoneDetailClient } from "./client-detail";

// ── Props ──
interface MilestonePilotageProps {
  ctx: ContractWorkflowContext;
  onCtxUpdate: (newCtx: ContractWorkflowContext) => void;
  onClose: () => void;
  userRole: "client" | "freelancer";
  userId?: string;
}

// ── Helpers ──
function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " €";
}

// ═══════════════════════════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════════════════════════

export function MilestonePilotage({
  ctx,
  onCtxUpdate,
  onClose,
  userRole,
  userId,
}: MilestonePilotageProps) {
  // État étendu local (preuves, progression constatée, etc.)
  const [extendedMilestones, setExtendedMilestones] = useState<PilotageMilestone[]>(() =>
    ctx.milestones.map(toPilotageMilestone)
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  const validated = ctx.milestones.filter((m) => m.status === "VALIDATED").length;
  const total = ctx.milestones.length;
  const allValidated = validated === total && total > 0;

  // Synchroniser les milestones du contexte vers l'état étendu
  const syncFromContext = useCallback((newCtx: ContractWorkflowContext) => {
    setExtendedMilestones((prev) =>
      newCtx.milestones.map((wm) => {
        const existing = prev.find((p) => p.milestoneId === wm.milestoneId);
        if (existing) {
          return {
            ...existing,
            status: wm.status,
            executionRate: wm.executionRate,
            submittedAt: wm.submittedAt,
            validatedAt: wm.validatedAt,
            rejectedAt: wm.rejectedAt,
            rejectionReason: wm.rejectionReason ?? existing.rejectionReason,
            evidence: (wm.evidence as import("./types").EvidenceSet) || existing.evidence,
            progressionDeclaree: wm.executionRate,
            revisionCount: wm.revisionCount ?? existing.revisionCount,
          };
        }
        return toPilotageMilestone(wm);
      })
    );
  }, []);

  // ── Synchronisation des milestones depuis le contexte parent (SSE / externe) ──
  // Quand le ctx change (ex. mise à jour SSE depuis l'autre partie), on sync l'état local
  const prevCtxRef = useRef(ctx);
  useEffect(() => {
    // Détecter si les statuts des milestones ont changé dans le contexte
    const hasChanges = ctx.milestones.some((wm) => {
      const local = extendedMilestones.find((p) => p.milestoneId === wm.milestoneId);
      return !local || local.status !== wm.status;
    });
    if (hasChanges) {
      syncFromContext(ctx);
    }
    prevCtxRef.current = ctx;
  }, [ctx, extendedMilestones, syncFromContext]);

  const [actionError, setActionError] = useState<string | null>(null);

  // ── Gestion des milestones via intentions serveur (autoritaire) ──
  // Le serveur revalide la transition et renvoie le contexte à jour, qui
  // devient la source de vérité. Le front n'écrit plus l'état brut.
  const handleMilestoneTransition = useCallback(
    async (
      milestoneId: string,
      newStatus: "IN_PROGRESS" | "SUBMITTED" | "VALIDATED",
      rejectionReason?: string
    ) => {
      const extended = extendedMilestones.find((m) => m.milestoneId === milestoneId);

      let result;
      if (newStatus === "SUBMITTED") {
        result = await dispatchWorkflowIntent(ctx.contractId, {
          action: "SUBMIT_MILESTONE",
          milestoneId,
          evidence: extended?.evidence ?? undefined,
          executionRate: extended?.progressionDeclaree ?? 0,
        });
      } else if (newStatus === "VALIDATED") {
        result = await dispatchWorkflowIntent(ctx.contractId, {
          action: "VALIDATE_MILESTONE",
          milestoneId,
          executionRate: extended?.progressionConstatee ?? undefined,
        });
      } else {
        // Rejet (retour IN_PROGRESS) — motif obligatoire côté serveur.
        result = await dispatchWorkflowIntent(ctx.contractId, {
          action: "REJECT_MILESTONE",
          milestoneId,
          rejectionReason: rejectionReason ?? "Rejeté",
        });
      }

      if (result.ok && result.context) {
        setActionError(null);
        onCtxUpdate(result.context);
        syncFromContext(result.context);
      } else {
        setActionError(result.error ?? "Action refusée");
      }
    },
    [ctx.contractId, extendedMilestones, onCtxUpdate, syncFromContext]
  );

  // ── Mise à jour des preuves côté prestataire ──
  const updateExtended = useCallback((id: string, updater: (m: PilotageMilestone) => PilotageMilestone) => {
    setExtendedMilestones((prev) =>
      prev.map((m) => (m.milestoneId === id ? updater(m) : m))
    );
  }, []);

  const addEvidenceFile = useCallback(
    (id: string, kind: "photo" | "video" | "document", file: import("./types").EvidenceFile) => {
      updateExtended(id, (m) => {
        const ev = { ...m.evidence };
        if (kind === "photo") ev.photos = [...ev.photos, file];
        else if (kind === "video") ev.videos = [...ev.videos, file];
        else ev.documents = [...ev.documents, file];
        return { ...m, evidence: ev };
      });
    },
    [updateExtended]
  );

  const captureGeoloc = useCallback(
    (id: string) => {
      const applyFallback = () => {
        const lat = parseFloat((48.85 + Math.random() * 0.02).toFixed(4));
        const lng = parseFloat((2.34 + Math.random() * 0.02).toFixed(4));
        updateExtended(id, (m) => ({
          ...m,
          evidence: { ...m.evidence, geoloc: { lat, lng, simulated: true } },
        }));
      };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            updateExtended(id, (m) => ({
              ...m,
              evidence: {
                ...m.evidence,
                geoloc: { lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4) },
              },
            }));
          },
          () => applyFallback(),
          { timeout: 4000 }
        );
      } else {
        applyFallback();
      }
    },
    [updateExtended]
  );

  const removeGeoloc = useCallback(
    (id: string) => updateExtended(id, (m) => ({ ...m, evidence: { ...m.evidence, geoloc: null } })),
    [updateExtended]
  );

  const removeEvidence = useCallback(
    (id: string, kind: string, idx: number) => {
      updateExtended(id, (m) => {
        const ev = { ...m.evidence };
        if (kind === "photo") ev.photos = ev.photos.filter((_, i) => i !== idx);
        else if (kind === "video") ev.videos = ev.videos.filter((_, i) => i !== idx);
        else if (kind === "document") ev.documents = ev.documents.filter((_, i) => i !== idx);
        else if (kind === "autre") ev.autres = ev.autres.filter((_, i) => i !== idx);
        return { ...m, evidence: ev };
      });
    },
    [updateExtended]
  );

  const addAutre = useCallback(
    (id: string, label: string) => {
      if (!label.trim()) return;
      updateExtended(id, (m) => ({
        ...m,
        evidence: { ...m.evidence, autres: [...m.evidence.autres, { label: label.trim() }] },
      }));
    },
    [updateExtended]
  );

  const updateConstatee = useCallback(
    (id: string, val: number) => {
      const clamped = Math.max(0, Math.min(100, val));
      updateExtended(id, (m) => ({ ...m, progressionConstatee: clamped }));
    },
    [updateExtended]
  );

  // ── Soumission par le prestataire ──
  // Le serveur démarre automatiquement un jalon NOT_STARTED avant de le
  // soumettre : une seule intention suffit.
  const submitMilestone = useCallback(
    (id: string) => {
      handleMilestoneTransition(id, "SUBMITTED");
      setDetailId(null);
    },
    [handleMilestoneTransition]
  );

  // ── Validation par le client ──
  const validateMilestone = useCallback(
    (id: string) => {
      handleMilestoneTransition(id, "VALIDATED");
      setDetailId(null);
    },
    [handleMilestoneTransition]
  );

  // ── Rejet par le client ──
  const rejectMilestone = useCallback(
    (id: string, motif: string) => {
      // Incrémenter revisionCount localement
      updateExtended(id, (m) => ({ ...m, revisionCount: m.revisionCount + 1 }));
      handleMilestoneTransition(id, "IN_PROGRESS", motif);
      setDetailId(null);
    },
    [handleMilestoneTransition, updateExtended]
  );

  // ── Rendu du statut ──
  const statusMap = userRole === "client" ? CLIENT_STATUS_MAP : PILOTAGE_STATUS_MAP;

  // ── Rendu du bouton d'action ──
  function actionButton(m: PilotageMilestone) {
    if (userRole === "freelancer") {
      if (m.status === "VALIDATED") {
        return <button className="btn sm" disabled>Complété</button>;
      }
      if (m.status === "SUBMITTED") {
        return <button className="btn sm" disabled>En attente client</button>;
      }
      if (m.status === "REJECTED") {
        return (
          <button className="btn amber sm" onClick={() => setDetailId(m.milestoneId)}>
            Réviser
          </button>
        );
      }
      return (
        <button
          className="btn primary sm"
          onClick={() => setDetailId(m.milestoneId)}
        >
          Soumettre preuve
        </button>
      );
    }
    // Client
    if (m.status === "VALIDATED") {
      return <button className="btn sm" disabled>Complété</button>;
    }
    if (m.status === "NOT_STARTED" || m.status === "IN_PROGRESS") {
      return <button className="btn sm" disabled>Non soumis</button>;
    }
    if (m.status === "REJECTED") {
      return <button className="btn sm" disabled>En attente de révision</button>;
    }
    // SUBMITTED
    const label = m.revisionCount === 0 ? "Vérifier" : `Révision (${m.revisionCount})`;
    const cls = m.revisionCount === 0 ? "btn primary sm" : "btn amber sm";
    return (
      <button className={cls} onClick={() => setDetailId(m.milestoneId)}>
        {label}
      </button>
    );
  }

  // ── Rendu de la cellule progression ──
  function progressCell(m: PilotageMilestone) {
    if (userRole === "freelancer") {
      // Le freelance ne déclare plus sa progression — seule la progression constatée par le client compte
      return <td><span className="hint">—</span></td>;
    }
    // Client
    const declared = m.progressionDeclaree;
    const constatee = m.progressionConstatee;
    if (m.status === "NOT_STARTED" || m.status === "IN_PROGRESS") {
      return <td><span className="hint">Non soumis</span></td>;
    }
    if (constatee === null) {
      return (
        <td className="progress-cell">
          <div className="progress-mini">
            <div className="progress-track">
              <div className="progress-fill declared" style={{ width: `${declared}%` }} />
            </div>
            <span className="hint" style={{ whiteSpace: "nowrap" }}>{declared}% déclaré</span>
          </div>
          <span className="hint">Constatée : à évaluer</span>
        </td>
      );
    }
    const cls = constatee === 100 ? "full" : "partial";
    return (
      <td className="progress-cell">
        <div className="progress-mini">
          <div className="progress-track">
            <div className="progress-fill declared" style={{ width: `${declared}%` }} />
          </div>
          <span className="hint" style={{ whiteSpace: "nowrap" }}>{declared}% déclaré</span>
        </div>
        <div className="progress-mini">
          <div className="progress-track">
            <div className={`progress-fill constatee ${cls}`} style={{ width: `${constatee}%` }} />
          </div>
          <span className="hint" style={{ whiteSpace: "nowrap", color: cls === "full" ? "var(--green-text)" : "var(--amber-text)" }}>
            {constatee}% constaté
          </span>
        </div>
      </td>
    );
  }

  // ── Résumé ──
  const totalAmount = extendedMilestones.reduce((s, m) => s + m.amount, 0);
  const validatedAmount = extendedMilestones
    .filter((m) => m.status === "VALIDATED")
    .reduce((s, m) => s + m.amount, 0);
  const pendingCount = extendedMilestones.filter((m) => m.status === "SUBMITTED").length;
  const rejectedCount = extendedMilestones.filter((m) => m.status === "REJECTED").length;

  const detailMilestone = detailId ? extendedMilestones.find((m) => m.milestoneId === detailId) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PILOTAGE_STYLES }} />

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Bannière contrat signé */}
        {ctx.fullySignedAt && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-700">Contrat signé et activé</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Double signature enregistrée le{" "}
                    {new Date(ctx.fullySignedAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => window.open(`/api/contracts/${ctx.contractId}/document?format=html`, "_blank")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E2E0D9] text-[#1A1916] text-xs font-semibold rounded-lg hover:bg-[#F4F3EF] transition-colors"
                >
                  Imprimer / PDF
                </button>
                <button
                  onClick={() => window.open(`/api/contracts/${ctx.contractId}/document?format=docx`, "_blank")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2D5BE3] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Télécharger DOCX
                </button>
              </div>
            </div>
          </div>
        )}

        {/* En-tête */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
            Phase 4
          </span>
          <span className="text-xs text-[#5A5750]">
            {validated}/{total} jalons validés
          </span>
        </div>
        <h2 className="text-2xl font-bold text-[#1A1916]">
          {userRole === "freelancer" ? "Suivi des jalons de la mission" : "Validation des jalons soumis"}
        </h2>
        <p className="text-sm text-[#5A5750] max-w-[640px]">
          {userRole === "freelancer"
            ? "Joignez vos preuves d'exécution (photos, vidéos, documents, géolocalisation ou autres) puis soumettez le jalon pour validation par le client. Seule la progression constatée par le client fait foi."
            : "Examinez les preuves fournies par le prestataire (photos, vidéos, documents, géolocalisation ou autres), évaluez la progression constatée, puis validez ou rejetez chaque jalon soumis. La validation n'est possible qu'à 100 % de progression constatée ; un motif est obligatoire en cas de rejet."}
        </p>

        {/* Erreur d'action (garde métier refusée par le serveur) */}
        {actionError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600" aria-label="Fermer">✕</button>
          </div>
        )}

        {/* Barre de résumé */}
        <div className="flex gap-3.5 flex-wrap">
          <div className="summary-chip">
            <p className="label">Jalons</p>
            <p className="value">{total}</p>
          </div>
          <div className="summary-chip">
            <p className="label">Montant total</p>
            <p className="value">{fmtEur(totalAmount)}</p>
          </div>
          <div className="summary-chip">
            <p className="label">Validé</p>
            <p className="value" style={{ color: "var(--green-text)" }}>{fmtEur(validatedAmount)}</p>
          </div>
          <div className="summary-chip">
            <p className="label">{userRole === "client" ? "À traiter" : "En attente client"}</p>
            <p className="value" style={{ color: pendingCount > 0 ? "var(--amber-text)" : "var(--ink)" }}>
              {pendingCount}
            </p>
          </div>
          {userRole === "freelancer" && (
            <div className="summary-chip">
              <p className="label">À réviser</p>
              <p className="value" style={{ color: rejectedCount > 0 ? "var(--red-text)" : "var(--ink)" }}>
                {rejectedCount}
              </p>
            </div>
          )}
        </div>

        {/* Barre de progression */}
        <div className="bg-white rounded-xl border border-[#E2E0D9] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#1A1916]">Progression globale</span>
            <span className="text-sm font-bold text-[#2D5BE3]">
              {total > 0 ? Math.round((validated / total) * 100) : 0} %
            </span>
          </div>
          <div className="h-3 bg-[#F4F3EF] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#2D5BE3] to-green-500"
              style={{ width: `${total > 0 ? (validated / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Tableau des jalons */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Jalon</th>
                <th>Montant</th>
                <th>Progression</th>
                <th>Preuves</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(userRole === "client"
                ? [...extendedMilestones].sort((a, b) => (b.status === "SUBMITTED" ? 1 : 0) - (a.status === "SUBMITTED" ? 1 : 0))
                : extendedMilestones
              ).map((m) => {
                const st = statusMap[m.status] || { cls: "b-gray", label: m.status };
                const isPriority = userRole === "client" && m.status === "SUBMITTED";
                return (
                  <tr key={m.milestoneId} className={isPriority ? "priority" : ""}>
                    <td className="name">{m.title}</td>
                    <td className="num">{fmtEur(m.amount)}</td>
                    {progressCell(m)}
                    <td>
                      <span className="evidence-count">📎 {evCount(m.evidence)} preuve(s)</span>
                    </td>
                    <td>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {m.revisionCount > 0 && <span className="hint"> (rév. {m.revisionCount})</span>}
                    </td>
                    <td>{actionButton(m)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bouton de clôture si tout est validé */}
        {allValidated && (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors"
            >
              🏁 Clôturer le contrat
            </button>
          </div>
        )}
      </div>

      {/* Modal détail */}
      {detailMilestone && userRole === "freelancer" && (
        <MilestoneDetailFreelancer
          milestone={detailMilestone}
          contractId={ctx.contractId}
          userId={userId || ""}
          onClose={() => setDetailId(null)}
          onAddEvidenceFile={(kind, file) => addEvidenceFile(detailMilestone.milestoneId, kind, file)}
          onRemoveEvidence={(kind, idx) => removeEvidence(detailMilestone.milestoneId, kind, idx)}
          onCaptureGeoloc={() => captureGeoloc(detailMilestone.milestoneId)}
          onRemoveGeoloc={() => removeGeoloc(detailMilestone.milestoneId)}
          onAddAutre={(label) => addAutre(detailMilestone.milestoneId, label)}
          onSubmit={() => submitMilestone(detailMilestone.milestoneId)}
          statusMap={statusMap}
        />
      )}

      {detailMilestone && userRole === "client" && (
        <MilestoneDetailClient
          milestone={detailMilestone}
          onClose={() => setDetailId(null)}
          onUpdateConstatee={(val) => updateConstatee(detailMilestone.milestoneId, val)}
          onValidate={() => validateMilestone(detailMilestone.milestoneId)}
          onReject={(motif) => rejectMilestone(detailMilestone.milestoneId, motif)}
          statusMap={statusMap}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// Styles CSS (repris des fichiers HTML)
// ═══════════════════════════════════════════════════════════

const PILOTAGE_STYLES = `
  :root {
    --paper: #FAFAF8; --panel: #FFFFFF; --ink: #1F1E1D; --line: #E1DFD8; --muted: #6B6862;
    --indigo: #534AB7; --indigo-bg: #EEEDFE; --indigo-text: #3C3489;
    --blue: #185FA5; --blue-bg: #E6F1FB; --blue-text: #0C447C;
    --green: #0F6E56; --green-bg: #E1F5EE; --green-text: #085041;
    --amber: #854F0B; --amber-bg: #FAEEDA; --amber-text: #633806;
    --red: #A32D2D; --red-bg: #FCEBEB; --red-text: #791F1F;
    --gray: #5F5E5A; --gray-bg: #F1EFE8; --gray-text: #44443F;
  }

  .summary-chip {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 16px;
  }
  .summary-chip .label {
    font-size: 11px;
    color: var(--muted);
    margin: 0 0 2px;
  }
  .summary-chip .value {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
  }

  .table-wrapper {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
  }
  .table-wrapper table {
    width: 100%;
    border-collapse: collapse;
  }
  .table-wrapper thead th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--muted);
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
    font-weight: 600;
    background: var(--gray-bg);
  }
  .table-wrapper tbody td {
    padding: 13px 14px;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
    vertical-align: middle;
  }
  .table-wrapper tbody tr:last-child td {
    border-bottom: none;
  }
  .table-wrapper tbody tr:hover td {
    background: #FAFAF5;
  }
  .table-wrapper tbody tr.priority td {
    background: var(--amber-bg);
  }
  .table-wrapper td.num {
    font-family: 'IBM Plex Mono', monospace;
    white-space: nowrap;
  }
  .table-wrapper td.name {
    font-weight: 600;
  }

  .badge {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    white-space: nowrap;
    display: inline-block;
  }
  .b-blue { background: var(--blue-bg); color: var(--blue-text); }
  .b-green { background: var(--green-bg); color: var(--green-text); }
  .b-amber { background: var(--amber-bg); color: var(--amber-text); }
  .b-red { background: var(--red-bg); color: var(--red-text); }
  .b-gray { background: var(--gray-bg); color: var(--gray-text); }

  .evidence-count {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }

  .progress-mini {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .progress-track {
    width: 60px;
    height: 6px;
    background: var(--line);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-cell .progress-track {
    flex: 1;
  }
  .progress-fill {
    height: 100%;
    background: var(--indigo);
    transition: width .15s ease;
  }
  .progress-fill.declared {
    background: #B9B6EE;
  }
  .progress-fill.constatee {
    background: var(--indigo);
  }
  .progress-fill.constatee.full {
    background: var(--green);
  }
  .progress-fill.constatee.partial {
    background: var(--amber);
  }

  .btn {
    padding: 7px 13px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    cursor: pointer;
    font-family: 'Inter', sans-serif;
  }
  .btn:hover { border-color: #B9C0BC; }
  .btn.primary { background: var(--indigo); border-color: var(--indigo); color: #fff; }
  .btn.green { background: var(--green); border-color: var(--green); color: #fff; }
  .btn.red { background: var(--red); border-color: var(--red); color: #fff; }
  .btn.amber { background: var(--amber); border-color: var(--amber); color: #fff; }
  .btn.sm { padding: 5px 10px; font-size: 11.5px; }
  .btn:disabled { opacity: 0.45; cursor: default; background: var(--gray-bg); border-color: var(--line); color: var(--gray-text); }

  .hint {
    font-size: 11.5px;
    color: var(--muted);
  }

  td.progress-cell {
    min-width: 130px;
  }
`;
