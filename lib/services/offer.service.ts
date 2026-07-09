import { prisma } from "@/lib/prisma";
import {
  ApplicationStatus,
  OfferStatus,
  InterviewFormat,
} from "@prisma/client";
import { validateOffer } from "@/lib/validations/application-workflow";
import { sendNotification } from "@/lib/services/notification-helper";
import { enqueueJob } from "@/lib/queue";
import { escrow } from "@/lib/escrow";
import { createConversation, addSystemMessage, conversations } from "@/lib/collaboration";

export interface CreateOfferInput {
  applicationId: string;
  title: string;
  description?: string;
  offerType: "FIXED" | "HOURLY";
  totalBudget?: number;
  hourlyRate?: number;
  weeklyHourLimit?: number;
  startDate: Date;
  endDate?: Date;
  milestones?: Array<{
    title: string;
    description?: string;
    amount: number;
    dueDate?: Date;
    executionRate?: number;
  }>;
}

export interface SendOfferInput extends CreateOfferInput {
  expiresAt?: Date;
}

/** Nombre maximum d'échanges de négociation (contre-propositions) autorisés sur une offre.
 *  Au-delà, l'offre est automatiquement refusée. */
export const MAX_NEGOTIATION_ROUNDS = 3;

/**
 * Service pour gérer le cycle de vie des offres
 * - Créer une offre (draft)
 * - Envoyer une offre
 * - Accepter/Refuser une offre
 * - Créer un contrat à partir d'une offre acceptée
 */
export class OfferService {
  /**
   * Crée une offre (mode brouillon)
   */
  static async createOffer(input: CreateOfferInput) {
    // Valider les données
    const validation = validateOffer({
      title: input.title,
      offerType: input.offerType,
      totalBudget: input.totalBudget,
      hourlyRate: input.hourlyRate,
      startDate: input.startDate,
    });

    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
    }

    // Vérifier que l'application existe et est en statut approprié
    const application = await prisma.application.findUniqueOrThrow({
      where: { id: input.applicationId },
      include: {
        mission: true,
        freelancer: true,
        offers: {
          where: { status: { in: ["DRAFT", "SENT"] } },
          select: { id: true, status: true },
        },
      },
    });

    // Empêcher la création si une offre est déjà en attente
    if (application.offers.some((o) => o.status === "SENT")) {
      throw new Error("Une offre est déjà en attente de réponse pour cette candidature");
    }

    // Créer l'offre
    const offer = await prisma.offer.create({
      data: {
        applicationId: input.applicationId,
        title: input.title,
        description: input.description,
        offerType: input.offerType,
        totalBudget: input.totalBudget,
        hourlyRate: input.hourlyRate,
        weeklyHourLimit: input.weeklyHourLimit,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "DRAFT",
      },
      include: {
        application: true,
        milestones: true,
      },
    });

    // Créer les jalons si fournis
    if (input.milestones && input.milestones.length > 0) {
      await Promise.all(
        input.milestones.map((milestone) =>
          prisma.milestone.create({
            data: {
              offerId: offer.id,
              title: milestone.title,
              description: milestone.description,
              amount: milestone.amount,
              dueDate: milestone.dueDate,
              executionRate: milestone.executionRate ?? 100,
            },
          })
        )
      );
    }

