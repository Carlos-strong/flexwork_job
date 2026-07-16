/**
 * Service de workflow contractuel — SOURCE DE VÉRITÉ CÔTÉ SERVEUR.
 *
 * Toute mutation d'état d'un contrat (phase, signature, jalon, litige) passe
 * par ce service. Il :
 *   1. lit l'état courant en base,
 *   2. le convertit en ContractWorkflowContext,
 *   3. applique la transition via les fonctions pures de lib/contract-workflow.ts
 *      (qui portent les gardes métier : double signature, 100 % validé avant
 *      clôture, preuve d'appel obligatoire, seuil d'arbitrage…),
 *   4. persiste le nouvel état,
 *   5. renvoie le contexte à jour.
 *
 * Le front n'envoie plus que des INTENTIONS ; il n'écrit jamais l'état brut.
 * Les gardes métier ne sont donc plus contournables par un appel API direct.
 */

import { prisma } from "@/lib/prisma";
import {
  advanceContractPhase,
  advanceMilestone,
  advanceDisputeStep,
  calculateProrata,
  calculatePlatformFees,
  CONTRACT_PHASE_TO_PRISMA,
  MILESTONE_STATUS_TO_PRISMA,
  type ContractPhase,
  type ContractWorkflowContext,
  type DisputeStep,
  type MilestoneWorkflowStatus,
  type TransitionResult,
} from "@/lib/contract-workflow";
import type { ContractRole } from "@/lib/contract-access";

// ── Mapping Prisma → Workflow ──────────────────────────────

const PRISMA_TO_WORKFLOW_STATUS: Record<string, MilestoneWorkflowStatus> = {
  PENDING: "NOT_STARTED",
  IN_REVIEW: "SUBMITTED",
  APPROVED: "VALIDATED",
  RELEASED: "VALIDATED",
};

/**
 * Déduit la phase du workflow. On privilégie la phase persistée
 * (workflowPhase) ; à défaut (anciens contrats), on la reconstruit à partir
 * du statut Prisma et de la présence de signatures.
 */
function resolvePhase(
  status: string,
  workflowPhase: string | null,
  hasSignatures: boolean
): ContractPhase {
  if (workflowPhase) return workflowPhase as ContractPhase;
  switch (status) {
    case "PENDING":
      return hasSignatures ? "FUNDED" : "CONTRACT_GENERATED";
    case "ACTIVE":
      return "CONTRACT_ACTIVE";
    case "COMPLETED":
      return "COMPLETED";
    case "DISPUTED":
      return "DISPUTE_OPENED";
    default:
      return "NEGOTIATION";
  }
}

// ── Construction du contexte depuis la base ────────────────

export async function buildWorkflowContext(
  contractId: string
): Promise<ContractWorkflowContext | null> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { milestones: { orderBy: { createdAt: "asc" } } },
  });
  if (!contract) return null;

  const hasSignatures = !!(contract.clientSignedAt || contract.freelancerSignedAt);
  const phase = resolvePhase(contract.status, contract.workflowPhase, hasSignatures);

  const milestones = contract.milestones.map((m) => ({
    milestoneId: m.id,
    title: m.title,
    amount: m.amount,
    executionRate: m.executionRate ?? 0,
    status: PRISMA_TO_WORKFLOW_STATUS[m.status] ?? "NOT_STARTED",
    // Le modèle Milestone n'a pas de champ updatedAt : on ne dispose pas d'un
    // horodatage de soumission distinct. La validation tacite s'appuie sur la
    // présence du statut soumis plutôt que sur un délai précis ici.
    submittedAt: undefined,
    validatedAt: m.completedAt?.toISOString(),
    rejectedAt: m.rejectedAt?.toISOString(),
    rejectionReason: m.rejectionReason ?? undefined,
    evidence: m.proofs ?? undefined,
    revisionCount: m.revisionCount ?? 0,
  }));

  const validatedCount = contract.milestones.filter(
    (m) => m.status === "APPROVED" || m.status === "RELEASED"
  ).length;
  const rejectionCount = contract.milestones.reduce(
    (s, m) => s + (m.revisionCount ?? 0),
    0
  );

  return {
    contractId: contract.id,
    phase,
    disputeStep: (contract.disputeStep as DisputeStep | null) ?? undefined,
    milestones,
    totalMilestones: contract.milestones.length,
    validatedCount,
    rejectionCount,
    maxRejectionsBeforeDispute: 5,
    signedByClient: !!contract.clientSignedAt,
    signedByFreelancer: !!contract.freelancerSignedAt,
    fullySignedAt: contract.fullySignedAt?.toISOString(),
    prorataClientShare: 0,
    prorataFreelancerShare: 0,
    appealOpenedAt: contract.appealOpenedAt?.toISOString(),
    appealFeeRefundable: true,
    appealFeeAmount: 0,
    contestedMilestoneIds: contract.milestones
      .filter((m) => m.status !== "APPROVED" && m.status !== "RELEASED")
      .map((m) => m.id),
    arbitrationThreshold: 5000,
    tacitValidationDays: 7,
    platformFeePercent: 5,
    platformFeeAmount: 0,
  };
}

