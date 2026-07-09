import { prisma } from "@/lib/prisma";
import {
  ApplicationStatus,
  InterviewFormat,
} from "@prisma/client";
import {
  isValidTransition,
  validateTransition,
  canPerformAction,
  UserRole,
} from "@/lib/validations/application-workflow";
import { sendNotification } from "@/lib/services/notification-helper";

export interface ChangeStatusInput {
  applicationId: string;
  newStatus: ApplicationStatus;
  changedByUserId: string;
  changedByRole: UserRole;
  reason?: string;
}

export interface CreateInterviewInput {
  applicationId: string;
  scheduledAt?: Date;
  format: InterviewFormat;
  duration?: number;
  notes?: string;
}

export interface CompleteInterviewInput {
  interviewId: string;
  feedbackByClient?: string;
  feedbackByFreelancer?: string;
  rating?: number;
}

/**
 * Service pour gérer les candidatures et leurs transitions
 */
export class ApplicationService {
  /**
   * Change le statut d'une candidature
   */
  static async changeStatus(input: ChangeStatusInput) {
    const {
      applicationId,
      newStatus,
      changedByUserId,
      changedByRole,
      reason,
    } = input;

    // Récupérer l'application
    const application = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        mission: { include: { client: true } },
        freelancer: { include: { user: true } },
      },
    });

    // Valider la transition
    if (!isValidTransition(application.status, newStatus)) {
      throw new Error(
        `Invalid transition from ${application.status} to ${newStatus}`
      );
    }

    // Vérifier les permissions
    if (changedByRole === "CLIENT") {
      const permission = canPerformAction(
        "view",
        changedByRole,
        application.status
      );
      if (!permission.allowed) {
        throw new Error(permission.reason);
      }
    }

    // Valider les règles métier
    const validation = validateTransition(
      application.status,
      newStatus,
      reason
    );
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    // Commencer une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mettre à jour l'application
      const updatedApplication = await tx.application.update({
        where: { id: applicationId },
        data: { status: newStatus },
      });

      // Enregistrer la transition de statut
      const statusHistory = await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: newStatus,
          changedBy: changedByUserId,
          changedByRole,
          reason,
        },
      });

      return { application: updatedApplication, statusHistory };
    });

    // Envoyer les notifications appropriées
    await this.sendStatusChangeNotifications(
      application,
      newStatus,
      reason
    );

    return result;
  }

  /**
   * Crée un entretien pour une candidature
   */
  static async createInterview(input: CreateInterviewInput) {
    const { applicationId, scheduledAt, format, duration, notes } = input;

    // Récupérer l'application
    const application = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        mission: { include: { client: true } },
        freelancer: { include: { user: true } },
      },
    });

    // Vérifier que l'application est en statut approprié
    if (!["SHORTLISTED", "DISCUSSION"].includes(application.status)) {
      throw new Error(
        `Cannot create interview for application in status ${application.status}`
      );
    }

    // Créer l'entretien
    const interview = await prisma.interview.create({
      data: {
        applicationId,
        scheduledAt,
        format,
        duration,
        notes,
      },
    });

    // Si pas encore en discussion, changer le statut
    if (application.status !== "DISCUSSION") {
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: "DISCUSSION" },
      });

      // Enregistrer la transition
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: "DISCUSSION",
          changedBy: "system",
          changedByRole: "ADMIN",
          reason: "Interview créée",
        },
      });
    }

    // Changer le statut à INTERVIEW si une date est planifiée
    if (scheduledAt) {
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: "INTERVIEW" },
      });

      // Enregistrer la transition
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: application.status === "DISCUSSION" ? "DISCUSSION" : application.status,
          toStatus: "INTERVIEW",
          changedBy: "system",
          changedByRole: "ADMIN",
          reason: "Interview programmée",
        },
      });

      // Notifier le freelance
      const freelanceUser = application.freelancer.user;
      if (freelanceUser.email) {
        await sendNotification({
          userId: freelanceUser.id,
          type: "INTERVIEW_SCHEDULED",
          title: "Entretien programmé",
          message: `Un entretien a été programmé pour ${application.mission.title}`,
          data: {
            interviewId: interview.id,
            applicationId,
            scheduledAt: scheduledAt?.toISOString(),
          },
        });
      }
    }

    return interview;
  }

  /**
   * Complète un entretien
   */
  static async completeInterview(input: CompleteInterviewInput) {
    const {
      interviewId,
      feedbackByClient,
      feedbackByFreelancer,
      rating,
    } = input;

    const interview = await prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { application: true },
    });

    // Mettre à jour l'entretien
    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        completedAt: new Date(),
        feedbackByClient,
        feedbackByFreelancer,
        rating,
      },
    });

    // Optionnellement, changer le statut de l'application (ex: à OFFER_SENT)
    // await prisma.application.update({
    //   where: { id: interview.applicationId },
    //   data: { status: "INTERVIEW" }
    // });

    return updatedInterview;
  }

  /**
   * Shortlist une candidature
   */
  static async shortlistApplication(
    applicationId: string,
    changedByUserId: string
  ) {
    return await this.changeStatus({
      applicationId,
      newStatus: "SHORTLISTED",
      changedByUserId,
      changedByRole: "CLIENT",
      reason: "Présélectionnée",
    });
  }

  /**
   * Archive une candidature
   */
  static async archiveApplication(
    applicationId: string,
    changedByUserId: string,
    reason: string
  ) {
    return await this.changeStatus({
      applicationId,
      newStatus: "ARCHIVED",
      changedByUserId,
      changedByRole: "CLIENT",
      reason,
    });
  }

  /**
   * Rejette une candidature
   */
  static async rejectApplication(
    applicationId: string,
    changedByUserId: string,
    reason: string
  ) {
    return await this.changeStatus({
      applicationId,
      newStatus: "REJECTED",
      changedByUserId,
      changedByRole: "CLIENT",
      reason,
    });
  }

  /**
   * Obtient l'historique des transitions d'une candidature
   */
  static async getStatusHistory(applicationId: string) {
    return await prisma.applicationStatusHistory.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Envoie les notifications appropriées lors d'un changement de statut
   */
  private static async sendStatusChangeNotifications(
    application: any,
    newStatus: ApplicationStatus,
    reason?: string
  ) {
    const clientUser = application.mission.client.user;
    const freelanceUser = application.freelancer.user;

    const notifications: Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
    }> = [];

    switch (newStatus) {
      case "SHORTLISTED":
        notifications.push({
          userId: freelanceUser.id,
          type: "APPLICATION_SHORTLISTED",
          title: "Vous avez été présélectionné!",
          message: `Vous avez été présélectionné pour ${application.mission.title}`,
        });
        break;

      case "DISCUSSION":
        notifications.push({
          userId: freelanceUser.id,
          type: "APPLICATION_DISCUSSION",
          title: "Discussion initiée",
          message: `Une discussion a été initiée pour ${application.mission.title}`,
        });
        break;

      case "REJECTED":
      case "ARCHIVED":
        notifications.push({
          userId: freelanceUser.id,
          type: "APPLICATION_REJECTED",
          title: "Candidature non retenue",
          message: `Votre candidature pour ${application.mission.title} n'a pas été retenue`,
        });
        break;
    }

    // Envoyer les notifications
    for (const notification of notifications) {
      await sendNotification({
        userId: notification.userId,
        type: notification.type as any,
        title: notification.title,
        message: notification.message,
        data: { applicationId: application.id },
      });
    }
  }
}
