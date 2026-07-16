/**
 * Client de workflow contractuel (côté navigateur).
 *
 * Point d'entrée UNIQUE pour toute mutation d'état de contrat depuis le front.
 * Envoie une intention au serveur, qui l'authentifie, la revalide et renvoie
 * le contexte à jour (source de vérité). Le front applique ensuite ce contexte.
 *
 * Le front ne calcule plus l'état « pour de vrai » : il peut afficher un état
 * optimiste, mais c'est toujours le contexte renvoyé ici qui fait foi.
 */

import type { ContractWorkflowContext } from "@/lib/contract-workflow";

export type WorkflowIntent =
  | { action: "ADVANCE_PHASE"; to: ContractWorkflowContext["phase"] }
  | { action: "SIGN" }
  | { action: "SUBMIT_MILESTONE"; milestoneId: string; evidence?: unknown; executionRate?: number }
  | { action: "VALIDATE_MILESTONE"; milestoneId: string; executionRate?: number }
  | { action: "REJECT_MILESTONE"; milestoneId: string; rejectionReason: string }
  | {
      action: "ADVANCE_DISPUTE";
      to: NonNullable<ContractWorkflowContext["disputeStep"]>;
      appealEvidence?: string;
      mediationOutcome?: "freelancer" | "client" | "split";
      arbitrationFees?: number;
      appealSuccessful?: boolean;
    };

export interface DispatchResult {
  ok: boolean;
  context?: ContractWorkflowContext;
  error?: string;
}

export async function dispatchWorkflowIntent(
  contractId: string,
  intent: WorkflowIntent
): Promise<DispatchResult> {
  try {
    const res = await fetch(`/api/contracts/${contractId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json?.error ?? `Erreur ${res.status}`, context: json?.context };
    }
    return { ok: true, context: json.context as ContractWorkflowContext };
  } catch {
    return { ok: false, error: "Réseau indisponible" };
  }
}

/** Récupère le contexte courant depuis le serveur (resynchronisation). */
export async function fetchWorkflowContext(
  contractId: string
): Promise<ContractWorkflowContext | null> {
  try {
    const res = await fetch(`/api/contracts/${contractId}/workflow`, { method: "GET" });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.context as ContractWorkflowContext) ?? null;
  } catch {
    return null;
  }
}
