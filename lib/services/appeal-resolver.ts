/**
 * Résolution automatique des fenêtres d'appel de litige (phase 6c).
 *
 * Un litige entré en APPEAL_WINDOW y reste tant qu'aucune partie n'agit. Sans
 * minuteur, un contrat pouvait rester bloqué indéfiniment. Ce balayage clôt
 * automatiquement les fenêtres d'appel dépassant 48h en l'absence d'appel :
 * le litige passe à DISPUTE_RESOLVED selon le prorata déjà calculé.
 *
 * Exécuté périodiquement par le process worker (voir lib/workers.ts).
 */

import { prisma } from "@/lib/prisma";
import { applyWorkflowIntent } from "@/lib/services/contract-workflow.service";

const APPEAL_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function resolveExpiredAppeals(now: Date = new Date()): Promise<{
  scanned: number;
  resolved: number;
}> {
  const cutoff = new Date(now.getTime() - APPEAL_WINDOW_MS);

  const stuck = await prisma.contract.findMany({
    where: {
      status: "DISPUTED",
      disputeStep: "APPEAL_WINDOW",
      appealOpenedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  let resolved = 0;
  for (const contract of stuck) {
    // Sortie par défaut : pas d'appel → résolution selon le prorata.
    // (advanceDisputeStep autorise APPEAL_WINDOW → DISPUTE_RESOLVED.)
    const result = await applyWorkflowIntent(contract.id, "client", {
      action: "ADVANCE_DISPUTE",
      to: "DISPUTE_RESOLVED",
    });
    if (result.ok) resolved++;
    else console.warn(`[AppealResolver] Contrat ${contract.id} non résolu : ${result.error}`);
  }

  if (stuck.length > 0) {
    console.log(`[AppealResolver] ${resolved}/${stuck.length} fenêtre(s) d'appel expirée(s) résolue(s)`);
  }
  return { scanned: stuck.length, resolved };
}
