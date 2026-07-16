import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONTRACT_PHASE_TO_PRISMA, type ContractPhase } from "@/lib/contract-workflow";
import { SignatureService } from "@/lib/services/signature.service";

export const dynamic = "force-dynamic";

const VALID_PHASES = Object.keys(CONTRACT_PHASE_TO_PRISMA) as ContractPhase[];

/**
 * POST /api/admin/contrats/[id]/reset-workflow
 *
 * Outil d'administration : réinitialise l'étape d'avancement (workflowPhase)
 * d'un contrat vers une phase antérieure choisie, pour corriger un blocage
 * côté client ou freelance sans passer par les intentions normales du
 * workflow (qui sont unidirectionnelles). Écrit directement en base — c'est
 * volontairement un contournement réservé aux admins, tracé dans
 * ContractAuditEntry.
 *
 * Remet à zéro, de façon cohérente avec la phase cible :
 *  - les signatures (client/freelance) si la cible précède la signature,
 *  - la sous-étape de litige et la fenêtre d'appel si la cible n'est pas
 *    une phase de litige,
 *  - les jalons (statut, preuves, rejets) si la cible précède/est le
 *    pilotage, pour permettre de rejouer la boucle jalons depuis le début.
 *
 * Ne touche jamais à isLocked / documentHash / signedByCertificateId —
 * l'intégrité du document signé et sa chaîne d'audit restent immuables.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const adminUser = session.user as { id: string; activeProfile?: string; email?: string | null };
  if (adminUser.activeProfile !== "ADMIN") {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
  }

  let body: { targetPhase?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const targetPhase = body.targetPhase as ContractPhase | undefined;
  if (!targetPhase || !VALID_PHASES.includes(targetPhase)) {
    return NextResponse.json(
      { error: `Phase cible invalide. Valeurs possibles : ${VALID_PHASES.join(", ")}` },
      { status: 400 }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { milestones: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  const beforeSignature = ["NEGOTIATION", "TERMS_LOCKED", "CONTRACT_GENERATED", "PENDING_FUNDING", "FUNDED"].includes(
    targetPhase
  );
  const isDisputePhase = ["DISPUTE_OPENED", "DISPUTE_RESOLVED"].includes(targetPhase);
  const beforeOrAtPilotage = ["NEGOTIATION", "TERMS_LOCKED", "CONTRACT_GENERATED", "PENDING_FUNDING", "FUNDED", "CONTRACT_ACTIVE"].includes(
    targetPhase
  );

  const previousState = {
    workflowPhase: contract.workflowPhase,
    status: contract.status,
    disputeStep: contract.disputeStep,
    clientSignedAt: contract.clientSignedAt,
    freelancerSignedAt: contract.freelancerSignedAt,
  };

  await prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: params.id },
      data: {
        workflowPhase: targetPhase,
        status: CONTRACT_PHASE_TO_PRISMA[targetPhase],
        disputeStep: isDisputePhase ? contract.disputeStep : null,
        appealOpenedAt: targetPhase === "DISPUTE_OPENED" ? contract.appealOpenedAt : null,
        ...(beforeSignature
          ? { clientSignedAt: null, freelancerSignedAt: null, fullySignedAt: null }
          : {}),
      },
    });

    if (beforeOrAtPilotage && contract.milestones.length > 0) {
      await tx.milestone.updateMany({
        where: { contractId: params.id },
        data: {
          status: "PENDING",
          executionRate: 100,
          proofs: Prisma.JsonNull,
          revisionCount: 0,
          rejectionReason: null,
          rejectedAt: null,
          completedAt: null,
        },
      });
    }
  });

  const reason = body.reason?.trim() || "Aucun motif renseigné";
  await SignatureService.addAuditEntry(
    params.id,
    "ADMIN_WORKFLOW_RESET",
    `Réinitialisation manuelle par l'administrateur ${adminUser.email ?? adminUser.id} : ` +
      `${previousState.workflowPhase ?? previousState.status} → ${targetPhase}. Motif : ${reason}`,
    {
      adminId: adminUser.id,
      previousState,
      targetPhase,
      reason,
    }
  );

  const updated = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { milestones: true },
  });

  return NextResponse.json({ success: true, contract: updated });
}
