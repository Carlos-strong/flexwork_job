"use client";

/**
 * Panneau principal du workflow contractuel.
 * 
 * Affiche le stepper horizontal + le contenu de la phase active.
 * Gère son état localement (client component).
 * Synchronisation temps réel entre client et freelance via SSE.
 * Utilise les types et fonctions de lib/contract-workflow.ts.
 *
 * Règles métier :
 *   - Seul le client peut déposer les fonds en escrow
 *   - Double signature requise après financement
 *   - Une fois les deux signatures faites, activation automatique
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ContractPhase, ContractWorkflowContext } from "@/lib/contract-workflow";
import { WorkflowStepper } from "./stepper";
import { ContractViewer } from "@/components/contracts/contract-viewer";
import { SignatureQRCode } from "@/components/contracts/signature-qrcode";
import {
  canTransitionContract,
  advanceMilestone,
  calculatePlatformFees,
} from "@/lib/contract-workflow";
import { dispatchWorkflowIntent } from "@/lib/workflow-client";
import { DISPUTE_STEP_LABELS } from "./types";
import type { DisputeStep } from "./types";
import { MilestonePilotage } from "./pilotage";

// ── Props ──────────────────────────────────────────────────

interface ContractWorkflowPanelProps {
  initialContext: ContractWorkflowContext;
  contractTitle: string;
  clientName: string;
  freelancerName: string;
  contractAmount: number;
  /** Rôle de l'utilisateur connecté : "client" | "freelancer" */
  userRole: "client" | "freelancer";
  /** ID de l'utilisateur connecté (pour l'upload de preuves) */
  userId?: string;
}

// ── Helpers ────────────────────────────────────────────────

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " €";
}

function fmtPct(n: number): string {
  return Math.round(n).toString() + " %";
}

// ── Composant principal ────────────────────────────────────

