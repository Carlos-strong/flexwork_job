import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-gateway";

export const dynamic = "force-dynamic";

// GET /api/offers/client
// Retourne toutes les offres envoyées par le client connecté
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Non authentifié", 401);
    }

    const userId = session.user.id;

    // Récupérer le profil client
    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!clientProfile) {
      return apiError("Profil client introuvable", 404);
    }

    // Récupérer les missions du client, avec leurs applications qui ont des offres
    const missions = await prisma.mission.findMany({
      where: {
        clientId: clientProfile.id,
        applications: {
          some: {
            offers: { some: {} },
          },
        },
      },
      include: {
        applications: {
          include: {
            freelancer: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    image: true,
                  },
                },
              },
            },
            offers: {
              include: { milestones: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Formater la réponse
    const data = missions.flatMap((mission) =>
      mission.applications.flatMap((app) =>
        app.offers.map((offer) => ({
          id: offer.id,
          applicationId: offer.applicationId,
          title: offer.title,
          description: offer.description,
          offerType: offer.offerType,
          totalBudget: offer.totalBudget,
          hourlyRate: offer.hourlyRate,
          weeklyHourLimit: offer.weeklyHourLimit,
          startDate: offer.startDate.toISOString(),
          endDate: offer.endDate?.toISOString() ?? null,
          status: offer.status,
          sentAt: offer.sentAt?.toISOString() ?? null,
          expiresAt: offer.expiresAt?.toISOString() ?? null,
          acceptedAt: offer.acceptedAt?.toISOString() ?? null,
          declinedAt: offer.declinedAt?.toISOString() ?? null,
          declineReason: offer.declineReason,
          counteredAt: offer.counteredAt?.toISOString() ?? null,
          counterNote: offer.counterNote,
          negotiationRounds: offer.negotiationRounds,
          lastCounterBy: offer.lastCounterBy,
          createdAt: offer.createdAt.toISOString(),
          milestones: offer.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            amount: m.amount,
            executionRate: m.executionRate ?? 100,
            status: m.status,
            dueDate: m.dueDate?.toISOString() ?? null,
            originalAmount: m.originalAmount,
            originalDueDate: m.originalDueDate?.toISOString() ?? null,
          })),
          mission: {
            id: mission.id,
            title: mission.title,
            description: mission.description,
            budget: mission.budget,
            budgetType: mission.budgetType,
            duration: mission.duration,
          },
          freelancer: {
            id: app.freelancer.id,
            userId: app.freelancer.user.id,
            firstName: app.freelancer.user.firstName,
            lastName: app.freelancer.user.lastName,
            image: app.freelancer.user.image,
            title: app.freelancer.title,
          },
          applicationStatus: app.status,
        }))
      )
    );

    return apiSuccess(data);
  } catch (error) {
    console.error("Error fetching client offers:", error);
    return apiError("Erreur lors de la récupération des offres", 500);
  }
}
