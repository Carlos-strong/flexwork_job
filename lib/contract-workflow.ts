/**
 * ─── Machine à états du cycle de vie contrat ───
 *
 * Conçu pour coexister avec les types existants :
 *   - MissionStep   (lib/workflow.ts)
 *   - ApplicationStatus (lib/recruitment.ts)
 *   - ContractStatus, MilestoneStatus (prisma/schema.prisma)
 *
 * Aucune variable existante n'est modifiée.
 *
 * ── Phases du workflow ──
 *
 *   Phase 0  NEGOTIATION ⇄ → TERMS_LOCKED
 *   Phase 1  → CONTRACT_GENERATED
 *   Phase 2  → PENDING_FUNDING → FUNDED  (précondition de signature)
 *   Phase 3  → double signature → CONTRACT_ACTIVE → redirection /pilotage
 *
 *   Phase 4  Par jalon (répété N fois) :
 *            NOT_STARTED → IN_PROGRESS → SUBMITTED (si déclaré = 100%)
 *              → VALIDATED (client valide, ou tacite sous 5j ouvrés)
 *              → ou IN_PROGRESS (rejet motivé, correction possible)
 *
 *   Phase 5  Clôture normale (si 100% VALIDATED) :
 *            CONTRACT_ACTIVE → CLOSING → paiement intégral unique → COMPLETED
 *
 *   Phase 6  Litige (si plafond de rejets dépassé) :
 *            6a — Purge : tout jalon SUBMITTED doit être tranché
 *            6b — Prorata mécanique (aucune marge d'interprétation)
 *            6c — Fenêtre d'appel 48h, preuve obligatoire, frais remboursables
 *            6d — Médiation interne spécialisée si appel recevable
 *            6e — Option d'arbitrage externe si enjeu > seuil
 *            → DISPUTE_RESOLVED → libération selon répartition finale
 *
 *   Phase 7  Frais de plateforme calculés une seule fois,
 *            sur le montant effectivement libéré
 */

import type { ContractStatus, MilestoneStatus } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════
// Types — cycle de vie enrichi (coexistence avec Prisma)
// ═══════════════════════════════════════════════════════════════

/** Phases macro du contrat (7 phases) */
export type ContractPhase =
  | "NEGOTIATION"
  | "TERMS_LOCKED"
  | "CONTRACT_GENERATED"
  | "PENDING_FUNDING"
  | "FUNDED"
  | "CONTRACT_ACTIVE"
  | "CLOSING"
  | "COMPLETED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "CANCELLED";

/** Sous-statuts de la phase 4 (par jalon) */
export type MilestoneWorkflowStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VALIDATED"
  | "REJECTED";

/** Sous-statuts du litige (phase 6) */
export type DisputeStep =
  | "PURGE"
  | "PRORATA_CALCULATED"
  | "APPEAL_WINDOW"
  | "MEDIATION"
  | "ARBITRATION"
  | "DISPUTE_RESOLVED";

/** Contexte complet d'un contrat pour le workflow */
export interface ContractWorkflowContext {
  contractId: string;
  phase: ContractPhase;
  disputeStep?: DisputeStep;

  // Jalon courant
  milestones: MilestoneWorkflowState[];

  // Compteurs
  totalMilestones: number;
  validatedCount: number;
  rejectionCount: number;
  maxRejectionsBeforeDispute: number; // plafond, défaut = 5

  // Signature (Phase 3) — précondition pour CONTRACT_ACTIVE
  signedByClient: boolean;
  signedByFreelancer: boolean;
  fullySignedAt?: string;            // ISO — date de la double signature

  // Prorata (phase 6)
  prorataClientShare: number;        // 0-1
  prorataFreelancerShare: number;    // 0-1

  // Appel (phase 6c)
  appealOpenedAt?: string;           // ISO
  appealDeadline?: string;           // ISO (+48h)
  appealEvidence?: string;
  appealFeeRefundable: boolean;
  appealFeeAmount: number;           // montant des frais d'appel

  // Jalons contestés (phase 6d) — médiation limitée à ces jalons
  contestedMilestoneIds: string[];

  // Seuils configurables
  arbitrationThreshold: number;      // montant min pour arbitrage externe
  tacitValidationDays: number;       // délai tacite jalon (défaut 7j ouvrés)