export function ContractWorkflowPanel({
  initialContext,
  contractTitle,
  clientName,
  freelancerName,
  contractAmount,
  userRole,
  userId,
}: ContractWorkflowPanelProps) {
  const [ctx, setCtx] = useState<ContractWorkflowContext>(initialContext);
  const [isRedirecting, setIsRedirecting] = useState(false);
  // Signature locale (simulée côté client)
  const [clientSigned, setClientSigned] = useState(initialContext.signedByClient);
  const [freelancerSigned, setFreelancerSigned] = useState(initialContext.signedByFreelancer);

  const updateCtx = useCallback((newCtx: ContractWorkflowContext) => {
    setCtx(newCtx);
  }, []);

  // ── Auto-activation après double signature ──────────────
  // L'activation FUNDED → CONTRACT_ACTIVE est décidée par le SERVEUR lors de
  // la seconde signature (intention SIGN). Ici on ne fait qu'un affichage
  // optimiste : dès que les deux signatures sont connues localement, on montre
  // l'écran de transition puis on reflète CONTRACT_ACTIVE. Le contexte
  // renvoyé par le serveur (ou reçu en SSE) reste la source de vérité.
  useEffect(() => {
    if (ctx.phase === "FUNDED" && clientSigned && freelancerSigned) {
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        setIsRedirecting(false);
        setCtx((prev) =>
          prev.phase === "CONTRACT_ACTIVE"
            ? prev
            : {
                ...prev,
                phase: "CONTRACT_ACTIVE" as ContractPhase,
                signedByClient: true,
                signedByFreelancer: true,
                fullySignedAt: prev.fullySignedAt ?? new Date().toISOString(),
              }
        );
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [ctx.phase, clientSigned, freelancerSigned]);

  // Signature handlers — wrapped in useCallback to avoid render-phase setState
  const handleSign = useCallback((role: "client" | "freelancer") => {
    // Use requestAnimationFrame to defer state update outside render
    requestAnimationFrame(() => {
      if (role === "client") setClientSigned(true);
      else setFreelancerSigned(true);
    });
  }, []);

  // ── Synchronisation temps réel via SSE ─────────────────
  const esRef = useRef<EventSource | null>(null);
  const phaseRef = useRef<ContractPhase>(initialContext.phase);
  // Maintenir le ref à jour pour éviter les closures stale dans le handler SSE
  useEffect(() => { phaseRef.current = ctx.phase; }, [ctx.phase]);

  useEffect(() => {
    const contractId = ctx.contractId;
    if (!contractId) return;

    const connect = () => {
      const es = new EventSource(`/api/sse?room=${encodeURIComponent(contractId)}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "workflow_update") {
            const data = event.data as {
              phase?: string;
              disputeStep?: string;
              clientSigned?: boolean;
              freelancerSigned?: boolean;
              fullySignedAt?: string;
              milestoneId?: string;
              milestoneStatus?: string;
            };

            // Synchroniser la phase — utiliser le ref pour éviter la closure stale
            if (data.phase && data.phase !== phaseRef.current) {
              setCtx((prev) => ({ ...prev, phase: data.phase as ContractPhase }));
            }

            // Synchroniser la sous-étape de litige (phase 6) reçue de l'autre partie
            if (data.disputeStep) {
              setCtx((prev) =>
                prev.disputeStep === data.disputeStep
                  ? prev
                  : { ...prev, disputeStep: data.disputeStep as ContractWorkflowContext["disputeStep"] }
              );
            }

            // Synchroniser les signatures (provenant de l'autre partie)
            if (data.clientSigned) setClientSigned(true);
            if (data.freelancerSigned) setFreelancerSigned(true);

            // Synchroniser l'horodatage de double signature
            if (data.fullySignedAt) {
              setCtx((prev) => ({ ...prev, fullySignedAt: data.fullySignedAt }));
            }

            // Synchroniser les milestones
            if (data.milestoneId && data.milestoneStatus) {
              const msId = data.milestoneId;
              const msStatus = data.milestoneStatus;
              setCtx((prev) => {
                // Si le jalon est NOT_STARTED et qu'on reçoit SUBMITTED, auto-démarrer d'abord
                let current = prev;
                const ms = current.milestones.find((m) => m.milestoneId === msId);
                if (ms && ms.status === "NOT_STARTED" && msStatus === "SUBMITTED") {
                  const startResult = advanceMilestone(current, msId, "IN_PROGRESS");
                  if (startResult.success) current = startResult.context;
                }
                const result = advanceMilestone(
                  current,
                  msId,
                  msStatus as "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "VALIDATED"
                );
                return result.success ? result.context : current;
              });
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [ctx.contractId]);

  // ── Mutations : intentions envoyées au serveur (autoritaire) ──
  const [actionError, setActionError] = useState<string | null>(null);

  // Transition de phase (financement, clôture…) via intention ADVANCE_PHASE.
  const handleTransitionWithSync = useCallback(
    async (to: ContractPhase) => {
      if (!canTransitionContract(ctx.phase, to)) return;
      // Optimiste : refléter immédiatement, puis réconcilier avec le serveur.
      setCtx((prev) => ({ ...prev, phase: to }));
      const result = await dispatchWorkflowIntent(ctx.contractId, { action: "ADVANCE_PHASE", to });
      if (result.ok && result.context) {
        setActionError(null);
        setCtx(result.context);
      } else {
        // Rejet serveur (garde métier non satisfaite) : revenir à l'état réel.
        setActionError(result.error ?? "Action refusée");
        setCtx((prev) => ({ ...prev, phase: ctx.phase }));
      }
    },
    [ctx]
  );

  // Signature : intention SIGN. Le serveur active le contrat à la 2ᵉ signature.
  const handleSignWithSync = useCallback(
    async (role: "client" | "freelancer") => {
      // Optimiste
      if (role === "client") setClientSigned(true);
      else setFreelancerSigned(true);
      const result = await dispatchWorkflowIntent(ctx.contractId, { action: "SIGN" });
      if (result.ok && result.context) {
        setActionError(null);
        setClientSigned(result.context.signedByClient);
        setFreelancerSigned(result.context.signedByFreelancer);
        setCtx(result.context);
      } else {
        setActionError(result.error ?? "Signature refusée");
      }
    },
    [ctx.contractId]
  );

  // ── Rendu ──────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F4F3EF]">
      {/* Stepper horizontal */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#E2E0D9]">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2D5BE3] flex items-center justify-center">
              <span className="text-white text-xs font-bold">FW</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#1A1916] leading-tight">
                Pilotage du contrat
              </h1>
              <p className="text-[11px] text-[#5A5750]">{ctx.contractId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#5A5750]">Montant</span>
            <span className="text-sm font-bold text-[#2D5BE3]">{fmtEur(contractAmount)}</span>
          </div>
        </div>
        <WorkflowStepper
          currentPhase={ctx.phase}
          isDisputeActive={ctx.phase === "DISPUTE_OPENED"}
        />
      </div>

      {/* Bandeau d'erreur d'action (garde métier refusée par le serveur) */}
      {actionError && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <p className="text-sm text-red-700 flex-1">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-600 text-sm"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Contenu de la phase */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {renderPhaseContent(
          ctx,
          contractTitle,
          clientName,
          freelancerName,
          contractAmount,
          handleTransitionWithSync,
          updateCtx,
          userRole,
          clientSigned,
          freelancerSigned,
          handleSignWithSync,
          userId
        )}
      </div>

      {/* Overlay de redirection */}
      {isRedirecting && (
        <div className="fixed inset-0 z-50 bg-[#F4F3EF] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-3 border-[#E2E0D9] border-t-[#2D5BE3] rounded-full animate-spin" />
          <p className="text-[#2D5BE3] font-semibold text-lg">Activation du contrat...</p>
          <p className="text-[#5A5750] text-sm">Redirection vers le pilotage</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Rendu par phase
// ═══════════════════════════════════════════════════════════

function renderPhaseContent(
  ctx: ContractWorkflowContext,
  contractTitle: string,
  clientName: string,
  freelancerName: string,
  contractAmount: number,
  onTransition: (to: ContractPhase) => void,
  onCtxUpdate: (newCtx: ContractWorkflowContext) => void,
  userRole: "client" | "freelancer",
  clientSigned: boolean,
  freelancerSigned: boolean,
  onSign: (role: "client" | "freelancer") => void,
  userId?: string
) {
  switch (ctx.phase) {
    case "NEGOTIATION":
    case "TERMS_LOCKED":
    case "CONTRACT_GENERATED":
      return (
        <PhaseContract
          ctx={ctx}
          contractTitle={contractTitle}
          clientName={clientName}
          freelancerName={freelancerName}
          contractAmount={contractAmount}
          onNext={() => onTransition("PENDING_FUNDING")}
        />
      );
    case "PENDING_FUNDING":
    case "FUNDED":
      return (
        <PhaseFunding
          ctx={ctx}
          contractAmount={contractAmount}
          userRole={userRole}
          clientName={clientName}
          freelancerName={freelancerName}
          clientSigned={clientSigned}
          freelancerSigned={freelancerSigned}
          onFund={() => onTransition("FUNDED")}
          onSign={onSign}
        />
      );
    case "CONTRACT_ACTIVE":
      return (
        <PhasePilotage
          ctx={ctx}
          onCtxUpdate={onCtxUpdate}
          onClose={() => onTransition("CLOSING")}
          userRole={userRole}
          userId={userId}
        />
      );
    case "CLOSING":
    case "COMPLETED":
      return (
        <PhaseClosing
          ctx={ctx}
          contractAmount={contractAmount}
          clientName={clientName}
          freelancerName={freelancerName}
          userRole={userRole}
          onComplete={() => onTransition("COMPLETED")}
        />
      );
    case "DISPUTE_OPENED":
      return (
        <PhaseDispute
          ctx={ctx}
          onCtxUpdate={onCtxUpdate}
        />
      );
    case "DISPUTE_RESOLVED":
      return (
        <PhaseDisputeResolved
          ctx={ctx}
          contractAmount={contractAmount}
          onComplete={() => onTransition("COMPLETED")}
        />
      );
    case "CANCELLED":
      return <PhaseCancelled />;
    default:
      return <p className="text-[#5A5750]">Phase inconnue</p>;
  }
}

// ═══════════════════════════════════════════════════════════
// Phase 0/1 — Contrat généré
// ═══════════════════════════════════════════════════════════

function PhaseContract({
  ctx,
  contractTitle,
  clientName,
  freelancerName,
  contractAmount,
  onNext,
}: {
  ctx: ContractWorkflowContext;
  contractTitle: string;
  clientName: string;
  freelancerName: string;
  contractAmount: number;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
          Phase 1
        </span>
        <h2 className="text-2xl font-bold text-[#1A1916] mt-2">Contrat de prestation généré</h2>
        <p className="text-sm text-[#5A5750] mt-1">
          Le contrat ci-dessous a été généré automatiquement. Il sera signé électroniquement après financement.
        </p>
      </div>

      {/* Aperçu du contrat via le lecteur intégré */}
      <ContractViewer
        contractId={ctx.contractId}
        contractTitle={contractTitle}
      />

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2D5BE3] text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          Passer au financement
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Phase 2/3 — Financement (client) puis Signature (double)
// ═══════════════════════════════════════════════════════════

function PhaseFunding({
  ctx,
  contractAmount,
  userRole,
  clientName,
  freelancerName,
  clientSigned,
  freelancerSigned,
  onFund,
  onSign,
}: {
  ctx: ContractWorkflowContext;
  contractAmount: number;
  userRole: "client" | "freelancer";
  clientName: string;
  freelancerName: string;
  clientSigned: boolean;
  freelancerSigned: boolean;
  onFund: () => void;
  onSign: (role: "client" | "freelancer") => void;
}) {
  const funded = ctx.phase === "FUNDED";
  const bothSigned = clientSigned && freelancerSigned;
  const canSignClient = userRole === "client" && !clientSigned;
  const canSignFreelancer = userRole === "freelancer" && !freelancerSigned;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
            funded ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
          }`}
        >
          Phase {funded ? "3" : "2"}
        </span>
        <h2 className="text-2xl font-bold text-[#1A1916] mt-2">
          {funded ? "Fonds sécurisés — Signature" : "Financement du contrat"}
        </h2>
        <p className="text-sm text-[#5A5750] mt-1">
          {!funded
            ? "Seul le client peut déposer les fonds en séquestre. La signature sera requise ensuite."
            : bothSigned
            ? "Double signature confirmée — activation automatique en cours..."
            : "Les deux parties doivent signer électroniquement pour activer le contrat."}
        </p>
      </div>

      {/* Montant */}
      <div className="bg-white rounded-xl border border-[#E2E0D9] p-8 text-center">
        <div
          className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${
            funded ? "bg-green-50" : "bg-blue-50"
          }`}
        >
          <span className="text-2xl">{funded ? "✅" : "💰"}</span>
        </div>
        <p className={`text-3xl font-bold ${funded ? "text-green-600" : "text-[#2D5BE3]"}`}>
          {fmtEur(contractAmount)}
        </p>
        <p className="text-sm text-[#5A5750] mt-1">
          {funded ? "Séquestre actif — fonds bloqués" : "Montant à bloquer en séquestre"}
        </p>
      </div>

      {!funded ? (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <span className="text-blue-500 mt-0.5">ℹ️</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Précondition de signature</p>
              <p>Le financement intégral par le client est obligatoire avant la double signature. Les fonds restent bloqués jusqu&apos;à la clôture.</p>
            </div>
          </div>
          {userRole === "client" ? (
            <div className="flex justify-end">
              <button
                onClick={onFund}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2D5BE3] text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Verser les fonds en séquestre
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex items-center gap-3">
              <span className="text-amber-500">⏳</span>
              <div>
                <p className="text-sm text-amber-700 font-medium">
                  En attente du dépôt des fonds par le client
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Vous serez notifié dès que les fonds seront déposés pour passer à la signature du contrat.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Séquestre confirmé */}
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center gap-3">
            <span className="text-green-500">✅</span>
            <div>
              <span className="text-sm text-green-700 font-medium">
                Séquestre confirmé — fonds déposés par le client
              </span>
              {userRole === "freelancer" && !clientSigned && !freelancerSigned && (
                <p className="text-xs text-green-600 mt-0.5">
                  Le client a effectué le dépôt. Passez à la signature pour activer le contrat.
                </p>
              )}
              {userRole === "client" && !clientSigned && !freelancerSigned && (
                <p className="text-xs text-green-600 mt-0.5">
                  Fonds déposés avec succès. Signez le contrat pour l&apos;activer.
                </p>
              )}
            </div>
          </div>

          {/* Bouton "Passer à la signature" (première visite après funding) */}
          {!clientSigned && !freelancerSigned && (
            <div className="bg-white rounded-xl border border-[#E2E0D9] p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#2D5BE3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#1A1916] mb-2">
                Prêt pour la signature électronique
              </h3>
              <p className="text-sm text-[#5A5750] mb-5">
                Les fonds sont sécurisés. Les deux parties doivent signer le contrat pour l&apos;activer.
                Chaque signature génère un QR code cryptographique vérifiable.
              </p>
              <button
                onClick={() => {
                  // Scroll smooth vers les blocs de signature
                  const el = document.getElementById("signature-blocks");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D5BE3] text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Passer à la signature du contrat
              </button>
            </div>
          )}

          {/* Blocs de signature */}
          <div id="signature-blocks" className="grid grid-cols-2 gap-4">
            {/* Signature client */}
            <div className={`bg-white rounded-xl border p-5 text-center transition-all ${clientSigned ? "border-green-300 bg-green-50/30" : "border-[#E2E0D9]"}`}>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-500 text-sm font-bold">{clientName?.charAt(0) || "C"}</span>
              </div>
              <p className="text-sm font-semibold text-[#1A1916]">{clientName || "Client"}</p>
              <p className="text-[11px] text-[#5A5750] mb-3">Client</p>
              {clientSigned ? (
                <SignatureQRCode
                  contractId={ctx.contractId}
                  role="client"
                  signerName={clientName || "Client"}
                  signedAt={new Date().toISOString()}
                  size={90}
                />
              ) : canSignClient ? (
                <button
                  onClick={() => onSign("client")}
                  className="px-4 py-2 bg-[#2D5BE3] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Signer le contrat
                </button>
              ) : (
                <span className="text-[11px] text-[#5A5750]">En attente</span>
              )}
            </div>

            {/* Signature freelance */}
            <div className={`bg-white rounded-xl border p-5 text-center transition-all ${freelancerSigned ? "border-green-300 bg-green-50/30" : "border-[#E2E0D9]"}`}>
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-sm font-bold">{freelancerName?.charAt(0) || "P"}</span>
              </div>
              <p className="text-sm font-semibold text-[#1A1916]">{freelancerName || "Prestataire"}</p>
              <p className="text-[11px] text-[#5A5750] mb-3">Prestataire</p>
              {freelancerSigned ? (
                <SignatureQRCode
                  contractId={ctx.contractId}
                  role="freelancer"
                  signerName={freelancerName || "Prestataire"}
                  signedAt={new Date().toISOString()}
                  size={90}
                />
              ) : canSignFreelancer ? (
                <button
                  onClick={() => onSign("freelancer")}
                  className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Signer le contrat
                </button>
              ) : (
                <span className="text-[11px] text-[#5A5750]">En attente</span>
              )}
            </div>
          </div>

          {/* Statut signatures */}
          {!bothSigned && (
            <div className="bg-white rounded-xl border border-[#E2E0D9] p-4 text-center">
              <p className="text-sm text-[#5A5750]">
                {!clientSigned && !freelancerSigned
                  ? "En attente des signatures client et prestataire"
                  : !clientSigned
                  ? "En attente de la signature du client"
                  : "En attente de la signature du prestataire"}
              </p>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <div className={`w-2 h-2 rounded-full ${clientSigned ? "bg-green-500" : "bg-gray-300"}`} />
                  Client
                </div>
                <div className="w-8 h-0.5 bg-[#E2E0D9]" />
                <div className="flex items-center gap-1.5 text-[11px]">
                  <div className={`w-2 h-2 rounded-full ${freelancerSigned ? "bg-green-500" : "bg-gray-300"}`} />
                  Prestataire
                </div>
              </div>
            </div>
          )}

          {bothSigned && (
            <div className="space-y-3">
              {/* Confirmation */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-green-700 font-medium">
                  Double signature confirmée — activation automatique du contrat...
                </span>
              </div>

              {/* Téléchargement du contrat signé */}
              <div className="bg-white rounded-xl border border-[#E2E0D9] p-5">
                <p className="text-sm font-semibold text-[#1A1916] mb-3">
                  📜 Contrat définitif signé
                </p>
                <p className="text-xs text-[#5A5750] mb-4">
                  Le contrat signé électroniquement est disponible au téléchargement pour les deux parties.
                  Chaque copie inclut les QR codes de signature vérifiables.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`/api/contracts/${ctx.contractId}/document?format=html`, "_blank")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E2E0D9] text-[#1A1916] text-xs font-semibold rounded-lg hover:bg-[#F4F3EF] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" rx="1" />
                    </svg>
                    Imprimer / PDF
                  </button>
                  <button
                    onClick={() => window.open(`/api/contracts/${ctx.contractId}/document?format=docx`, "_blank")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2D5BE3] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Télécharger DOCX
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Phase 4 — Pilotage par jalons
// ═══════════════════════════════════════════════════════════

function PhasePilotage({
  ctx,
  onCtxUpdate,
  onClose,
  userRole,
  userId,
}: {
  ctx: ContractWorkflowContext;
  onCtxUpdate: (newCtx: ContractWorkflowContext) => void;
  onClose: () => void;
  userRole: "client" | "freelancer";
  userId?: string;
}) {
  return (
    <MilestonePilotage
      ctx={ctx}
      onCtxUpdate={onCtxUpdate}
      onClose={onClose}
      userRole={userRole}
      userId={userId}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// Phase 5 — Clôture
// ═══════════════════════════════════════════════════════════

function PhaseClosing({
  ctx,
  contractAmount,
  clientName,
  freelancerName,
  userRole,
  onComplete,
}: {
  ctx: ContractWorkflowContext;
  contractAmount: number;
  clientName: string;
  freelancerName: string;
  userRole: "client" | "freelancer";
  onComplete: () => void;
}) {
  const completed = ctx.phase === "COMPLETED";
  const validatedAmount = ctx.milestones
    .filter((m) => m.status === "VALIDATED")
    .reduce((s, m) => s + m.amount, 0);

  // Ventilation des frais de plateforme (commission alignée CGU/tarifs).
  const { feeAmount, freelancerNet } = calculatePlatformFees(
    validatedAmount,
    ctx.platformFeePercent
  );

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
            completed ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
          }`}
        >
          Phase 4
        </span>
        <h2 className="text-2xl font-bold text-[#1A1916] mt-2">
          {completed ? "Contrat terminé" : "Clôture normale"}
        </h2>
        <p className="text-sm text-[#5A5750] mt-1">
          {completed
            ? "Tous les fonds ont été libérés vers le prestataire."
            : "Paiement intégral unique — tous les jalons sont validés."}
        </p>
      </div>

      {/* Récapitulatif */}
      <div className="bg-white rounded-xl border border-[#E2E0D9] p-6">
        <h3 className="text-sm font-bold text-[#1A1916] mb-4">Récapitulatif de libération</h3>
        <div className="space-y-3">
          {ctx.milestones
            .filter((m) => m.status === "VALIDATED")
            .map((m) => (
              <div
                key={m.milestoneId}
                className="flex items-center justify-between py-2 border-b border-[#E2E0D9] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-[#1A1916]">{m.title}</span>
                </div>
                <span className="text-sm font-semibold text-green-600 font-mono">
                  + {fmtEur(m.amount)}
                </span>
              </div>
            ))}
          <div className="flex items-center justify-between pt-3 border-t border-[#E2E0D9]">
            <span className="text-sm font-medium text-[#1A1916]">Montant brut validé</span>
            <span className="text-sm font-bold text-[#1A1916] font-mono">{fmtEur(validatedAmount)}</span>
          </div>
        </div>
      </div>

      {/* Ventilation frais de plateforme / montant net */}
      <div className="bg-white rounded-xl border border-[#E2E0D9] p-6">
        <h3 className="text-sm font-bold text-[#1A1916] mb-4">Frais de plateforme &amp; montant net</h3>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#5A5750]">Montant brut</span>
            <span className="font-mono text-[#1A1916]">{fmtEur(validatedAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5A5750]">
              Commission plateforme ({fmtPct(ctx.platformFeePercent)})
            </span>
            <span className="font-mono text-red-600">− {fmtEur(feeAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t-2 border-green-500/30">
            <span className="text-base font-bold text-[#1A1916]">Net versé au prestataire</span>
            <span className="text-lg font-bold text-green-600 font-mono">{fmtEur(freelancerNet)}</span>
          </div>
        </div>
      </div>

      {!completed ? (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <span className="text-blue-500 mt-0.5">ℹ️</span>
            <p className="text-sm text-blue-700">
              Ce paiement unique regroupe l&apos;intégralité des montants validés, déduction faite
              de la commission de plateforme. Aucun versement intermédiaire n&apos;a été effectué.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors"
            >
              Libérer le paiement intégral
            </button>
          </div>
        </>
      ) : (
        <div className="bg-green-50 border border-green-100 rounded-xl p-8 text-center">
          <span className="text-4xl">🎉</span>
          <h3 className="font-bold text-xl text-green-700 mt-3">Contrat mené à terme</h3>
          <p className="text-sm text-green-600 mt-1">
            Montant net versé à {freelancerName} : {fmtEur(freelancerNet)}
          </p>
          <a
            href={`/dashboard/${userRole}/avis`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white border border-green-200 px-5 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            ⭐ Laisser un avis
          </a>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Phase 6 — Litige
// ═══════════════════════════════════════════════════════════

function PhaseDispute({
  ctx,
  onCtxUpdate,
}: {
  ctx: ContractWorkflowContext;
  onCtxUpdate: (newCtx: ContractWorkflowContext) => void;
}) {
  const currentStep: DisputeStep = ctx.disputeStep || "PURGE";
  const [appealEvidence, setAppealEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  const disputeSteps: DisputeStep[] = [
    "PURGE",
    "PRORATA_CALCULATED",
    "APPEAL_WINDOW",
    "MEDIATION",
    "ARBITRATION",
  ];
  const currentIdx = disputeSteps.indexOf(currentStep);

  const submitted = ctx.milestones.filter((m) => m.status === "SUBMITTED");
  const validatedAmount = ctx.milestones
    .filter((m) => m.status === "VALIDATED")
    .reduce((s, m) => s + m.amount, 0);
  const totalAmount = ctx.milestones.reduce((s, m) => s + m.amount, 0);

  // Fait avancer le litige via une intention serveur (revalidation métier
  // côté serveur : preuve d'appel obligatoire, seuil d'arbitrage…).
  const handleAdvanceDispute = async (to: DisputeStep, opts?: { appealEvidence?: string }) => {
    const result = await dispatchWorkflowIntent(ctx.contractId, {
      action: "ADVANCE_DISPUTE",
      to,
      appealEvidence: opts?.appealEvidence,
    });
    if (result.ok && result.context) {
      setError(null);
      onCtxUpdate(result.context);
    } else {
      setError(result.error ?? "Transition impossible.");
    }
  };

  // Tranche un jalon pendant la purge (validation/rejet) via intention serveur.
  const handlePurgeMilestone = async (milestoneId: string, decision: "validate" | "reject") => {
    const result =
      decision === "validate"
        ? await dispatchWorkflowIntent(ctx.contractId, { action: "VALIDATE_MILESTONE", milestoneId })
        : await dispatchWorkflowIntent(ctx.contractId, {
            action: "REJECT_MILESTONE",
            milestoneId,
            rejectionReason: "Rejeté lors de la purge",
          });
    if (result.ok && result.context) {
      setError(null);
      onCtxUpdate(result.context);
    } else {
      setError(result.error ?? "Décision impossible.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-600">
          Phase 6
        </span>
        <span className="text-xs text-[#5A5750]">Litige déclenché — Article 10</span>
      </div>
      <h2 className="text-2xl font-bold text-[#1A1916]">Gestion du litige</h2>
      <p className="text-sm text-[#5A5750]">
        Procédure mécanique et séquentielle, sans marge d&apos;interprétation.
      </p>

      {/* Étapes du litige */}
      <div className="flex flex-wrap gap-2">
        {disputeSteps.map((step, idx) => {
          const isDone = idx < currentIdx || currentStep === "DISPUTE_RESOLVED";
          const isActive = idx === currentIdx && currentStep !== "DISPUTE_RESOLVED";
          return (
            <div
              key={step}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : isDone
                  ? "text-green-600"
                  : "text-[#5A5750] bg-gray-50"
              }`}
            >
              <span className="font-mono text-[10px] opacity-60">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span>{DISPUTE_STEP_LABELS[step]}</span>
              {isDone && <span>✓</span>}
            </div>
          );
        })}
      </div>

      {/* Bannière d'erreur (ex. appel irrecevable, arbitrage non éligible) */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <span className="text-red-500 mt-0.5">⚠️</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Contenu de l'étape active */}
      <div className="bg-white rounded-xl border border-[#E2E0D9] p-6">
        {currentStep === "PURGE" && (
          <div className="space-y-4">
            <h3 className="font-bold text-red-600">Purge des jalons soumis</h3>
            <p className="text-sm text-[#5A5750]">
              Tous les jalons en attente doivent être tranchés. La validation tacite reste active.
            </p>
            {submitted.length === 0 ? (
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700">
                ✓ Tous les jalons soumis ont été tranchés.
              </div>
            ) : (
              <div className="space-y-2">
                {submitted.map((m) => (
                  <div
                    key={m.milestoneId}
                    className="flex items-center justify-between p-3 bg-[#F4F3EF] rounded-lg"
                  >
                    <span className="text-sm">{m.title}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePurgeMilestone(m.milestoneId, "validate")}
                        className="px-3 py-1 bg-green-500 text-white text-[11px] rounded-md"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => handlePurgeMilestone(m.milestoneId, "reject")}
                        className="px-3 py-1 bg-red-50 text-red-600 text-[11px] rounded-md border border-red-200"
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {submitted.length === 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleAdvanceDispute("PRORATA_CALCULATED")}
                  className="px-4 py-2 bg-[#2D5BE3] text-white text-sm rounded-lg"
                >
                  Calculer le prorata →
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === "PRORATA_CALCULATED" && (
          <div className="space-y-4">
            <h3 className="font-bold text-red-600">Calcul mécanique du prorata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-xs text-green-600">Libéré</p>
                <p className="text-xl font-bold text-green-700">{fmtEur(validatedAmount)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-xs text-red-600">Retenu</p>
                <p className="text-xl font-bold text-red-700">
                  {fmtEur(totalAmount - validatedAmount)}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => handleAdvanceDispute("APPEAL_WINDOW")}
                className="px-4 py-2 bg-[#2D5BE3] text-white text-sm rounded-lg"
              >
                Ouvrir la fenêtre d&apos;appel →
              </button>
            </div>
          </div>
        )}

        {currentStep === "APPEAL_WINDOW" && (
          <div className="space-y-4">
            <h3 className="font-bold text-amber-600">Fenêtre d&apos;appel (48h)</h3>
            <p className="text-sm text-[#5A5750]">
              Chaque partie peut contester le prorata avec une preuve obligatoire. Frais remboursables si l&apos;appel aboutit.
            </p>
            {/* Preuve d'appel obligatoire — sans elle, la médiation est irrecevable */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1916] mb-1">
                Motif et preuve de l&apos;appel <span className="text-red-500">*</span>
              </label>
              <textarea
                value={appealEvidence}
                onChange={(e) => setAppealEvidence(e.target.value)}
                rows={3}
                placeholder="Décrivez le motif de contestation et joignez les éléments de preuve…"
                className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30"
              />
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => handleAdvanceDispute("DISPUTE_RESOLVED")}
                className="px-4 py-2 text-[#5A5750] text-sm border rounded-lg"
              >
                Renoncer à l&apos;appel
              </button>
              <button
                onClick={() =>
                  handleAdvanceDispute("MEDIATION", {
                    appealEvidence: appealEvidence.trim(),
                  })
                }
                disabled={!appealEvidence.trim()}
                type="button"
                className="px-4 py-2 bg-[#2D5BE3] text-white text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Médiation →
              </button>
            </div>
          </div>
        )}

        {(currentStep === "MEDIATION" || currentStep === "ARBITRATION") && (
          <div className="space-y-4">
            <h3 className="font-bold text-blue-600">
              {currentStep === "MEDIATION" ? "Médiation interne" : "Arbitrage externe"}
            </h3>
            <p className="text-sm text-[#5A5750]">
              {currentStep === "MEDIATION"
                ? "Décision limitée aux jalons contestés, définitive et sans appel."
                : "Option disponible car l'enjeu dépasse le seuil configurable."}
            </p>
            <div className="flex justify-between">
              <button
                onClick={() => handleAdvanceDispute("DISPUTE_RESOLVED")}
                className="px-4 py-2 text-[#5A5750] text-sm border rounded-lg"
              >
                Résoudre le litige
              </button>
              {currentStep === "MEDIATION" && (
                <button
                  onClick={() => handleAdvanceDispute("ARBITRATION")}
                  className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg"
                >
                  Arbitrage externe →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Phase 6b — Litige résolu
// ═══════════════════════════════════════════════════════════

function PhaseDisputeResolved({
  ctx,
  contractAmount,
  onComplete,
}: {
  ctx: ContractWorkflowContext;
  contractAmount: number;
  onComplete: () => void;
}) {
  const validatedAmount = ctx.milestones
    .filter((m) => m.status === "VALIDATED")
    .reduce((s, m) => s + m.amount, 0);
  const retainedAmount = contractAmount - validatedAmount;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-green-50 text-green-600">
          Litige résolu
        </span>
        <h2 className="text-2xl font-bold text-[#1A1916] mt-2">Litige résolu</h2>
        <p className="text-sm text-[#5A5750] mt-1">
          Les fonds sont libérés selon la répartition finale.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl p-5 text-center">
          <p className="text-xs text-green-600">Libéré</p>
          <p className="text-2xl font-bold text-green-700">{fmtEur(validatedAmount)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-5 text-center">
          <p className="text-xs text-red-600">Retenu</p>
          <p className="text-2xl font-bold text-red-700">{fmtEur(retainedAmount)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onComplete}
          className="px-6 py-2.5 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600"
        >
          Finaliser le contrat
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Phase annulée
// ═══════════════════════════════════════════════════════════

function PhaseCancelled() {
  return (
    <div className="max-w-lg mx-auto text-center py-16 space-y-4 animate-in fade-in duration-500">
      <span className="text-5xl">❌</span>
      <h2 className="text-2xl font-bold text-[#1A1916]">Contrat annulé</h2>
      <p className="text-sm text-[#5A5750]">
        Ce contrat a été annulé. Les fonds en séquestre seront restitués.
      </p>
    </div>
  );
}