// ── Intentions ─────────────────────────────────────────────

export type WorkflowIntent =
  | { action: "ADVANCE_PHASE"; to: ContractPhase }
  | { action: "SIGN" }
  | {
      action: "SUBMIT_MILESTONE";
      milestoneId: string;
      evidence?: unknown;
      executionRate?: number;
    }
  | { action: "VALIDATE_MILESTONE"; milestoneId: string; executionRate?: number }
  | { action: "REJECT_MILESTONE"; milestoneId: string; rejectionReason: string }
  | {
      action: "ADVANCE_DISPUTE";
      to: DisputeStep;
      appealEvidence?: string;
      mediationOutcome?: "freelancer" | "client" | "split";
      arbitrationFees?: number;
      appealSuccessful?: boolean;
    };

export interface ApplyIntentResult {
  ok: boolean;
  status: number;
  error?: string;
  context?: ContractWorkflowContext;
  /** Effet de bord à diffuser en SSE (phase, milestone, signature…) */
  broadcast?: Record<string, unknown>;
}

/**
 * Vérifie que le rôle a le droit d'exécuter l'intention.
 * Retourne un message d'erreur, ou null si autorisé.
 */
function checkRolePermission(
  intent: WorkflowIntent,
  role: ContractRole,
  ctx: ContractWorkflowContext
): string | null {
  switch (intent.action) {
    case "SUBMIT_MILESTONE":
      return role === "freelancer" ? null : "Seul le prestataire peut soumettre un jalon";
    case "VALIDATE_MILESTONE":
    case "REJECT_MILESTONE":
      return role === "client" ? null : "Seul le client peut valider ou rejeter un jalon";
    case "SIGN":
      // Chaque partie ne signe que pour elle-même — vérifié à l'application.
      return null;
    case "ADVANCE_PHASE": {
      // Le financement et la clôture sont à l'initiative du client.
      if (intent.to === "FUNDED" || intent.to === "CLOSING" || intent.to === "COMPLETED") {
        return role === "client" ? null : "Cette étape est réservée au client";
      }
      return null;
    }
    case "ADVANCE_DISPUTE":
      // Purge/prorata pilotés par le client ; appel ouvert aux deux parties.
      if (intent.to === "PRORATA_CALCULATED" && role !== "client") {
        return "Le calcul du prorata est déclenché par le client";
      }
      return null;
    default:
      return null;
  }
}

/**
 * Applique une intention de workflow, avec revalidation métier serveur.
 */
