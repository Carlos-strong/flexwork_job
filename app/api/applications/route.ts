import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
  apiPaginated,
  getPaginationParams,
} from "@/lib/api-gateway";
import { enqueueJob } from "@/lib/queue";
import { logApplicationAudit, type ApplicationStatus } from "@/lib/recruitment";
import { prisma } from "@/lib/prisma";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/applications ──────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { searchParams } = ctx;
    const missionId = searchParams.get("missionId");
    const freelancerId = searchParams.get("freelancerId");
    const status = searchParams.get("status") as ApplicationStatus | null;
    const { page, pageSize, skip } = getPaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (missionId) where.missionId = missionId;
    if (freelancerId) where.freelancerId = freelancerId;
    if (status) where.status = status;

    const [dbApps, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          mission: { include: { client: true } },
          freelancer: { include: { user: true } },
        },
      }),
      prisma.application.count({ where }),
    ]);

    const paginated = dbApps.map((a) => ({
      id: a.id,
      missionId: a.missionId,
      freelancerId: a.freelancerId,
      freelancerName: (a.freelancer.user.firstName || a.freelancer.user.lastName) 
        ? `${a.freelancer.user.firstName || ""} ${a.freelancer.user.lastName || ""}`.trim() 
        : "Freelance",
      freelancerTitle: a.freelancer.title ?? "",
      skills: a.freelancer.skills ?? [],
      rate: a.freelancer.hourlyRate ?? 0,
      missionTitle: a.mission.title,
      clientName: a.mission.client.companyName ?? "Client",
      proposedBudget: a.proposedBudget ?? 0,
      coverLetter: a.coverLetter ?? "",
      // Mapping Prisma → recruitment : UNREAD → SUBMITTED
      status: a.status === "UNREAD" ? "SUBMITTED" : a.status === "PENDING" ? "SUBMITTED" : a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    return apiPaginated(paginated, page, pageSize, total);
  },
});

// ── POST /api/applications ─────────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  requireRole: "FREELANCER",
  async handler(req: NextRequest) {
    const body = await parseBody<{
      missionId?: string;
      freelancerId?: string; // User ID from session
      freelancerName?: string;
      proposedBudget?: number;
      coverLetter?: string;
    }>(req);

    if (!body.missionId || !body.freelancerId) {
      return apiError("missionId et freelancerId requis", 400);
    }

    // Résoudre le profil freelance à partir de l'userId
    const freelancerProfile = await prisma.freelancerProfile.findUnique({
      where: { userId: body.freelancerId },
      select: { id: true, isValidated: true },
    });
    if (!freelancerProfile) {
      return apiError("Profil freelance introuvable. Complétez votre inscription.", 404);
    }

    // ── Règle métier #1 (PRD) : vérifier le statut KYC du freelance ──
    let initialStatus: ApplicationStatus = "SUBMITTED";
    if (!freelancerProfile.isValidated) {
      try {
        const kyc = await prisma.verificationIdentite.findFirst({
          where: { userId: body.freelancerId },
          orderBy: { dateSoumission: "desc" },
          select: { statut: true },
        });
        if (!kyc) {
          initialStatus = "IDENTITY_PENDING";
        } else if (kyc.statut === "EN_ATTENTE") {
          initialStatus = "IDENTITY_PENDING";
        }
        if (kyc?.statut === "REJETE") {
          return apiError("Votre vérification d'identité a été rejetée. Veuillez soumettre de nouveaux documents.", 403);
        }
      } catch {
        // Prisma non disponible → on laisse SUBMITTED
      }
    }

    // Mapping recruitment.ApplicationStatus → Prisma.ApplicationStatus
    const prismaStatus = initialStatus === "IDENTITY_PENDING"
      ? "IDENTITY_PENDING" as const
      : "UNREAD" as const;

    // Vérifier qu'une candidature n'existe pas déjà (contrainte unique)
    const existing = await prisma.application.findUnique({
      where: { freelancerId_missionId: { freelancerId: freelancerProfile.id, missionId: body.missionId } },
    });
    if (existing) {
      return apiError("Vous avez déjà postulé à cette mission.", 409);
    }

    // Sauvegarder en base
    const application = await prisma.application.create({
      data: {
        freelancerId: freelancerProfile.id,
        missionId: body.missionId,
        coverLetter: body.coverLetter || null,
        proposedBudget: body.proposedBudget || null,
        status: prismaStatus,
      },
    });

    // Audit
    logApplicationAudit({
      applicationId: application.id,
      fromStatus: null,
      toStatus: initialStatus,
      actorId: body.freelancerId,
      actorName: body.freelancerName || "Freelancer",
    });

    // Jobs
    await enqueueJob("APPLICATION_SUBMITTED", {
      applicationId: application.id,
      missionId: application.missionId,
      freelancerId: body.freelancerId,
      freelancerName: body.freelancerName || "Freelancer",
      proposedBudget: application.proposedBudget ?? 0,
    }).catch(() => {});

    const missionAppsCount = await prisma.application.count({ where: { missionId: body.missionId } });
    if (missionAppsCount === 1) {
      await enqueueJob("MISSION_PROPOSALS_RECEIVED", {
        missionId: application.missionId,
        title: `Mission ${application.missionId}`,
        count: 1,
      }).catch(() => {});
    }

    // Invalider le cache des pages dashboard freelancer
    revalidatePath("/dashboard/freelancer");
    revalidatePath("/dashboard/freelancer/candidatures");

    return apiSuccess({ ...application, identityPending: initialStatus === "IDENTITY_PENDING" }, 201);
  },
});
