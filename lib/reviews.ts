/**
 * Helpers serveur pour les évaluations mutuelles (avis de fin de contrat).
 * Utilisés par les pages /dashboard/{client,freelancer}/avis.
 */

import { prisma } from "@/lib/prisma";

export interface ReviewCard {
  id: string;
  rating: number;
  comment: string | null;
  qualityRating: number | null;
  communicationRating: number | null;
  deadlineRating: number | null;
  createdAt: string;
  missionTitle: string;
  counterpartName: string;
}

export interface EligibleContract {
  contractId: string;
  missionTitle: string;
  targetName: string;
}

export interface ReviewDashboardData {
  given: ReviewCard[];
  received: ReviewCard[];
  receivedAverage: number | null;
  eligible: EligibleContract[];
}

function fullName(u: { firstName?: string | null; lastName?: string | null } | null | undefined, fallback: string) {
  const n = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return n || fallback;
}

/**
 * @param role "client" → l'utilisateur évalue des prestataires ;
 *             "freelancer" → l'utilisateur évalue des clients.
 */
export async function getReviewDashboardData(
  userId: string,
  role: "client" | "freelancer"
): Promise<ReviewDashboardData> {
  const [givenRaw, receivedRaw] = await Promise.all([
    prisma.review.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        target: { select: { firstName: true, lastName: true } },
        contract: { select: { mission: { select: { title: true } } } },
      },
    }),
    prisma.review.findMany({
      where: { targetId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { firstName: true, lastName: true } },
        contract: { select: { mission: { select: { title: true } } } },
      },
    }),
  ]);

  const given: ReviewCard[] = givenRaw.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    qualityRating: r.qualityRating,
    communicationRating: r.communicationRating,
    deadlineRating: r.deadlineRating,
    createdAt: r.createdAt.toISOString(),
    missionTitle: r.contract?.mission?.title ?? "Mission",
    counterpartName: fullName(r.target, "Prestataire"),
  }));

  const received: ReviewCard[] = receivedRaw.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    qualityRating: r.qualityRating,
    communicationRating: r.communicationRating,
    deadlineRating: r.deadlineRating,
    createdAt: r.createdAt.toISOString(),
    missionTitle: r.contract?.mission?.title ?? "Mission",
    counterpartName: fullName(r.author, "Client"),
  }));

  const receivedAverage =
    received.length > 0
      ? Math.round((received.reduce((s, r) => s + r.rating, 0) / received.length) * 10) / 10
      : null;

  // Contrats terminés dont l'utilisateur est partie et qu'il n'a pas encore évalués.
  const partyWhere =
    role === "client"
      ? { mission: { client: { userId } } }
      : { freelancer: { userId } };

  const closedContracts = await prisma.contract.findMany({
    where: {
      AND: [
        partyWhere,
        { OR: [{ status: "COMPLETED" }, { workflowPhase: "COMPLETED" }, { workflowPhase: "DISPUTE_RESOLVED" }] },
      ],
    },
    select: {
      id: true,
      mission: {
        select: {
          title: true,
          client: { select: { companyName: true, user: { select: { firstName: true, lastName: true } } } },
        },
      },
      freelancer: { select: { user: { select: { firstName: true, lastName: true } } } },
      reviews: { where: { authorId: userId }, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const eligible: EligibleContract[] = closedContracts
    .filter((c) => c.reviews.length === 0)
    .map((c) => ({
      contractId: c.id,
      missionTitle: c.mission?.title ?? "Mission",
      targetName:
        role === "client"
          ? fullName(c.freelancer?.user, "Prestataire")
          : c.mission?.client?.companyName || fullName(c.mission?.client?.user, "Client"),
    }));

  return { given, received, receivedAverage, eligible };
}
