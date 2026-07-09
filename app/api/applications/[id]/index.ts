import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApplicationService } from "@/lib/services/application.service";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";
import { enqueueJob } from "@/lib/queue";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Récupérer l'application avec tous ses détails
    const application = await prisma.application.findUniqueOrThrow({
      where: { id },
      include: {
        freelancer: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                image: true,
              },
            },
          },
        },
        mission: {
          include: {
            client: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        interview: true,
        offers: {
          include: { milestones: true },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    // Vérifier l'accès (client de la mission ou freelance)
    const clientId = application.mission.client.user.id;
    const freelanceId = application.freelancer.user.id;

    if (session.user.id !== clientId && session.user.id !== freelanceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Première consultation par le client ────────────────────────────
    // Si c'est le client qui consulte ET que la candidature est encore UNREAD,
    // on la passe en READ et on envoie une notification + email au freelancer.
    if (
      session.user.id === clientId &&
      (application.status === "UNREAD" || application.status === ("PENDING" as ApplicationStatus))
    ) {
      // Mise à jour du statut en base (silencieuse — pas de rollback si erreur)
      prisma.application
        .update({ where: { id }, data: { status: "READ" as ApplicationStatus } })
        .catch(() => {});

      // Job asynchrone : notification dashboard + email au freelancer
      const freelancerFirstName = application.freelancer.user.firstName || "";
      const freelancerLastName  = application.freelancer.user.lastName  || "";
      const freelancerFullName  = `${freelancerFirstName} ${freelancerLastName}`.trim() || "Freelancer";
      const clientFirstName     = application.mission.client.user.firstName || "";
      const clientLastName      = application.mission.client.user.lastName  || "";
      const clientFullName      = application.mission.client.companyName
        || `${clientFirstName} ${clientLastName}`.trim()
        || "Un client";

      enqueueJob("APPLICATION_VIEWED", {
        applicationId: id,
        missionId:     application.missionId,
        missionTitle:  application.mission.title,
        freelancerId:  application.freelancer.id,
        freelancerUserId: application.freelancer.user.id,
        freelancerName: freelancerFullName,
        freelancerEmail: application.freelancer.user.email ?? "",
        clientName:    clientFullName,
      }).catch(() => {});
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json(
      { error: "Failed to fetch application" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status: newStatus, reason } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Effectuer le changement de statut
    const result = await ApplicationService.changeStatus({
      applicationId: id,
      newStatus,
      changedByUserId: session.user.id,
      changedByRole: "CLIENT", // À déterminer dynamiquement
      reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating application status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
