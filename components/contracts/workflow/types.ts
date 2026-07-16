/**
 * Types partagés pour les composants du workflow contractuel.
 * Alignés avec lib/contract-workflow.ts — aucune variable existante modifiée.
 */

import type {
  ContractPhase,
  ContractWorkflowContext,
  MilestoneWorkflowStatus,
  DisputeStep,
  MilestoneWorkflowState,
} from "@/lib/contract-workflow";

// ── Ré-export des types du workflow ──
export type {
  ContractPhase,
  ContractWorkflowContext,
  MilestoneWorkflowStatus,
  DisputeStep,
  MilestoneWorkflowState,
};

// ── Configuration d'affichage par phase ──
export interface PhaseDisplayConfig {
  id: number;
  key: ContractPhase;
  name: string;
  icon: string;
  description: string;
}

export const PHASE_DISPLAY: PhaseDisplayConfig[] = [
  { id: 0, key: "NEGOTIATION", name: "Négociation", icon: "🤝", description: "Définition des termes" },
  { id: 0, key: "TERMS_LOCKED", name: "Termes verrouillés", icon: "🔒", description: "Accord sur les termes" },
  { id: 1, key: "CONTRACT_GENERATED", name: "Contrat généré", icon: "📄", description: "Document prêt" },
  { id: 2, key: "PENDING_FUNDING", name: "Financement", icon: "💰", description: "En attente des fonds" },
  { id: 2, key: "FUNDED", name: "Financé", icon: "✅", description: "Fonds sécurisés" },
  { id: 3, key: "CONTRACT_ACTIVE", name: "Contrat actif", icon: "🚀", description: "En cours d'exécution" },
  { id: 4, key: "CLOSING", name: "Clôture", icon: "🏁", description: "Finalisation" },
  { id: 4, key: "COMPLETED", name: "Terminé", icon: "🎉", description: "Contrat achevé" },
  { id: 5, key: "DISPUTE_OPENED", name: "Litige", icon: "⚖️", description: "Résolution en cours" },
  { id: 5, key: "DISPUTE_RESOLVED", name: "Litige résolu", icon: "✅", description: "Résolution terminée" },
  { id: 6, key: "CANCELLED", name: "Annulé", icon: "❌", description: "Contrat annulé" },
];

/** Regroupement visuel : une "étape" du stepper = plusieurs phases */
export interface StepperStep {
  label: string;
  icon: string;
  phases: ContractPhase[];
}

export const STEPPER_STEPS: StepperStep[] = [
  { label: "Contrat", icon: "📄", phases: ["NEGOTIATION", "TERMS_LOCKED", "CONTRACT_GENERATED"] },
  { label: "Financement", icon: "💰", phases: ["PENDING_FUNDING"] },
  { label: "Signature", icon: "✍️", phases: ["FUNDED"] },
  { label: "Pilotage", icon: "📋", phases: ["CONTRACT_ACTIVE"] },
  { label: "Clôture", icon: "🏁", phases: ["CLOSING", "COMPLETED"] },
  { label: "Litige", icon: "⚖️", phases: ["DISPUTE_OPENED", "DISPUTE_RESOLVED"] },
];

/** Détermine l'index du stepper pour une phase donnée */
export function getStepperIndex(phase: ContractPhase): number {
  const idx = STEPPER_STEPS.findIndex((s) => s.phases.includes(phase));
  return idx >= 0 ? idx : 0;
}

/** Labels lisibles pour les statuts de jalon */
export const MILESTONE_LABELS: Record<MilestoneWorkflowStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: "Non démarré", color: "bg-gray-100 text-gray-500" },
  IN_PROGRESS: { label: "En cours", color: "bg-blue-50 text-blue-600" },
  SUBMITTED: { label: "Soumis", color: "bg-amber-50 text-amber-600" },
  VALIDATED: { label: "Validé", color: "bg-green-50 text-green-600" },
  REJECTED: { label: "Rejeté", color: "bg-red-50 text-red-600" },
};

export const DISPUTE_STEP_LABELS: Record<DisputeStep, string> = {
  PURGE: "Purge des jalons",
  PRORATA_CALCULATED: "Calcul du prorata",
  APPEAL_WINDOW: "Fenêtre d'appel (48h)",
  MEDIATION: "Médiation interne",
  ARBITRATION: "Arbitrage externe",
  DISPUTE_RESOLVED: "Litige résolu",
};