    return offer;
  }

  /**
   * Envoie une offre au freelance
   * Passe le statut d'application à OFFER_SENT
   */
  static async sendOffer(offerId: string, expiresAt?: Date) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      include: {
        application: {
          include: { freelancer: { include: { user: true } } },
        },
      },
    });

    // Vérifier que l'offre est en brouillon
    if (offer.status !== "DRAFT") {
      throw new Error(
        `Impossible d'envoyer une offre avec le statut ${offer.status}`
      );
    }

    // Vérifier que l'application n'est pas déjà dans un état terminal
    const terminalStatuses = ["ACCEPTED", "REJECTED", "WITHDRAWN", "OFFER_ACCEPTED", "OFFER_DECLINED"];
    if (terminalStatuses.includes(offer.application.status)) {
      throw new Error(
        `Impossible d'envoyer une offre : la candidature est en statut ${offer.application.status}`
      );
    }

    // Calculer date d'expiration (7 jours par défaut)
    const expiration = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Mettre à jour l'offre
    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        expiresAt: expiration,
      },
      include: {
        application: {
          include: {
            freelancer: { include: { user: true } },
            mission: true,
          },
        },
      },
    });

    // Changer le statut de l'application à OFFER_SENT
    await prisma.application.update({
      where: { id: updatedOffer.applicationId },
      data: { status: "OFFER_SENT" },
    });

    // Enregistrer la transition de statut
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: updatedOffer.applicationId,
        fromStatus: offer.application.status,
        toStatus: "OFFER_SENT",
        changedBy: "system", // À remplacer par user ID réel
        changedByRole: "CLIENT",
        reason: "Offre envoyée",
      },
    });

    // Notifier le freelance
    const freelanceUser = updatedOffer.application.freelancer.user;
    if (freelanceUser.email) {
      await sendNotification({
        userId: freelanceUser.id,
        type: "OFFER_SENT",
        title: "Nouvelle offre reçue",
        message: `${updatedOffer.application.mission.title} - ${updatedOffer.title}`,
        data: {
          offerId: updatedOffer.id,
          applicationId: updatedOffer.applicationId,
        },
      });
    }

    return updatedOffer;
  }

  /**
   * Accepte une offre et crée le contrat correspondant
   */
  static async acceptOffer(offerId: string, acceptedByUserId: string) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      include: {
        application: {
          include: {
            mission: { include: { client: { include: { user: true } } } },
            freelancer: { include: { user: true } },
          },
        },
      },
    });

    // Vérifier que l'offre n'est pas expirée
    if (offer.expiresAt && new Date() > offer.expiresAt) {
      throw new Error("Offer has expired");
    }

    // Vérifier que l'offre est en statut SENT ou COUNTERED (contre-proposition acceptée)
    if (!["SENT", "COUNTERED"].includes(offer.status)) {
      throw new Error(`Cannot accept offer with status ${offer.status}`);
    }

    // Commencer une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mettre à jour l'offre
      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      // Mettre à jour l'application
      const updatedApplication = await tx.application.update({
        where: { id: updatedOffer.applicationId },
        data: { status: "OFFER_ACCEPTED" },
      });

      // Créer le contrat
      const contract = await tx.contract.create({
        data: {
          offerId: updatedOffer.id,
          missionId: offer.application.mission.id,
          freelancerId: offer.application.freelancer.id,
          contractType: offer.offerType === "FIXED" ? "FIXED" : "HOURLY",
          totalBudget: offer.totalBudget,
          hourlyRate: offer.hourlyRate,
          weeklyHourLimit: offer.weeklyHourLimit,
          startDate: offer.startDate,
          endDate: offer.endDate,
          status: "PENDING",
        },
        include: { milestones: true },
      });

      // Copier les jalons de l'offre vers le contrat (si FIXED)
      if (offer.offerType === "FIXED") {
        const offerMilestones = await tx.milestone.findMany({
          where: { offerId: offerId },
        });

        for (const milestone of offerMilestones) {
          await tx.milestone.create({
            data: {
              contractId: contract.id,
              title: milestone.title,
              description: milestone.description,
              amount: milestone.amount,
              dueDate: milestone.dueDate,
              executionRate: milestone.executionRate,
            },
          });
        }
      }

      // Enregistrer la transition de statut
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: updatedApplication.id,
          fromStatus: updatedApplication.status === "OFFER_ACCEPTED" ? "OFFER_SENT" : updatedApplication.status,
          toStatus: "OFFER_ACCEPTED",
          changedBy: acceptedByUserId,
          changedByRole: "FREELANCER",
          reason: "Offre acceptée",
        },
      });

      // Mettre à jour l'application en ACCEPTED (après acceptation)
      await tx.application.update({
        where: { id: updatedApplication.id },
        data: { status: "ACCEPTED" },
      });

      return {
        offer: updatedOffer,
        application: updatedApplication,
        contract,
      };
    });

    // Notifier les parties
    const clientUser = offer.application.mission.client.user;
    const freelanceUser = offer.application.freelancer.user;
    const missionTitle = offer.application.mission.title;

    if (clientUser?.email) {
      await sendNotification({
        userId: clientUser.id,
        type: "OFFER_ACCEPTED",
        title: "Offre acceptée",
        message: `${freelanceUser.firstName} a accepté votre offre`,
        data: { offerId: offer.id, applicationId: offer.applicationId, contractId: result.contract.id },
      });
    }

    // ── Traitement post-acceptation : escrow + workspace ────
    // Aligné sur le pipeline POST /api/contracts (CONTRACT → ESCROW → conversation)
    let activeContract = result.contract;
    try {
      await enqueueJob("CONTRACT_CREATED", {
        contractId: result.contract.id,
        missionId: offer.application.mission.id,
        missionTitle,
        clientId: clientUser.id,
        freelancerId: freelanceUser.id,
        escrowAmount: offer.totalBudget || 0,
      });

      const milestonesForEscrow = result.contract.milestones.length > 0
        ? result.contract.milestones.map((m) => ({ title: m.title, amount: m.amount }))
        : [{ title: "Livraison finale", amount: offer.totalBudget || 0 }];

      const escrowResult = await escrow.create({
        contractId: result.contract.id,
        missionTitle,
        totalAmount: offer.totalBudget || 0,
        clientId: clientUser.id,
        freelancerId: freelanceUser.id,
        provider: "both",
        milestones: milestonesForEscrow,
      });

      activeContract = await prisma.contract.update({
        where: { id: result.contract.id },
        data: {
          status: "ACTIVE",
          escrowId: escrowResult.trustEngineEscrowId,
          escrowAmount: offer.totalBudget || 0,
        },
        include: { milestones: true },
      });

      // Espace de travail : conversation liée au contrat (récupère l'éventuelle
      // conversation pré-contrat créée lors de la phase d'entretien — le titre peut
      // référencer soit l'ID FreelancerProfile soit l'ID User selon l'origine du message)
      const freelancerProfileId = offer.application.freelancer.id;
      const preContractConv = conversations.find(
        (c) =>
          c.contractId.startsWith("pre-") &&
          (c.title.includes(freelancerProfileId) || c.title.includes(freelanceUser.id))
      );
      if (preContractConv) {
        preContractConv.contractId = result.contract.id;
      }

      const conversation = preContractConv || createConversation({
        contractId: result.contract.id,
        title: missionTitle,
        clientId: clientUser.id,
        clientName: clientUser.firstName ? `${clientUser.firstName} ${clientUser.lastName ?? ""}`.trim() : "Client",
        freelancerId: freelanceUser.id,
        freelancerName: freelanceUser.firstName ? `${freelanceUser.firstName} ${freelanceUser.lastName ?? ""}`.trim() : "Freelancer",
      });

      addSystemMessage(conversation.id, `🎉 Contrat créé pour la mission "${missionTitle}".`);
      addSystemMessage(conversation.id, `💰 Montant séquestré : ${(offer.totalBudget || 0).toLocaleString()} €`);
      addSystemMessage(conversation.id, `🔐 Escrow actif — les fonds sont sécurisés.`);

      await enqueueJob("CONTRACT_ESCROW_CREATED", {
        contractId: result.contract.id,
        escrowId: escrowResult.trustEngineEscrowId || "",
        missionTitle,
        amount: offer.totalBudget || 0,
        clientId: clientUser.id,
        freelancerId: freelanceUser.id,
      });

      await enqueueJob("MISSION_FUNDED", {
        missionId: offer.application.mission.id,
        title: missionTitle,
        amount: offer.totalBudget || 0,
        paymentIntentId: escrowResult.stripePaymentIntentId || "",
      });

      if (freelanceUser?.email) {
        await sendNotification({
          userId: freelanceUser.id,
          type: "CONTRACT_ACTIVE",
          title: "Contrat actif",
          message: `Votre contrat pour "${missionTitle}" est actif — l'espace de travail est disponible.`,
          data: { contractId: result.contract.id },
        });
      }
    } catch (err) {
      // L'acceptation de l'offre et la création du contrat restent valides
      // même si l'escrow/workspace échoue — le contrat reste PENDING.
      console.error("[OfferService.acceptOffer] Échec du traitement post-acceptation:", err);
    }

    return { ...result, contract: activeContract };
  }

  /**
   * Refuse une offre
   */
  static async declineOffer(
    offerId: string,
    declinedByUserId: string,
    reason: string
  ) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      include: { application: true },
    });

    if (!["SENT", "COUNTERED"].includes(offer.status)) {
      throw new Error(`Cannot decline offer with status ${offer.status}`);
    }

    // Mettre à jour l'offre
    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
        declineReason: reason,
      },
      include: { application: true },
    });

    // Changer le statut de l'application à OFFER_DECLINED
    const updatedApplication = await prisma.application.update({
      where: { id: updatedOffer.applicationId },
      data: { status: "OFFER_DECLINED" },
    });

    // Enregistrer la transition de statut
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: updatedApplication.id,
        fromStatus: "OFFER_SENT",
        toStatus: "OFFER_DECLINED",
        changedBy: declinedByUserId,
        changedByRole: "FREELANCER",
        reason: reason,
      },
    });

    // Notifier le client que l'offre a été refusée
    await sendNotification({
      userId: "", // sera résolu via offerId dans le helper
      type: "OFFER_DECLINED",
      title: "Offre refusée",
      message: "Le freelance a refusé l'offre",
      data: { offerId: updatedOffer.id, applicationId: updatedOffer.applicationId, reason },
    });

    return updatedOffer;
  }

  /**
   * Envoie une contre-proposition (négociation) sur une offre.
   * Modifie les jalons (montant/date limite) tout en préservant les valeurs
   * originales du client (originalAmount/originalDueDate) pour affichage comparatif.
   * L'offre passe en statut COUNTERED — l'autre partie doit ensuite accepter, refuser
   * ou contre-proposer à son tour.
   *
   * Règle métier : maximum {@link MAX_NEGOTIATION_ROUNDS} échanges de négociation.
   * Au-delà, l'offre est automatiquement refusée (declineReason automatique).
   * Des notifications d'avertissement sont envoyées aux deux parties à chaque round
   * pour les informer du nombre de tentatives restantes.
   */
  static async negotiateOffer(
    offerId: string,
    actorUserId: string,
    milestoneUpdates: Array<{ milestoneId: string; amount: number; dueDate?: Date }>,
    note?: string
  ) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      include: {
        application: {
          include: {
            mission: { include: { client: { include: { user: true } } } },
            freelancer: { include: { user: true } },
          },
        },
        milestones: true,
      },
    });

    const clientUser = offer.application.mission.client.user;
    const freelanceUser = offer.application.freelancer.user;

    let actorRole: "CLIENT" | "FREELANCER";
    if (actorUserId === freelanceUser.id) {
      actorRole = "FREELANCER";
    } else if (actorUserId === clientUser.id) {
      actorRole = "CLIENT";
    } else {
      throw new Error("Utilisateur non autorisé à négocier cette offre");
    }

    if (!["SENT", "COUNTERED"].includes(offer.status)) {
      throw new Error(`Impossible de contre-proposer une offre avec le statut ${offer.status}`);
    }

    if (offer.expiresAt && new Date() > offer.expiresAt) {
      throw new Error("Impossible de contre-proposer une offre expirée");
    }

    // Vérifier que c'est bien le tour de l'acteur
    if (offer.status === "SENT" && actorRole !== "FREELANCER") {
      throw new Error("Seul le freelance peut répondre à une offre initiale");
    }
    if (offer.status === "COUNTERED" && offer.lastCounterBy === actorRole) {
      throw new Error("En attente de la réponse de l'autre partie avant de contre-proposer à nouveau");
    }

    // ── Limite de négociation : au-delà de MAX_NEGOTIATION_ROUNDS, refus automatique ──
    if (offer.negotiationRounds >= MAX_NEGOTIATION_ROUNDS) {
      const declinedOffer = await prisma.offer.update({
        where: { id: offerId },
        data: {
          status: "DECLINED",
          declinedAt: new Date(),
          declineReason: `Nombre maximum de négociations atteint (${MAX_NEGOTIATION_ROUNDS}) — offre refusée automatiquement`,
        },
        include: { application: true, milestones: true },
      });

      await prisma.application.update({
        where: { id: declinedOffer.applicationId },
        data: { status: "OFFER_DECLINED" },
      });

      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: declinedOffer.applicationId,
          fromStatus: "OFFER_SENT",
          toStatus: "OFFER_DECLINED",
          changedBy: "system",
          changedByRole: "ADMIN",
          reason: `Refus automatique — limite de ${MAX_NEGOTIATION_ROUNDS} négociations atteinte`,
        },
      });

      for (const user of [clientUser, freelanceUser]) {
        if (user?.email) {
          await sendNotification({
            userId: user.id,
            type: "OFFER_AUTO_DECLINED",
            title: "Offre refusée automatiquement",
            message: `La négociation sur "${offer.title}" a atteint la limite de ${MAX_NEGOTIATION_ROUNDS} échanges — l'offre a été automatiquement refusée.`,
            data: { offerId: declinedOffer.id, applicationId: declinedOffer.applicationId },
          });
        }
      }

      return { offer: declinedOffer, autoDeclined: true, remainingRounds: 0 };
    }

    if (!milestoneUpdates || milestoneUpdates.length === 0) {
      throw new Error("Au moins une modification de jalon est requise pour contre-proposer");
    }

    // Vérifier que tous les jalons appartiennent bien à cette offre
    const milestoneIds = new Set(offer.milestones.map((m) => m.id));
    for (const update of milestoneUpdates) {
      if (!milestoneIds.has(update.milestoneId)) {
        throw new Error(`Le jalon ${update.milestoneId} n'appartient pas à cette offre`);
      }
      if (update.amount <= 0) {
        throw new Error("Le montant d'un jalon doit être supérieur à 0");
      }
    }

    // Mettre à jour les jalons modifiés (préserve les valeurs originales du client)
    await Promise.all(
      milestoneUpdates.map((update) => {
        const milestone = offer.milestones.find((m) => m.id === update.milestoneId)!;
        return prisma.milestone.update({
          where: { id: update.milestoneId },
          data: {
            amount: update.amount,
            dueDate: update.dueDate ?? milestone.dueDate,
            originalAmount: milestone.originalAmount ?? milestone.amount,
            originalDueDate: milestone.originalDueDate ?? milestone.dueDate,
          },
        });
      })
    );

    // Recalculer le montant total de l'offre (FIXED) à partir des jalons à jour
    const updatedMilestones = await prisma.milestone.findMany({ where: { offerId } });
    const newTotal = updatedMilestones.reduce((sum, m) => sum + m.amount, 0);
    const newRounds = offer.negotiationRounds + 1;

    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: "COUNTERED",
        counteredAt: new Date(),
        counterNote: note,
        totalBudget: offer.offerType === "FIXED" ? newTotal : offer.totalBudget,
        negotiationRounds: newRounds,
        lastCounterBy: actorRole,
      },
      include: { application: true, milestones: true },
    });

    const remainingRounds = Math.max(0, MAX_NEGOTIATION_ROUNDS - newRounds);
    const actorUser = actorRole === "FREELANCER" ? freelanceUser : clientUser;
    const counterpartyUser = actorRole === "FREELANCER" ? clientUser : freelanceUser;
    const actorLabel = actorRole === "FREELANCER" ? (actorUser.firstName ?? "Le freelance") : (actorUser.firstName ?? "Le client");

    // Notifier l'autre partie de la nouvelle contre-proposition
    if (counterpartyUser?.email) {
      await sendNotification({
        userId: counterpartyUser.id,
        type: "OFFER_COUNTERED",
        title: "Contre-proposition reçue",
        message: `${actorLabel} a proposé des modifications à l'offre "${offer.title}"`,
        data: {
          offerId: updatedOffer.id,
          applicationId: updatedOffer.applicationId,
          counteredBy: actorRole,
          remainingRounds,
          note,
        },
      });
    }

    // Avertissement progressif sur le nombre de tentatives restantes (aux deux parties)
    const warningMessage = remainingRounds > 0
      ? `Il reste ${remainingRounds} tentative(s) de négociation avant refus automatique de l'offre "${offer.title}".`
      : `Ceci était la dernière tentative de négociation autorisée sur l'offre "${offer.title}". Toute nouvelle contre-proposition entraînera un refus automatique.`;

    for (const user of [clientUser, freelanceUser]) {
      if (user?.email) {
        await sendNotification({
          userId: user.id,
          type: "OFFER_NEGOTIATION_WARNING",
          title: remainingRounds > 0 ? "Négociation en cours" : "Dernière tentative de négociation",
          message: warningMessage,
          data: { offerId: updatedOffer.id, applicationId: updatedOffer.applicationId, remainingRounds },
        });
      }
    }

    return { offer: updatedOffer, autoDeclined: false, remainingRounds };
  }

  /**
   * Expire les offres non acceptées
   */
  static async expireOldOffers() {
    const now = new Date();
    return await prisma.offer.updateMany({
      where: {
        status: "SENT",
        expiresAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });
  }

  /**
   * Retire une offre envoyée (par le client)
   */
  static async withdrawOffer(offerId: string, reason: string) {
    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
    });

    if (!["DRAFT", "SENT"].includes(offer.status)) {
      throw new Error(`Cannot withdraw offer with status ${offer.status}`);
    }

    const updated = await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: "WITHDRAWN",
        declineReason: reason,
      },
    });

    // Notifier le freelance que l'offre a été retirée
    await sendNotification({
      userId: "",
      type: "OFFER_WITHDRAWN",
      title: "Offre retirée",
      message: reason || "Offre retirée par le client",
      data: { offerId: updated.id, reason },
    });

    return updated;
  }
}