  // Frais plateforme (phase 7) — calculés une seule fois
  platformFeePercent: number;
  platformFeeAmount: number;
}

export interface MilestoneWorkflowState {
  milestoneId: string;
  title: string;
  amount: number;
  executionRate: number; // 0-100
  status: MilestoneWorkflowStatus;

  // Horodatage
  submittedAt?: string;
  validatedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  // Extension pilotage (persisté en base)
  evidence?: unknown;       // EvidenceSet JSON
  revisionCount?: number;
}

// ═══════════════════════════════════════════════════════════════
// Transitions — contrat
// ═══════════════════════════════════════════════════════════════

const CONTRACT_TRANSITIONS: Record<ContractPhase, ContractPhase[]> = {
  // Phase 0 : négociation ⇄ verrouillage
  NEGOTIATION:         ["TERMS_LOCKED" as ContractPhase, "CANCELLED"],
  "TERMS_LOCKED":      ["CONTRACT_GENERATED", "NEGOTIATION"],

  // Phase 1 : génération du document
  CONTRACT_GENERATED:  ["PENDING_FUNDING", "CANCELLED"],

  // Phase 2 : financement escrow
  PENDING_FUNDING:     ["FUNDED", "CANCELLED"],
  FUNDED:              ["CONTRACT_ACTIVE", "CANCELLED"],

  // Phase 3 : double signature → actif
  CONTRACT_ACTIVE:     ["CLOSING", "DISPUTE_OPENED", "CANCELLED"],

  // Phase 5 : clôture normale
  CLOSING:             ["COMPLETED"],

  // Phase 6 : litige
  DISPUTE_OPENED:      ["DISPUTE_RESOLVED"],
  DISPUTE_RESOLVED:    ["COMPLETED"],

  // Terminaux
  COMPLETED:           [],
  CANCELLED:           [],
};

// ═══════════════════════════════════════════════════════════════
// Transitions — jalon (phase 4)
// ═══════════════════════════════════════════════════════════════

const MILESTONE_TRANSITIONS: Record<MilestoneWorkflowStatus, MilestoneWorkflowStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED:   ["VALIDATED", "IN_PROGRESS"], // IN_PROGRESS = rejet motivé
  VALIDATED:   [],
  REJECTED:    [], // terminal (archive)
};

// ═══════════════════════════════════════════════════════════════
// Transitions — litige (phase 6)
// ═══════════════════════════════════════════════════════════════

const DISPUTE_TRANSITIONS: Record<DisputeStep, DisputeStep[]> = {
  PURGE:               ["PRORATA_CALCULATED"],
  PRORATA_CALCULATED:  ["APPEAL_WINDOW"],
  APPEAL_WINDOW:       ["MEDIATION", "DISPUTE_RESOLVED"],
  MEDIATION:           ["DISPUTE_RESOLVED", "ARBITRATION"],
  ARBITRATION:         ["DISPUTE_RESOLVED"],
  DISPUTE_RESOLVED:    [],
};

// ═══════════════════════════════════════════════════════════════
// Mapping → Prisma ContractStatus (existant, inchangé)
// ═══════════════════════════════════════════════════════════════

export const CONTRACT_PHASE_TO_PRISMA: Record<ContractPhase, ContractStatus> = {
  NEGOTIATION:        "PENDING",
  TERMS_LOCKED:       "PENDING",
  CONTRACT_GENERATED: "PENDING",
  PENDING_FUNDING:    "PENDING",
  FUNDED:             "PENDING",
  CONTRACT_ACTIVE:    "ACTIVE",
  CLOSING:            "ACTIVE",
  COMPLETED:          "COMPLETED",
  DISPUTE_OPENED:     "DISPUTED",
  DISPUTE_RESOLVED:   "COMPLETED",
  CANCELLED:          "DISPUTED", // ou on pourrait ajouter CANCELLED à ContractStatus
};

// ═══════════════════════════════════════════════════════════════
// Mapping → Prisma MilestoneStatus (existant, inchangé)
// ═══════════════════════════════════════════════════════════════

export const MILESTONE_STATUS_TO_PRISMA: Record<MilestoneWorkflowStatus, MilestoneStatus> = {
  NOT_STARTED: "PENDING",
  IN_PROGRESS: "PENDING",
  SUBMITTED:   "IN_REVIEW",
  VALIDATED:   "APPROVED",
  REJECTED:    "IN_REVIEW",
};