export async function applyWorkflowIntent(
  contractId: string,
  role: ContractRole,
  intent: WorkflowIntent
): Promise<ApplyIntentResult> {
  const ctx = await buildWorkflowContext(contractId);
  if (!ctx) return { ok: false, status: 404, error: "Contrat introuvable" };

  const permissionError = checkRolePermission(intent, role, ctx);
  if (permissionError) return { ok: false, status: 403, error: permissionError };

  let result: TransitionResult;
  const broadcast: Record<string, unknown> = {};

  switch (intent.action) {
    case "ADVANCE_PHASE": {
      result = advanceContractPhase(ctx, intent.to);
      if (result.success) broadcast.phase = result.context.phase;
      break;
    }

    case "SIGN": {
      // Signature idempotente pour la partie appelante.
      const next: ContractWorkflowContext = {
        ...ctx,
        signedByClient: role === "client" ? true : ctx.signedByClient,
        signedByFreelancer: role === "freelancer" ? true : ctx.signedByFreelancer,
      };
      // Double signature → activation automatique (garde canActivateContract).
      if (next.phase === "FUNDED" && next.signedByClient && next.signedByFreelancer) {
        const activation = advanceContractPhase(next, "CONTRACT_ACTIVE");
        result = activation.success
          ? activation
          : { success: true, context: next };
      } else {
        result = { success: true, context: next };
      }
      broadcast.clientSigned = result.context.signedByClient;
      broadcast.freelancerSigned = result.context.signedByFreelancer;
      broadcast.phase = result.context.phase;
      if (result.context.fullySignedAt) broadcast.fullySignedAt = result.context.fullySignedAt;
      break;
    }

    case "SUBMIT_MILESTONE": {
      const current = ctx.milestones.find((m) => m.milestoneId === intent.milestoneId);
      if (!current) return { ok: false, status: 404, error: "Jalon introuvable" };
      // Démarrage automatique si le jalon n'a jamais été lancé.
      let working = ctx;
      if (current.status === "NOT_STARTED") {
        const started = advanceMilestone(working, intent.milestoneId, "IN_PROGRESS");
        if (started.success) working = started.context;
      }
      result = advanceMilestone(working, intent.milestoneId, "SUBMITTED");
      if (result.success) {
        // Attacher les preuves et la progression déclarée au jalon soumis.
        result.context = attachMilestoneMeta(result.context, intent.milestoneId, {
          evidence: intent.evidence,
          executionRate: intent.executionRate,
        });
        broadcast.milestoneId = intent.milestoneId;
        broadcast.milestoneStatus = "SUBMITTED";
      }
      break;
    }

    case "VALIDATE_MILESTONE": {
      result = advanceMilestone(ctx, intent.milestoneId, "VALIDATED");
      if (result.success) {
        if (intent.executionRate !== undefined) {
          result.context = attachMilestoneMeta(result.context, intent.milestoneId, {
            executionRate: intent.executionRate,
          });
        }
        broadcast.milestoneId = intent.milestoneId;
        broadcast.milestoneStatus = "VALIDATED";
        broadcast.phase = result.context.phase;
      }
      break;
    }

    case "REJECT_MILESTONE": {
      if (!intent.rejectionReason?.trim()) {
        return { ok: false, status: 400, error: "Motif de rejet obligatoire" };
      }
      result = advanceMilestone(ctx, intent.milestoneId, "IN_PROGRESS", {
        rejectionReason: intent.rejectionReason,
      });
      if (result.success) {
        // Incrémenter le compteur de révisions du jalon : c'est lui qui, sommé
        // sur tous les jalons, alimente le seuil de déclenchement du litige
        // (maxRejectionsBeforeDispute). Sans cela, le litige ne s'ouvrirait jamais.
        result.context = {
          ...result.context,
          milestones: result.context.milestones.map((m) =>
            m.milestoneId === intent.milestoneId
              ? { ...m, revisionCount: (m.revisionCount ?? 0) + 1 }
              : m
          ),
        };
        broadcast.milestoneId = intent.milestoneId;
        broadcast.milestoneStatus = "REJECTED";
        broadcast.rejectionReason = intent.rejectionReason;
        broadcast.phase = result.context.phase;
      }
      break;
    }

    case "ADVANCE_DISPUTE": {
      const source: ContractWorkflowContext = intent.appealEvidence
        ? { ...ctx, appealEvidence: intent.appealEvidence }
        : ctx;
      result = advanceDisputeStep(source, intent.to, {
        mediationOutcome: intent.mediationOutcome,
        arbitrationFees: intent.arbitrationFees,
        appealSuccessful: intent.appealSuccessful,
      });
      if (result.success) {
        broadcast.disputeStep = result.context.disputeStep;
        broadcast.phase = result.context.phase;
      }
      break;
    }

    default:
      return { ok: false, status: 400, error: "Intention inconnue" };
  }

  if (!result.success) {
    return { ok: false, status: 409, error: result.error ?? "Transition refusée", context: ctx };
  }

  await persistContext(contractId, result.context);

  // Libération des fonds au prestataire : la clôture du contrat ("Libérer le
  // paiement intégral" côté client) est le seul point qui doit créditer le
  // portefeuille du freelance (lib/payouts.ts ne compte que les Payment
  // type=RELEASE/status=SUCCEEDED). Sans cette écriture, le retrait de fonds
  // reste bloqué à 0€ quel que soit le nombre de contrats terminés.
  if (
    intent.action === "ADVANCE_PHASE" &&
    intent.to === "COMPLETED" &&
    result.context.phase === "COMPLETED"
  ) {
    await releaseFundsToFreelancer(contractId, result.context);
  }

  return { ok: true, status: 200, context: result.context, broadcast };
}

/**
 * Crée l'écriture Payment (type RELEASE, status SUCCEEDED) qui crédite le
 * portefeuille du prestataire à la clôture du contrat. Idempotent : ne crée
 * rien si une libération existe déjà pour ce contrat.
 */
