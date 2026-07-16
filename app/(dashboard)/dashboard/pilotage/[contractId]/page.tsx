/**
 * Page de pilotage du workflow contractuel.
 *
 * Route : /dashboard/pilotage/[contractId]
 *
 * Lit l'état du contrat en base (Prisma), le convertit en
 * ContractWorkflowContext, puis délègue le rendu au composant client
 * ContractWorkflowPanel qui gère le stepper, les jalons et le litige.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ContractWorkflowPanel } from "@/components/contracts/workflow";
import { buildWorkflowContext } from "@/lib/services/contract-workflow.service";

export const dynamic = "force-dynamic";

// ── Page serveur ────────────────────────────────────────────

interface PageProps {
  params: { contractId: string };
}

export default async function PilotagePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/connexion");
  }

  const userId = session.user.id;

  const contract = await prisma.contract.findUnique({
    where: { id: params.contractId },
    include: {
      mission: {
        include: {
          client: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
      milestones: { orderBy: { createdAt: "asc" } },
      offer: {
        include: {
          application: {
            include: {
              freelancer: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
      },
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });

  if (!contract) notFound();

  // ── Rôle de l'utilisateur connecté ──
  const clientUserId = contract.mission.client.userId;
  const freelancerUserId = contract.offer?.application.freelancer.userId;

  let userRole: "client" | "freelancer";
  if (userId === freelancerUserId) userRole = "freelancer";
  else if (userId === clientUserId) userRole = "client";
  else {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#5A5750]">Vous n&apos;avez pas accès à ce contrat.</p>
      </div>
    );
  }

  // ── Noms affichables ──
  const clientUser = contract.mission.client.user;
  const freelancerUser = contract.offer?.application.freelancer.user;

  const clientName =
    contract.mission.client.companyName ||
    [clientUser.firstName, clientUser.lastName].filter(Boolean).join(" ") ||
    "Client";

  const freelancerName =
    [freelancerUser?.firstName, freelancerUser?.lastName].filter(Boolean).join(" ") ||
    "Prestataire";

  // ── Contexte initial du workflow (source de vérité serveur) ──
  // buildWorkflowContext lit la phase persistée (workflowPhase) et évite
  // l'effondrement de phase au reload.
  const initialContext = await buildWorkflowContext(contract.id);
  if (!initialContext) notFound();

  return (
    <ContractWorkflowPanel
      initialContext={initialContext}
      contractTitle={contract.mission.title}
      clientName={clientName}
      freelancerName={freelancerName}
      contractAmount={contract.totalBudget || 0}
      userRole={userRole}
      userId={userId}
    />
  );
}
