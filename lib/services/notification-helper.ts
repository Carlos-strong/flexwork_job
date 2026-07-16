/**
 * Helper pour les notifications du workflow application/offre/contrat.
 * Dispatch vers :
 *   1. Emails (via lib/notifications.ts)
 *   2. Dashboard temps réel (via lib/socket-server-client.ts → pushNotification)
 */

import { notifications } from "@/lib/notifications";
import { pushNotification } from "@/lib/socket-server-client";
import { prisma } from "@/lib/prisma";

export interface NotificationInput {
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, any>;
}

/**
 * Envoie une notification temps réel au tableau de bord (cloche de notification).
 * Non bloquante — les logs d'erreur sont silencieux.
 */
function pushDashboard(userId: string, type: string, title: string, body: string, link?: string) {
  try {
    if (!userId) return;
    pushNotification({ userId, type, title, body, link });
  } catch {
    // Non bloquant
  }
}

export async function sendNotification(input: NotificationInput): Promise<void> {
  try {
    const { userId, type, title, message, data } = input;
    if (!type) return;

    // Le lien par défaut pointe vers la page appropriée selon le type
    const dashboardLink = (() => {
      if (type.startsWith("OFFER")) return "/dashboard/freelancer/offres";
      if (type.startsWith("CONTRACT") || type.startsWith("MILESTONE")) return "/dashboard/freelancer/contrats";
      return undefined;
    })();

    switch (type) {
      // ═══════════════════════════════════════════
      // OFFRES
      // ═══════════════════════════════════════════

      case "OFFER_SENT": {
        const appId = data?.applicationId as string | undefined;
        if (!appId) break;
        const app = await prisma.application.findUnique({
          where: { id: appId },
          include: {
            freelancer: { include: { user: { select: { id: true, firstName: true, email: true } } } },
            mission: { select: { title: true, client: { include: { user: { select: { id: true, firstName: true, email: true } } } } } },
          },
        });
        if (app) {
          const freelanceName = app.freelancer.user.firstName ?? "Freelance";
          const clientName = app.mission.client?.user?.firstName ?? "Client";
          await notifications.offerSentToFreelancer({
            freelanceName,
            missionTitle: app.mission.title,
            offerTitle: title ?? "Offre",
            clientName,
            totalBudget: data?.totalBudget as number | undefined,
            expiresAt: data?.expiresAt as string | undefined,
          });
          // Dashboard push au freelance
          pushDashboard(
            app.freelancer.user.id,
            "offer",
            title ?? "Nouvelle offre reçue",
            message ?? `${clientName} vous a envoyé une offre pour "${app.mission.title}"`,
            "/dashboard/freelancer/offres"
          );
          // Dashboard push au client (confirmation d'envoi)
          if (app.mission.client?.user?.id) {
            pushDashboard(
              app.mission.client.user.id,
              "offer",
              "Offre envoyée",
              `Votre offre "${title}" a été envoyée à ${freelanceName}`,
              "/dashboard/client/offres"
            );
          }
        }
        break;
      }

      case "OFFER_ACCEPTED": {
        const offerId = data?.offerId as string | undefined;
        const contractId = data?.contractId as string | undefined;
        const appId = data?.applicationId as string | undefined;
        if (!offerId) break;
        const offer = await prisma.offer.findUnique({
          where: { id: offerId },
          include: {
            application: {
              include: {
                freelancer: { include: { user: { select: { id: true, firstName: true } } } },
                mission: { select: { title: true, client: { include: { user: { select: { id: true, firstName: true } } } } } },
              },
            },
          },
        });
        if (offer) {
          const freelanceName = offer.application.freelancer.user.firstName ?? "Freelance";
          const clientName = offer.application.mission.client?.user?.firstName ?? "Client";
          const missionTitle = offer.application.mission.title;
          // Email au client
          await notifications.offerAcceptedToClient({
            missionTitle,
            freelancerName: freelanceName,
            totalBudget: offer.totalBudget ?? 0,
            contractId: contractId ?? "",
          });
          // Dashboard push au client
          if (offer.application.mission.client?.user?.id) {
            pushDashboard(
              offer.application.mission.client.user.id,
              "offer",
              "Offre acceptée",
              `${freelanceName} a accepté votre offre pour "${missionTitle}" — contrat créé`,
              "/dashboard/client/offres"
            );
          }
        }
        break;
      }

      case "OFFER_DECLINED": {
        const offerId = data?.offerId as string | undefined;
        const appId = data?.applicationId as string | undefined;
        if (!offerId) break;
        const offer = await prisma.offer.findUnique({
          where: { id: offerId },
          include: {
            application: {
              include: {
                freelancer: { include: { user: { select: { id: true, firstName: true } } } },
                mission: { select: { title: true, client: { include: { user: { select: { id: true, firstName: true, email: true } } } } } },
              },
            },
          },
        });
        if (offer) {
          const freelanceName = offer.application.freelancer.user.firstName ?? "Freelance";
          const clientUser = offer.application.mission.client?.user;
          await notifications.offerDeclinedToClient({
            missionTitle: offer.application.mission.title,
            freelancerName: freelanceName,
            reason: offer.declineReason ?? data?.reason as string | undefined,
          });
          if (clientUser?.id) {
            pushDashboard(
              clientUser.id,
              "offer",
              "Offre refusée",
              `${freelanceName} a refusé votre offre pour "${offer.application.mission.title}"`,
              "/dashboard/client/offres"
            );
          }
        }
        break;
      }

      case "OFFER_COUNTERED": {
        const offerId = data?.offerId as string | undefined;
        const roundsLeft = (data?.remainingRounds as number) ?? 2;
        const appId = data?.applicationId as string | undefined;
        if (!offerId) break;
        const offer = await prisma.offer.findUnique({
          where: { id: offerId },
          include: {
            application: {
              include: {
                freelancer: { include: { user: { select: { id: true, firstName: true, email: true } } } },
                mission: { select: { title: true, client: { include: { user: { select: { id: true, firstName: true, email: true } } } } } },
              },
            },
          },
        });
        if (offer) {
          const freelanceName = offer.application.freelancer.user.firstName ?? "Freelance";
          const clientName = offer.application.mission.client?.user?.firstName ?? "Client";
          const counterpartyUser = offer.application.mission.client?.user;
          const actorLabel = data?.counteredBy === "FREELANCER" ? freelanceName : clientName;
          // Email à l'autre partie
          await notifications.counterOfferReceived({
            recipientName: data?.counteredBy === "FREELANCER" ? clientName : freelanceName,
            actorLabel,
            missionTitle: offer.application.mission.title,
            offerTitle: offer.title,
            roundsLeft,
            note: data?.note as string | undefined,
          });
          // Dashboard push à l'autre partie
          if (counterpartyUser?.id) {
            pushDashboard(
              counterpartyUser.id,
              "offer",
              "Contre-proposition reçue",
              `${actorLabel} a proposé des modifications à l'offre "${offer.title}"`,
              "/dashboard/client/offres"
            );
          }
        }
        break;
      }

      case "OFFER_NEGOTIATION_WARNING": {
        const recipientId = userId ?? data?.userId as string | undefined;
        const isLast = (data?.remainingRounds as number) === 0;
        if (!recipientId) break;
        const user = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { firstName: true, email: true },
        });
        if (user) {
          await notifications.negotiationWarning({
            recipientName: user.firstName ?? "Utilisateur",
            missionTitle: title ?? "Offre",
            roundsLeft: (data?.remainingRounds as number) ?? 0,
            isLast,
          });
          pushDashboard(
            recipientId,
            "offer",
            isLast ? "⚠️ Dernière tentative de négociation" : "Négociation en cours",
            message ?? `Il reste ${data?.remainingRounds ?? 0} tentative(s) avant refus automatique`,
            "/dashboard/freelancer/offres"
          );
        }
        break;
      }

      case "OFFER_AUTO_DECLINED": {
        const recipientId = userId ?? data?.userId as string | undefined;
        const appId = data?.applicationId as string | undefined;
        if (!recipientId) break;
        const user = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { firstName: true, email: true },
        });
        if (user) {
          await notifications.offerExpired({
            recipientName: user.firstName ?? "Utilisateur",
            missionTitle: title ?? "Offre",
            offerTitle: title ?? "Offre",
            role: "FREELANCER",
          });
          pushDashboard(
            recipientId,
            "offer",
            "⏰ Offre refusée automatiquement",
            message ?? "La limite de négociation a été atteinte — l'offre a été automatiquement refusée.",
            "/dashboard/freelancer/offres"
          );
        }
        break;
      }

      case "OFFER_WITHDRAWN": {
        const offerId = data?.offerId as string | undefined;
        const appId = data?.applicationId as string | undefined;
        if (!userId) break;
        const offer = await prisma.offer.findUnique({
          where: { id: offerId },
          include: {
            application: {
              include: {
                freelancer: { include: { user: { select: { id: true, firstName: true, email: true } } } },
                mission: { select: { title: true } },
              },
            },
          },
        });
        if (offer) {
          const freelanceUser = offer.application.freelancer.user;
          await notifications.offerWithdrawnToFreelancer({
            freelanceName: freelanceUser.firstName ?? "Freelance",
            missionTitle: offer.application.mission.title,
            offerTitle: offer.title,
            reason: data?.reason as string | undefined,
          });
          if (freelanceUser?.id) {
            pushDashboard(
              freelanceUser.id,
              "offer",
              "↩️ Offre retirée",
              `L'offre pour "${offer.application.mission.title}" a été retirée par le client`,
              "/dashboard/freelancer/offres"
            );
          }
        }
        break;
      }

      case "OFFER_EXPIRED": {
        const recipientId = userId ?? data?.userId as string | undefined;
        if (!recipientId) break;
        const user = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { firstName: true },
        });
        if (user) {
          pushDashboard(
            recipientId,
            "offer",
            "⏰ Offre expirée",
            message ?? "Une offre a expiré — aucun réponse dans le délai imparti.",
            "/dashboard/freelancer/offres"
          );
        }
        break;
      }

      // ═══════════════════════════════════════════
      // CONTRATS
      // ═══════════════════════════════════════════

      case "CONTRACT_CREATED": {
        pushDashboard(
          userId ?? "",
          "contract",
          title ?? "📋 Contrat créé",
          message ?? "Un contrat a été créé suite à l'acceptation de votre offre",
          "/dashboard/client/contrats"
        );
        break;
      }

      case "CONTRACT_ACTIVE": {
        const contractId = data?.contractId as string | undefined;
        const userIds = data?.userIds as string[] | undefined;
        if (userIds) {
          for (const uid of userIds) {
            pushDashboard(
              uid,
              "contract",
              "🚀 Contrat actif",
              message ?? `Les fonds sont sécurisés en escrow. Le travail peut commencer.`,
              "/dashboard/freelancer/contrats"
            );
          }
        }
        // Email déjà envoyé via le post-acceptation dans offer.service.ts
        break;
      }

      case "CONTRACT_COMPLETED": {
        const contractId = data?.contractId as string | undefined;
        const userIds = data?.userIds as string[] | undefined;
        if (userIds) {
          const contract = await prisma.contract.findUnique({
            where: { id: contractId },
            include: {
              mission: { select: { title: true } },
              freelancer: { include: { user: { select: { firstName: true } } } },
            },
          });
          if (contract) {
            const clientUser = data?.clientUser as { id: string; firstName?: string } | undefined;
            await notifications.contractCompleted({
              missionTitle: contract.mission.title,
              clientName: clientUser?.firstName ?? "Client",
              freelancerName: contract.freelancer.user.firstName ?? "Freelance",
              totalAmount: data?.amount as number ?? 0,
            });
            for (const uid of userIds) {
              pushDashboard(uid, "contract", "🏁 Contrat terminé", `Le contrat pour "${contract.mission.title}" est terminé.`, "/dashboard/freelancer/contrats");
            }
          }
        }
        break;
      }

      case "CONTRACT_DISPUTED": {
        const userIds = data?.userIds as string[] | undefined;
        if (userIds) {
          await notifications.contractDisputed({
            missionTitle: title ?? "Mission",
            openedBy: data?.openedBy as string ?? "un participant",
            reason: data?.reason as string ?? "Non spécifié",
          });
          for (const uid of userIds) {
            pushDashboard(uid, "contract", "⚠️ Litige ouvert", message ?? "Un litige a été ouvert sur un de vos contrats.", "/dashboard/freelancer/contrats");
          }
        }
        break;
      }

      // ═══════════════════════════════════════════
      // MILESTONES
      // ═══════════════════════════════════════════

      case "MILESTONE_IN_REVIEW": {
        const milestoneId = data?.milestoneId as string | undefined;
        const clientId = data?.clientId as string | undefined;
        if (clientId) {
          pushDashboard(
            clientId,
            "milestone",
            "📋 Jalon soumis pour révision",
            message ?? "Un jalon a été soumis. Veuillez le vérifier.",
            "/dashboard/client/contrats"
          );
        }
        // Email envoyé dans le service concerné
        break;
      }

      case "MILESTONE_APPROVED": {
        const freelancerId = data?.freelancerId as string | undefined;
        if (freelancerId) {
          pushDashboard(
            freelancerId,
            "milestone",
            "✅ Jalon approuvé",
            message ?? "Un jalon a été approuvé par le client.",
            "/dashboard/freelancer/contrats"
          );
        }
        break;
      }

      case "MILESTONE_REJECTED": {
        const freelancerId = data?.freelancerId as string | undefined;
        if (freelancerId) {
          pushDashboard(
            freelancerId,
            "milestone",
            "❌ Jalon rejeté",
            message ?? "Un jalon a été rejeté. Veuillez apporter des corrections.",
            "/dashboard/freelancer/contrats"
          );
        }
        break;
      }

      // ═══════════════════════════════════════════
      // INTERVIEW
      // ═══════════════════════════════════════════

      case "INTERVIEW_SCHEDULED": {
        const appId = data?.applicationId as string | undefined;
        const userId = data?.userId as string | undefined;
        if (!appId) break;
        const app = await prisma.application.findUnique({
          where: { id: appId },
          include: {
            freelancer: { include: { user: { select: { id: true, firstName: true } } } },
            mission: { select: { title: true, client: { include: { user: { select: { id: true, firstName: true } } } } } },
          },
        });
        if (app) {
          await notifications.applicationAcceptedToFreelancer({
            freelancerName: app.freelancer.user.firstName ?? "Freelance",
            missionTitle: app.mission.title,
            clientName: app.mission.client?.user?.firstName ?? "Client",
          });
          // Dashboard push aux deux
          if (app.freelancer.user.id) {
            pushDashboard(app.freelancer.user.id, "interview", "🎤 Entretien programmé", `Un entretien a été programmé pour "${app.mission.title}"`, "/dashboard/freelancer/candidatures");
          }
          if (app.mission.client?.user?.id) {
            pushDashboard(app.mission.client.user.id, "interview", "🎤 Entretien programmé", `Un entretien a été programmé avec ${app.freelancer.user.firstName ?? "le freelance"}`, "/dashboard/client/candidatures");
          }
        }
        break;
      }

      default:
        if (process.env.NODE_ENV === "development") {
          console.info("[NOTIFICATION] Type non géré:", type, data);
        }
    }
  } catch (err) {
    // Notifications non bloquantes
    console.error("[NOTIFICATION] Erreur envoi:", err);
  }
}