async function releaseFundsToFreelancer(
  contractId: string,
  ctx: ContractWorkflowContext
): Promise<void> {
  const alreadyReleased = await prisma.payment.findFirst({
    where: { type: "RELEASE", status: "SUCCEEDED", metadata: { path: ["contractId"], equals: contractId } },
    select: { id: true },
  });
  if (alreadyReleased) return;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { freelancer: { select: { userId: true } } },
  });
  if (!contract?.freelancer?.userId) return;

  const grossAmount = ctx.milestones
    .filter((m) => m.status === "VALIDATED")
    .reduce((sum, m) => sum + m.amount, 0);
  if (grossAmount <= 0) return;

  const { freelancerNet } = calculatePlatformFees(grossAmount, ctx.platformFeePercent);

  await prisma.payment.create({
    data: {
      userId: contract.freelancer.userId,
      amount: freelancerNet,
      currency: "EUR",
      type: "RELEASE",
      status: "SUCCEEDED",
      trustEngineId: contract.escrowId,
      metadata: { contractId, grossAmount, platformFeePercent: ctx.platformFeePercent },
    },
  });
}

// ── Helpers internes ───────────────────────────────────────

function attachMilestoneMeta(
  ctx: ContractWorkflowContext,
  milestoneId: string,
  meta: { evidence?: unknown; executionRate?: number }
): ContractWorkflowContext {
  return {
    ...ctx,
    milestones: ctx.milestones.map((m) =>
      m.milestoneId === milestoneId
        ? {
            ...m,
            evidence: meta.evidence !== undefined ? meta.evidence : m.evidence,
            executionRate:
              meta.executionRate !== undefined ? meta.executionRate : m.executionRate,
          }
        : m
    ),
  };
}

/**
 * Persiste le contexte calculé en base (contrat + jalons) dans une transaction.
 */
async function persistContext(
  contractId: string,
  ctx: ContractWorkflowContext
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.contract.findUnique({
      where: { id: contractId },
      select: { clientSignedAt: true, freelancerSignedAt: true, fullySignedAt: true, appealOpenedAt: true },
    });

    const data: Record<string, unknown> = {
      status: CONTRACT_PHASE_TO_PRISMA[ctx.phase],
      workflowPhase: ctx.phase,
      disputeStep: ctx.disputeStep ?? null,
    };
    if (ctx.signedByClient && !existing?.clientSignedAt) data.clientSignedAt = new Date();
    if (ctx.signedByFreelancer && !existing?.freelancerSignedAt) data.freelancerSignedAt = new Date();
    if (ctx.fullySignedAt && !existing?.fullySignedAt) data.fullySignedAt = new Date(ctx.fullySignedAt);
    // Ouverture de la fenêtre d'appel (phase 6c) — pour la résolution auto 48h.
    if (ctx.appealOpenedAt && !existing?.appealOpenedAt) {
      data.appealOpenedAt = new Date(ctx.appealOpenedAt);
    }

    await tx.contract.update({ where: { id: contractId }, data });

    // Persister chaque jalon (statut + métadonnées).
    for (const m of ctx.milestones) {
      const milestoneData: Record<string, unknown> = {
        status: MILESTONE_STATUS_TO_PRISMA[m.status],
        executionRate: m.executionRate,
        revisionCount: m.revisionCount ?? 0,
      };
      if (m.status === "VALIDATED") milestoneData.completedAt = new Date();
      if (m.rejectionReason !== undefined) {
        milestoneData.rejectionReason = m.rejectionReason ?? null;
        if (m.rejectedAt) milestoneData.rejectedAt = new Date(m.rejectedAt);
      }
      if (m.evidence !== undefined) milestoneData.proofs = m.evidence ?? undefined;

      await tx.milestone.update({ where: { id: m.milestoneId }, data: milestoneData });
    }
  });
}

/**
 * Calcule le récapitulatif financier de clôture (montant brut, commission, net).
 * Utilisé par l'UI de clôture et l'API.
 */
export function computeClosingSummary(ctx: ContractWorkflowContext): {
  grossAmount: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
  isDispute: boolean;
} {
  const totalContract = ctx.milestones.reduce((s, m) => s + m.amount, 0);
  let grossAmount: number;
  let isDispute = false;

  if (ctx.phase === "DISPUTE_RESOLVED" || ctx.phase === "DISPUTE_OPENED") {
    isDispute = true;
    const prorata = calculateProrata(ctx);
    grossAmount = prorata.releasedAmount;
  } else {
    grossAmount = ctx.milestones
      .filter((m) => m.status === "VALIDATED")
      .reduce((s, m) => s + m.amount, 0);
    if (grossAmount === 0) grossAmount = totalContract;
  }

  const { feeAmount, freelancerNet } = calculatePlatformFees(grossAmount, ctx.platformFeePercent);
  return {
    grossAmount,
    feePercent: ctx.platformFeePercent,
    feeAmount,
    netAmount: freelancerNet,
    isDispute,
  };
}