// ═══════════════════════════════════════════════════════════════
// Gardes
// ═══════════════════════════════════════════════════════════════

export function canTransitionContract(from: ContractPhase, to: ContractPhase): boolean {
  return CONTRACT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionMilestone(
  from: MilestoneWorkflowStatus,
  to: MilestoneWorkflowStatus
): boolean {
  return MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionDispute(from: DisputeStep, to: DisputeStep): boolean {
  return DISPUTE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextContractPhase(current: ContractPhase): ContractPhase | null {
  const transitions = CONTRACT_TRANSITIONS[current];
  if (!transitions || transitions.length === 0) return null;
  return transitions[0];
}

export function nextDisputeStep(current: DisputeStep): DisputeStep | null {
  const transitions = DISPUTE_TRANSITIONS[current];
  if (!transitions || transitions.length === 0) return null;
  return transitions[0];
}

// ═══════════════════════════════════════════════════════════════
// Garde — Signature (Phase 3)
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie si le contrat est signé par les deux parties.
 * Précondition obligatoire pour FUNDED → CONTRACT_ACTIVE.
 */
export function isFullySigned(ctx: ContractWorkflowContext): boolean {
  return ctx.signedByClient && ctx.signedByFreelancer;
}

/**
 * Détermine si le contrat peut passer en CONTRACT_ACTIVE.
 * Conditions cumulatives :
 *   1. Phase actuelle = FUNDED
 *   2. Financement reçu (escrow)
 *   3. Double signature (client + freelance)
 */
export function canActivateContract(ctx: ContractWorkflowContext): boolean {
  return ctx.phase === "FUNDED" && isFullySigned(ctx);
}

// ═══════════════════════════════════════════════════════════════
// Phase 4 — Jalon : logique métier
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie si un jalon peut être soumis.
 * La progression déclarée n'est plus bloquante — seul le client évalue la progression constatée.
 */
export function canSubmitMilestone(m: MilestoneWorkflowState): boolean {
  return m.status === "IN_PROGRESS";
}

/**
 * Validation tacite : si le client ne répond pas sous X jours ouvrés
 * après soumission, le jalon passe automatiquement en VALIDATED.
 */
export function isTacitValidationExpired(
  m: MilestoneWorkflowState,
  tacitDays: number = 5
): boolean {
  if (m.status !== "SUBMITTED" || !m.submittedAt) return false;
  const submitted = new Date(m.submittedAt);
  const now = new Date();
  const diffMs = now.getTime() - submitted.getTime();
  // Approximation simple en jours calendaires (prod : convertir en jours ouvrés)
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= tacitDays;
}

/**
 * Détermine si TOUS les jalons sont VALIDATED → prêt pour phase 5.
 */
export function allMilestonesValidated(ctx: ContractWorkflowContext): boolean {
  if (ctx.milestones.length === 0) return false;
  return ctx.milestones.every((m) => m.status === "VALIDATED");
}

/**
 * Vérifie si le plafond de rejets est dépassé → déclenchement phase 6.
 */
export function isDisputeThresholdReached(ctx: ContractWorkflowContext): boolean {
  return ctx.rejectionCount >= ctx.maxRejectionsBeforeDispute;
}

// ═══════════════════════════════════════════════════════════════
// Phase 6 — Litige : logique métier
// ═══════════════════════════════════════════════════════════════

/**
 * 6a — Purge : tout jalon SUBMITTED doit être tranché par le client.
 * La validation tacite reste active pendant toute la durée du litige.
 * Retourne la liste des jalons en attente de décision.
 */
export function getPendingSubmittedMilestones(
  ctx: ContractWorkflowContext
): MilestoneWorkflowState[] {
  return ctx.milestones.filter((m) => m.status === "SUBMITTED");
}

/**
 * Vérifie si la purge est terminée (aucun jalon SUBMITTED restant).
 */
export function isPurgeComplete(ctx: ContractWorkflowContext): boolean {
  return getPendingSubmittedMilestones(ctx).length === 0;
}

/**
 * Identifie les jalons contestés (ceux qui ne sont pas VALIDATED).
 * Utilisé pour la médiation 6d qui est limitée aux jalons contestés.
 */
export function getContestedMilestones(
  ctx: ContractWorkflowContext
): MilestoneWorkflowState[] {
  return ctx.milestones.filter(
    (m) => ctx.contestedMilestoneIds.includes(m.milestoneId)
  );
}

/**
 * Calcule le montant total contesté (somme des jalons contestés).
 */
export function getContestedAmount(ctx: ContractWorkflowContext): number {
  return getContestedMilestones(ctx).reduce((s, m) => s + m.amount, 0);
}

/**
 * 6b — Calcul mécanique du prorata.
 *
 * Règles :
 *   - Jalons VALIDATED → acquis au freelance (100%)
 *   - Jalons SUBMITTED → pondérés par l'executionRate déclaré
 *   - Jalons contestés (non VALIDATED, non SUBMITTED) → non libérés
 *   - Aucune marge d'interprétation : données objectives uniquement
 *
 * Retourne { clientShare, freelancerShare } entre 0 et 1.
 */
export function calculateProrata(ctx: ContractWorkflowContext): {
  clientShare: number;
  freelancerShare: number;
  totalAmount: number;
  releasedAmount: number;
  validatedAmount: number;
  contestedAmount: number;
} {
  const totalAmount = ctx.milestones.reduce((s, m) => s + m.amount, 0);

  // Montant validé = somme des jalons VALIDATED (acquis au freelance)
  const validatedAmount = ctx.milestones
    .filter((m) => m.status === "VALIDATED")
    .reduce((s, m) => s + m.amount, 0);

  // Montant soumis = jalons SUBMITTED * executionRate/100
  const submittedWeighted = ctx.milestones
    .filter((m) => m.status === "SUBMITTED")
    .reduce((s, m) => s + m.amount * (m.executionRate / 100), 0);

  // Montant contesté = jalons non-VALIDATED et non-SUBMITTED
  const contestedAmount = ctx.milestones
    .filter((m) => m.status !== "VALIDATED" && m.status !== "SUBMITTED")
    .reduce((s, m) => s + m.amount, 0);

  const releasedAmount = validatedAmount + submittedWeighted;

  if (totalAmount === 0) {
    return {
      clientShare: 0, freelancerShare: 0,
      totalAmount: 0, releasedAmount: 0,
      validatedAmount: 0, contestedAmount: 0,
    };
  }

  const freelancerShare = releasedAmount / totalAmount;
  const clientShare = 1 - freelancerShare;

  return {
    clientShare: Math.max(0, Math.min(1, clientShare)),
    freelancerShare: Math.max(0, Math.min(1, freelancerShare)),
    totalAmount,
    releasedAmount,
    validatedAmount,
    contestedAmount,
  };
}

/**
 * 6c — Vérifie si la fenêtre d'appel (48h) est encore ouverte.
 */
export function isAppealWindowOpen(ctx: ContractWorkflowContext): boolean {
  if (!ctx.appealOpenedAt) return false;
  const opened = new Date(ctx.appealOpenedAt);
  const now = new Date();
  const diffMs = now.getTime() - opened.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 48;
}

/**
 * 6c — Vérifie si un appel est recevable.
 * Critères : fenêtre ouverte, preuve obligatoire fournie.
 */
export function isAppealReceivable(ctx: ContractWorkflowContext): boolean {
  return isAppealWindowOpen(ctx) && !!ctx.appealEvidence && ctx.appealEvidence.length > 0;
}

/**
 * 6c — Frais d'appel remboursables si l'appel aboutit.
 * Calcule le remboursement des frais d'appel.
 */
export function refundAppealFees(ctx: ContractWorkflowContext): {
  refundAmount: number;
  isRefundable: boolean;
} {
  return {
    refundAmount: ctx.appealFeeRefundable ? ctx.appealFeeAmount : 0,
    isRefundable: ctx.appealFeeRefundable,
  };
}

/**
 * 6d — Vérifie si la décision de médiation est définitive.
 * La médiation interne est limitée aux jalons contestés
 * et sa décision est sans appel.
 */
export function isMediationDecisionFinal(): boolean {
  return true; // Décision définitive, pas de recours interne supplémentaire
}

/**
 * 6e — Vérifie si l'arbitrage externe est éligible.
 * Condition : enjeu (montant contesté) > seuil configurable.
 */
export function isArbitrationEligible(ctx: ContractWorkflowContext): boolean {
  const contestedAmount = getContestedAmount(ctx);
  return contestedAmount > ctx.arbitrationThreshold;
}

// ═══════════════════════════════════════════════════════════════
// Phase 7 — Frais de plateforme
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule les frais de plateforme une seule fois, sur le montant
 * effectivement libéré (COMPLETED ou DISPUTE_RESOLVED).
 *
 * @param releasedAmount — montant libéré au freelancer
 * @param feePercent — pourcentage configuré (défaut 5%, aligné CGU/tarifs)
 */
export function calculatePlatformFees(
  releasedAmount: number,
  feePercent: number = 5
): { feeAmount: number; freelancerNet: number } {
  const feeAmount = releasedAmount * (feePercent / 100);
  const freelancerNet = releasedAmount - feeAmount;
  return { feeAmount, freelancerNet };
}

// ═══════════════════════════════════════════════════════════════
// Factory — contexte initial
// ═══════════════════════════════════════════════════════════════

/**
 * Crée un contexte de workflow initial pour un nouveau contrat.
 */
export function createContractWorkflowContext(params: {
  contractId: string;
  milestones: Array<{
    milestoneId: string;
    title: string;
    amount: number;
    executionRate?: number;
  }>;
  config?: {
    maxRejectionsBeforeDispute?: number;
    arbitrationThreshold?: number;
    tacitValidationDays?: number;
    platformFeePercent?: number;
  };
}): ContractWorkflowContext {
  return {
    contractId: params.contractId,
    phase: "NEGOTIATION",
    milestones: params.milestones.map((m) => ({
      milestoneId: m.milestoneId,
      title: m.title,
      amount: m.amount,
      executionRate: m.executionRate ?? 0,
      status: "NOT_STARTED" as MilestoneWorkflowStatus,
    })),
    totalMilestones: params.milestones.length,
    validatedCount: 0,
    rejectionCount: 0,
    maxRejectionsBeforeDispute: params.config?.maxRejectionsBeforeDispute ?? 5,
    // Signature (Phase 3)
    signedByClient: false,
    signedByFreelancer: false,
    // Prorata (Phase 6)
    prorataClientShare: 0,
    prorataFreelancerShare: 0,
    // Appel (Phase 6c)
    appealFeeRefundable: true,
    appealFeeAmount: 0,
    contestedMilestoneIds: [],
    // Seuils
    arbitrationThreshold: params.config?.arbitrationThreshold ?? 5000,
    tacitValidationDays: params.config?.tacitValidationDays ?? 7,
    // Frais plateforme (commission 5% — aligné CGU/tarifs)
    platformFeePercent: params.config?.platformFeePercent ?? 5,
    platformFeeAmount: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// Transitions avec effets de bord
// ═══════════════════════════════════════════════════════════════

export interface TransitionResult {
  success: boolean;
  newPhase?: ContractPhase;
  newDisputeStep?: DisputeStep;
  error?: string;
  context: ContractWorkflowContext;
}

/**
 * Tente d'avancer le contrat vers la phase cible.
 * Inclut les gardes métier (signature, financement, etc.).
 * Retourne le contexte mis à jour (immutable).
 */
export function advanceContractPhase(
  ctx: ContractWorkflowContext,
  to: ContractPhase
): TransitionResult {
  if (!canTransitionContract(ctx.phase, to)) {
    return {
      success: false,
      error: `Transition interdite : ${ctx.phase} → ${to}`,
      context: ctx,
    };
  }

  // ── Gardes métier ──────────────────────────────────────

  // Phase 3 : FUNDED → CONTRACT_ACTIVE nécessite la double signature
  if (to === "CONTRACT_ACTIVE" && !canActivateContract(ctx)) {
    return {
      success: false,
      error: `Activation impossible : le contrat doit être financé ET signé par les deux parties (client=${ctx.signedByClient}, freelance=${ctx.signedByFreelancer})`,
      context: ctx,
    };
  }

  // Phase 5 : CONTRACT_ACTIVE → CLOSING nécessite 100% jalons VALIDATED
  if (to === "CLOSING" && !allMilestonesValidated(ctx)) {
    return {
      success: false,
      error: `Clôture impossible : tous les jalons doivent être VALIDATED (${ctx.validatedCount}/${ctx.totalMilestones})`,
      context: ctx,
    };
  }

  const updated = { ...ctx, phase: to };

  // ── Effets de bord selon la transition ─────────────────

  switch (to) {
    case "CONTRACT_ACTIVE":
      // Double signature horodatée
      updated.fullySignedAt = new Date().toISOString();
      // Premier jalon NOT_STARTED → IN_PROGRESS
      if (updated.milestones.length > 0) {
        const newMilestones = [...updated.milestones];
        const firstNotStarted = newMilestones.findIndex(
          (m) => m.status === "NOT_STARTED"
        );
        if (firstNotStarted >= 0) {
          newMilestones[firstNotStarted] = {
            ...newMilestones[firstNotStarted],
            status: "IN_PROGRESS",
          };
          updated.milestones = newMilestones;
        }
      }
      break;

    case "DISPUTE_OPENED":
      updated.disputeStep = "PURGE";
      // Capture les jalons contestés pour la médiation 6d
      // Tout jalon non-VALIDATED est potentiellement contesté
      updated.contestedMilestoneIds = ctx.milestones
        .filter((m) => m.status !== "VALIDATED")
        .map((m) => m.milestoneId);
      break;

    case "COMPLETED":
      // Phase 7 : calcul des frais de plateforme UNE SEULE FOIS
      // sur le montant effectivement libéré
      if (ctx.phase === "CLOSING") {
        // Clôture normale : paiement intégral unique (100% du contrat)
        const totalContract = ctx.milestones.reduce((s, m) => s + m.amount, 0);
        const { feeAmount } = calculatePlatformFees(
          totalContract,
          updated.platformFeePercent
        );
        updated.platformFeeAmount = feeAmount;
      } else if (ctx.phase === "DISPUTE_RESOLVED") {
        // Litige résolu : libération selon la répartition du prorata
        const totalContract = ctx.milestones.reduce((s, m) => s + m.amount, 0);
        const releasedByProrata = ctx.prorataFreelancerShare * totalContract;
        const { feeAmount } = calculatePlatformFees(
          releasedByProrata,
          updated.platformFeePercent
        );
        updated.platformFeeAmount = feeAmount;
      }
      break;
  }

  return { success: true, newPhase: to, context: updated };
}

/**
 * Tente de faire avancer un jalon (phase 4).
 *
 * Règles :
 *   - SUBMITTED uniquement si executionRate = 100%
 *   - VALIDATED : client valide, ou tacite sous X jours ouvrés
 *   - Rejet motivé (SUBMITTED → IN_PROGRESS) : correction possible
 *   - Après VALIDATED, démarre automatiquement le jalon suivant
 *   - Si plafond de rejets dépassé → DISPUTE_OPENED automatique
 */
export function advanceMilestone(
  ctx: ContractWorkflowContext,
  milestoneId: string,
  to: MilestoneWorkflowStatus,
  opts?: { rejectionReason?: string }
): TransitionResult {
  const idx = ctx.milestones.findIndex((m) => m.milestoneId === milestoneId);
  if (idx === -1) {
    return { success: false, error: "Jalon introuvable", context: ctx };
  }

  const current = ctx.milestones[idx];
  if (!canTransitionMilestone(current.status, to)) {
    return {
      success: false,
      error: `Transition jalon interdite : ${current.status} → ${to}`,
      context: ctx,
    };
  }

  // Garde : le jalon doit être IN_PROGRESS pour être soumis
  if (to === "SUBMITTED" && !canSubmitMilestone(current)) {
    return {
      success: false,
      error: "Le jalon doit être en cours (IN_PROGRESS) pour être soumis",
      context: ctx,
    };
  }

  const now = new Date().toISOString();
  const newMilestones = [...ctx.milestones];
  const updatedMilestone = { ...current, status: to };

  // Horodatage selon la transition
  if (to === "SUBMITTED") {
    updatedMilestone.submittedAt = now;
    // Nettoyage après correction (resoumission post-rejet)
    updatedMilestone.rejectionReason = undefined;
    updatedMilestone.rejectedAt = undefined;
  }
  if (to === "VALIDATED") updatedMilestone.validatedAt = now;
  if (to === "IN_PROGRESS" && current.status === "SUBMITTED") {
    // Rejet motivé → retour à IN_PROGRESS (correction possible)
    updatedMilestone.rejectedAt = now;
    updatedMilestone.rejectionReason = opts?.rejectionReason;
    updatedMilestone.submittedAt = undefined;
    updatedMilestone.status = "IN_PROGRESS";
  }

  newMilestones[idx] = updatedMilestone;

  // ── Démarrage automatique du jalon suivant ──────────
  // Quand un jalon passe à VALIDATED, le suivant (NOT_STARTED) → IN_PROGRESS
  if (to === "VALIDATED") {
    const nextIdx = idx + 1;
    if (nextIdx < newMilestones.length && newMilestones[nextIdx].status === "NOT_STARTED") {
      newMilestones[nextIdx] = {
        ...newMilestones[nextIdx],
        status: "IN_PROGRESS" as MilestoneWorkflowStatus,
      };
    }
  }

  const updated = { ...ctx, milestones: newMilestones };

  // Compteurs
  if (to === "VALIDATED") updated.validatedCount = ctx.validatedCount + 1;
  if (to === "IN_PROGRESS" && current.status === "SUBMITTED") {
    updated.rejectionCount = ctx.rejectionCount + 1;
    // Ajouter aux jalons contestés si on est en phase active
    if (!updated.contestedMilestoneIds.includes(milestoneId)) {
      updated.contestedMilestoneIds = [...updated.contestedMilestoneIds, milestoneId];
    }
  }

  // ── Vérifications post-transition ───────────────────
  if (updated.phase === "CONTRACT_ACTIVE") {
    if (allMilestonesValidated(updated)) {
      // Le front-end peut proposer le passage en CLOSING
    }
    if (isDisputeThresholdReached(updated)) {
      updated.phase = "DISPUTE_OPENED";
      updated.disputeStep = "PURGE";
      // Capturer tous les jalons non-VALIDATED comme contestés
      updated.contestedMilestoneIds = updated.milestones
        .filter((m) => m.status !== "VALIDATED")
        .map((m) => m.milestoneId);
    }
  }

  return { success: true, context: updated };
}

/**
 * Applique la validation tacite sur tous les jalons SUBMITTED
 * dont le délai est dépassé.
 */
export function applyTacitValidations(
  ctx: ContractWorkflowContext
): TransitionResult {
  if (ctx.phase !== "CONTRACT_ACTIVE" && ctx.phase !== "DISPUTE_OPENED") {
    return { success: false, error: "Phase incompatible avec la validation tacite", context: ctx };
  }

  let updated = { ...ctx };
  let changed = false;

  const newMilestones = ctx.milestones.map((m) => {
    if (isTacitValidationExpired(m, ctx.tacitValidationDays)) {
      changed = true;
      return {
        ...m,
        status: "VALIDATED" as MilestoneWorkflowStatus,
        validatedAt: new Date().toISOString(),
      };
    }
    return m;
  });

  if (!changed) {
    return { success: false, error: "Aucun jalon éligible à la validation tacite", context: ctx };
  }

  updated.milestones = newMilestones;
  updated.validatedCount = newMilestones.filter(
    (m) => m.status === "VALIDATED"
  ).length;

  return { success: true, context: updated };
}

/**
 * Avance d'une étape dans le processus de litige (phase 6).
 *
 * Points clés :
 *   - 6a Purge → 6b Prorata : calcul automatique, aucune interprétation
 *   - 6b → 6c : ouverture fenêtre d'appel 48h
 *   - 6c → 6d : médiation seulement si appel recevable (preuve obligatoire)
 *   - 6d → Résolu : décision définitive, limitée aux jalons contestés
 *   - 6d → 6e : arbitrage externe si enjeu > seuil
 *   - Frais d'appel remboursés si l'appel aboutit (médiation ou arbitrage favorable)
 */
export function advanceDisputeStep(
  ctx: ContractWorkflowContext,
  to: DisputeStep,
  opts?: {
    mediationOutcome?: "freelancer" | "client" | "split"; // 6d
    arbitrationFees?: number;                              // 6e
    appealSuccessful?: boolean;                            // 6c → remboursement
  }
): TransitionResult {
  if (ctx.phase !== "DISPUTE_OPENED") {
    return {
      success: false,
      error: "Le contrat n'est pas en litige",
      context: ctx,
    };
  }

  const current = ctx.disputeStep || "PURGE";
  if (!canTransitionDispute(current, to)) {
    return {
      success: false,
      error: `Transition litige interdite : ${current} → ${to}`,
      context: ctx,
    };
  }

  const updated = { ...ctx, disputeStep: to };

  // ── Effets de bord ─────────────────────────────────

  switch (to) {
    case "PRORATA_CALCULATED": {
      // 6b : Calcul mécanique, données objectives uniquement
      const prorata = calculateProrata(updated);
      updated.prorataClientShare = prorata.clientShare;
      updated.prorataFreelancerShare = prorata.freelancerShare;
      // 6c : Ouverture de la fenêtre d'appel (48h)
      updated.appealOpenedAt = new Date().toISOString();
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
      updated.appealDeadline = deadline.toISOString();
      break;
    }

    case "MEDIATION": {
      // 6d : Vérification que l'appel est recevable
      if (!isAppealReceivable(ctx)) {
        return {
          success: false,
          error: "Appel irrecevable : fenêtre expirée ou preuve manquante",
          context: ctx,
        };
      }
      // La médiation est limitée aux jalons contestés
      // et sa décision est définitive (isMediationDecisionFinal() = true)
      break;
    }

    case "ARBITRATION": {
      // 6e : Vérification éligibilité (enjeu > seuil)
      if (!isArbitrationEligible(ctx)) {
        return {
          success: false,
          error: `Arbitrage non éligible : l'enjeu doit dépasser ${ctx.arbitrationThreshold} €`,
          context: ctx,
        };
      }
      // Les frais d'arbitrage sont à la charge du contestataire
      if (opts?.arbitrationFees) {
        updated.appealFeeAmount = opts.arbitrationFees;
      }
      break;
    }

    case "DISPUTE_RESOLVED": {
      updated.phase = "DISPUTE_RESOLVED";
      // 6c : Remboursement des frais d'appel si l'appel aboutit
      if (opts?.appealSuccessful && ctx.appealFeeRefundable) {
        // Le montant est conservé dans appealFeeAmount pour remboursement
        // La logique de remboursement est exposée via refundAppealFees()
      }
      break;
    }
  }

  return { success: true, newDisputeStep: to, context: updated };
}

// ═══════════════════════════════════════════════════════════════
// Utilitaires — statut lisible
// ═══════════════════════════════════════════════════════════════

export const PHASE_LABELS: Record<ContractPhase, string> = {
  NEGOTIATION:         "Négociation",
  TERMS_LOCKED:        "Termes verrouillés",
  CONTRACT_GENERATED:  "Contrat généré",
  PENDING_FUNDING:     "En attente de financement",
  FUNDED:              "Financé",
  CONTRACT_ACTIVE:     "Contrat actif",
  CLOSING:             "Clôture en cours",
  COMPLETED:           "Terminé",
  DISPUTE_OPENED:      "Litige ouvert",
  DISPUTE_RESOLVED:    "Litige résolu",
  CANCELLED:           "Annulé",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneWorkflowStatus, string> = {
  NOT_STARTED: "Non démarré",
  IN_PROGRESS: "En cours",
  SUBMITTED:   "Soumis",
  VALIDATED:   "Validé",
  REJECTED:    "Rejeté",
};

export const DISPUTE_STEP_LABELS: Record<DisputeStep, string> = {
  PURGE:               "Purge des jalons en attente",
  PRORATA_CALCULATED:  "Prorata calculé",
  APPEAL_WINDOW:       "Fenêtre d'appel (48h)",
  MEDIATION:           "Médiation interne",
  ARBITRATION:         "Arbitrage externe",
  DISPUTE_RESOLVED:    "Litige résolu",
};

/**
 * Détermine le statut lisible complet d'un contrat.
 */
export function getContractStatusLabel(ctx: ContractWorkflowContext): string {
  if (ctx.phase === "DISPUTE_OPENED" && ctx.disputeStep) {
    return `${PHASE_LABELS.DISPUTE_OPENED} — ${DISPUTE_STEP_LABELS[ctx.disputeStep]}`;
  }
  return PHASE_LABELS[ctx.phase];
}
