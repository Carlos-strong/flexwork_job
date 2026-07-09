/**
 * Helper pour les notifications du workflow application/offre/interview.
 * Dispatch vers le système de notifications existant selon le type d'événement.
 */

import { notifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export interface NotificationInput {
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, any>;
}

export async function sendNotification(input: NotificationInput): Promise<void> {
  try {
    switch (input.type) {
      case "INTERVIEW_SCHEDULED": {
        const appId = input.data?.applicationId as string | undefined;
        if (!appId) break;
        const app = await prisma.application.findUnique({
          where: { id: appId },
          include: {
            freelancer: { include: { user: { select: { firstName: true } } } },
            mission: { select: { title: true } },
          },
        });
        if (app) {
          await notifications.applicationAcceptedToFreelancer({
            freelancerName: app.freelancer.user.firstName ?? "Freelance",
            missionTitle: app.mission.title,
            clientName: "Le client",
          });
        }
        break;
      }

      case "OFFER_SENT": {
        const appId = input.data?.applicationId as string | undefined;
        if (!appId) break;
        const app = await prisma.application.findUnique({
          where: { id: appId },
          include: {
            freelancer: { include: { user: { select: { firstName: true } } } },
            mission: { select: { title: true, client: { include: { user: { select: { firstName: true } } } } } },
          },
        });
        if (app) {
          await notifications.applicationAcceptedToFreelancer({
            freelancerName: app.freelancer.user.firstName ?? "Freelance",
            missionTitle: app.mission.title,
            clientName: app.mission.client?.user?.firstName ?? "Client",
          });
        }
        break;
      }

      case "OFFER_ACCEPTED": {
        const appId = input.data?.applicationId as string | undefined;
        if (!appId) break;
        const app = await prisma.application.findUnique({
          where: { id: appId },
          include: {
            freelancer: { include: { user: { select: { firstName: true } } } },
            mission: { select: { title: true } },
          },
        });
        if (app) {
          await notifications.selectedForMissionToFreelancer({
            freelancerName: app.freelancer.user.firstName ?? "Freelance",
            missionTitle: app.mission.title,
          });
        }
        break;
      }

      default:
        // Type non géré : log en dev uniquement
        if (process.env.NODE_ENV === "development") {
          console.info("[NOTIFICATION] Type non géré:", input.type, input.data);
        }
    }
  } catch (err) {
    // Notifications non bloquantes
    console.error("[NOTIFICATION] Erreur envoi:", err);
  }
}
