import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-gateway";

export const dynamic = "force-dynamic";

// GET /api/offers/freelancer
// Retourne toutes les offres reçues par le freelance connecté
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Non authentifié", 401);
    }

    const userId = session.user.id;

    // Récupérer le profil freelance
    const freelancerProfile = await prisma.freelancerProfile.findUnique({
      where: { userId },
    });

    if (!freelancerProfile) {
      return apiError("Profil freelance introuvable", 404);
    }

    // Récupérer les applications du freelance qui ont des offres
    const applications = await prisma.application.findMany({
      where: {
        freelancerId: freelancerProfile.id,
        offers: { some: {} }, // au moins une offre
      },
      include: {
        mission: {
          include: {
            client: {
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
          },
        },
        offers: {
          include: { milestones: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Formater la réponse
    const data = applications.flatMap((app) =>
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
          id: app.mission.id,
          title: app.mission.title,
          description: app.mission.description,
          budget: app.mission.budget,
          budgetType: app.mission.budgetType,
          duration: app.mission.duration,
        },
        client: {
          id: app.mission.client.id,
          userId: app.mission.client.user.id,
          firstName: app.mission.client.user.firstName,
          lastName: app.mission.client.user.lastName,
          image: app.mission.client.user.image,
          companyName: app.mission.client.companyName,
        },
        applicationStatus: app.status,
      }))
    );

    return apiSuccess(data);
  } catch (error) {
    console.error("Error fetching freelancer offers:", error);
    return apiError("Erreur lors de la récupération des offres", 500);
  }
}
