import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import { enqueueJob } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { applications } from "@/lib/mock-data";
import {
  ALLOWED_TRANSITIONS,
  logApplicationAudit,
  type ApplicationStatus,
} from "@/lib/recruitment";

/** Mapping recruitment → Prisma */
const TO_PRISMA: Partial<Record<ApplicationStatus, string>> = {
  SUBMITTED: "UNREAD", UNREAD: "UNREAD", READ: "READ",
  SHORTLISTED: "SHORTLISTED", DISCUSSION: "DISCUSSION", INTERVIEW: "INTERVIEW",
  OFFER_SENT: "OFFER_SENT", OFFER_ACCEPTED: "OFFER_ACCEPTED",
  OFFER_DECLINED: "OFFER_DECLINED", ARCHIVED: "ARCHIVED",
  REJECTED: "REJECTED", IDENTITY_PENDING: "IDENTITY_PENDING",
  // Legacy
  UNDER_REVIEW: "UNDER_REVIEW", INTERVIEW_PENDING: "INTERVIEW_PENDING",
  INTERVIEW_COMPLETED: "INTERVIEW_COMPLETED", SELECTED: "SELECTED",
  CONTRACT_PENDING: "CONTRACT_PENDING", CONTRACT_DECLINED: "CONTRACT_DECLINED",
  CONTRACT_ACCEPTED: "CONTRACT_ACCEPTED", ESCROW_PENDING: "ESCROW_PENDING",
  ACTIVE: "ACTIVE", WITHDRAWN: "WITHDRAWN",
};

/** Mapping Prisma → recruitment */
const FROM_PRISMA: Record<string, ApplicationStatus> = {
  UNREAD: "SUBMITTED", READ: "READ", SHORTLISTED: "SHORTLISTED",
  DISCUSSION: "DISCUSSION", INTERVIEW: "INTERVIEW", OFFER_SENT: "OFFER_SENT",
  OFFER_ACCEPTED: "OFFER_ACCEPTED", OFFER_DECLINED: "OFFER_DECLINED",
  ARCHIVED: "ARCHIVED", REJECTED: "REJECTED",
  PENDING: "SUBMITTED", IDENTITY_PENDING: "IDENTITY_PENDING",
  ACCEPTED: "ACCEPTED" as ApplicationStatus, WITHDRAWN: "WITHDRAWN",
};

// ═══ PUT /api/applications/[id] — Transition de statut (client) ═══
export const PUT = createApiHandler({
  methods: ["PUT"],
  requireRole: "CLIENT",
  async handler(req: NextRequest, ctx: { params: Record<string, string> }) {
    const body = await parseBody<{
      status?: ApplicationStatus;
      reason?: string;
    }>(req);

    const newStatus = body.status;
    if (!newStatus) return apiError("Statut cible requis", 400);

    // Récupérer la candidature
    let app: { id: string; status: string; missionId: string; freelancerId: string } | null = null;
    try {
      const found = await prisma.application.findUnique({
        where: { id: ctx.params.id },
        select: { id: true, status: true, missionId: true, freelancerId: true },
      });
      if (found) app = { ...found, status: String(found.status) };
    } catch { /* fallback mock */ }

    if (!app) {
      const mockApp = applications.find((a) => a.id === ctx.params.id);
      if (mockApp) app = { id: mockApp.id, status: mockApp.status, missionId: mockApp.missionId, freelancerId: mockApp.freelancerId };
    }
    if (!app) return apiError("Candidature introuvable", 404);

    const currentStatus: ApplicationStatus = FROM_PRISMA[app.status] ?? "SUBMITTED";

    // Vérifier transition autorisée
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed?.length) {
      return apiError(`Statut terminal : ${currentStatus}. Aucune transition possible.`, 422);
    }
    if (!allowed.includes(newStatus)) {
      return apiError(
        `Transition refusée : ${currentStatus} → ${newStatus}. Autorisées : ${allowed.join(", ")}`,
        422
      );
    }

    // Auto-lecture : si UNREAD/SUBMITTED → marquer READ avant action
    if (currentStatus === "SUBMITTED" && newStatus !== "READ") {
      try {
        await prisma.application.update({
          where: { id: ctx.params.id },
          data: { status: "READ" as import("@prisma/client").ApplicationStatus },
        });
      } catch { /* mock */ }
      logApplicationAudit({ applicationId: ctx.params.id, fromStatus: currentStatus, toStatus: "READ", actorId: "client", actorName: "Client", reason: "Lecture automatique" });
    }

    // Appliquer le nouveau statut
    const prismaStatus = TO_PRISMA[newStatus] || newStatus;
    try {
      await prisma.application.update({
        where: { id: ctx.params.id },
        data: { status: prismaStatus as import("@prisma/client").ApplicationStatus },
      });
    } catch {
      const mockApp = applications.find((a) => a.id === ctx.params.id);
      if (mockApp) mockApp.status = newStatus;
    }

    // Audit
    logApplicationAudit({
      applicationId: ctx.params.id,
      fromStatus: currentStatus,
      toStatus: newStatus,
      actorId: "client",
      actorName: "Client",
      reason: body.reason,
    });

    // Jobs contextuels
    if (newStatus === "SHORTLISTED") {
      await enqueueJob("APPLICATION_SHORTLISTED", { applicationId: ctx.params.id }).catch(() => {});
    }
    if (newStatus === "REJECTED") {
      await enqueueJob("APPLICATION_REJECTED", { applicationId: ctx.params.id, reason: body.reason }).catch(() => {});
    }
    if (newStatus === "OFFER_SENT") {
      await enqueueJob("OFFER_SENT", { applicationId: ctx.params.id }).catch(() => {});
    }
    if (newStatus === "OFFER_ACCEPTED") {
      await enqueueJob("OFFER_ACCEPTED", { applicationId: ctx.params.id }).catch(() => {});
    }

    // Revalidation
    revalidatePath("/dashboard/client/candidatures");
    revalidatePath("/dashboard/freelancer/candidatures");

    return apiSuccess({
      id: ctx.params.id,
      previousStatus: currentStatus,
      newStatus,
    });
  },
});

// ── PATCH /api/applications/[id] ────────────────
// Permet au freelance de modifier sa candidature (coverLetter, proposedBudget)
export const PATCH = createApiHandler({
  methods: ["PATCH"],
  async handler(req: NextRequest, ctx: { params: Record<string, string> }) {
    const body = await parseBody<{
      coverLetter?: string;
      proposedBudget?: number;
    }>(req);

    if (body.coverLetter === undefined && body.proposedBudget === undefined) {
      return apiError("Rien à modifier", 400);
    }

    const data: any = {};
    if (body.coverLetter !== undefined) data.coverLetter = body.coverLetter;
    if (body.proposedBudget !== undefined) data.proposedBudget = body.proposedBudget;

    try {
      const updated = await prisma.application.update({
        where: { id: ctx.params.id },
        data,
      });
      return apiSuccess({
        id: updated.id,
        coverLetter: updated.coverLetter,
        proposedBudget: updated.proposedBudget,
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch {
      // Fallback mock data
      const idx = applications.findIndex((a) => a.id === ctx.params.id);
      if (idx === -1) return apiError("Candidature introuvable", 404);
      applications[idx] = { ...applications[idx], ...data };
      return apiSuccess({ id: ctx.params.id, ...data, updatedAt: new Date().toISOString() });
    }
  },
});
