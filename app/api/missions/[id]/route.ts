import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";
import { qualifyMission } from "@/lib/workflow";
import type { ApiContext } from "@/lib/api-gateway";

// ── Sérialisation mission ──────────────────────
function serializeMission(m: any, applicationsCount = 0) {
  return {
    id: m.id,
    clientId: m.clientId,
    title: m.title,
    description: m.description,
    budget: m.budget,
    budgetType: m.budgetType,
    currency: m.currency,
    skills: m.skills,
    duration: m.duration,
    location: m.location,
    status: m.status,
    workMode: m.workMode,
    hybridDaysPerWeek: m.hybridDaysPerWeek,
    missionCity: m.missionCity,
    missionCountry: m.missionCountry,
    missionStartDate: m.missionStartDate?.toISOString?.() ?? m.missionStartDate ?? null,
    missionEndDate: m.missionEndDate?.toISOString?.() ?? m.missionEndDate ?? null,
    missionDays: m.missionDays,
    missionStartHour: m.missionStartHour,
    missionEndHour: m.missionEndHour,
    categorieId: m.categorieId,
    categorieAutre: m.categorieAutre,
    metierId: m.metierId,
    metierAutre: m.metierAutre,
    serviceAutre: m.serviceAutre,
    experienceRequise: m.experienceRequise,
    applicationsCount,
    createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
  };
}

// ── GET /api/missions/[id] ─────────────────────
const _GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { id } = ctx.params;

    const mission = await prisma.mission.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });

    if (!mission) return apiError("Mission introuvable", 404);

    return apiSuccess(serializeMission(mission, mission._count.applications));
  },
});

export async function GET(req: NextRequest, ctx: { params: Record<string, string> }) {
  return _GET(req, ctx);
}

// ── PUT /api/missions/[id] ─────────────────────
const _PUT = createApiHandler({
  methods: ["PUT"],
  requireRole: "CLIENT",
  async handler(req: NextRequest, ctx: ApiContext) {
    const { id } = ctx.params;
    const sessionUserId = (ctx.session as any)?.user?.id as string | undefined;
    if (!sessionUserId) return apiError("Non authentifié", 401);

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: sessionUserId },
      select: { id: true },
    });
    if (!clientProfile) return apiError("Profil client introuvable", 404);

    const existing = await prisma.mission.findUnique({ where: { id } });
    if (!existing) return apiError("Mission introuvable", 404);
    if (existing.clientId !== clientProfile.id) return apiError("Accès non autorisé", 403);

    const body = await parseBody<{
      title?: string;
      description?: string;
      budget?: number | null;
      budgetType?: string;
      currency?: string;
      skills?: string[];
      duration?: string;
      location?: string;
      status?: string;
      workMode?: string;
      hybridDaysPerWeek?: number | null;
      missionCity?: string | null;
      missionCountry?: string | null;
      missionStartDate?: string | null;
      missionEndDate?: string | null;
      missionDays?: string | null;
      missionStartHour?: string | null;
      missionEndHour?: string | null;
      expiresAt?: string | null;
      categorieId?: string | null;
      categorieAutre?: string | null;
      metierId?: string | null;
      metierAutre?: string | null;
      serviceAutre?: string | null;
      experienceRequise?: string | null;
    }>(req);

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.budget !== undefined) data.budget = body.budget;
    if (body.budgetType !== undefined) data.budgetType = body.budgetType;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.skills !== undefined) data.skills = body.skills;
    if (body.duration !== undefined) data.duration = body.duration;
    if (body.location !== undefined) data.location = body.location;
    if (body.status !== undefined) data.status = body.status;
    if (body.workMode !== undefined) data.workMode = body.workMode;
    if (body.hybridDaysPerWeek !== undefined) data.hybridDaysPerWeek = body.hybridDaysPerWeek;
    if (body.missionCity !== undefined) data.missionCity = body.missionCity;
    if (body.missionCountry !== undefined) data.missionCountry = body.missionCountry;
    if (body.missionStartDate !== undefined) data.missionStartDate = body.missionStartDate ? new Date(body.missionStartDate) : null;
    if (body.missionEndDate !== undefined) data.missionEndDate = body.missionEndDate ? new Date(body.missionEndDate) : null;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.missionDays !== undefined) data.missionDays = body.missionDays;
    if (body.missionStartHour !== undefined) data.missionStartHour = body.missionStartHour;
    if (body.missionEndHour !== undefined) data.missionEndHour = body.missionEndHour;
    if (body.categorieId !== undefined) data.categorieId = body.categorieId;
    if (body.categorieAutre !== undefined) data.categorieAutre = body.categorieAutre;
    if (body.metierId !== undefined) data.metierId = body.metierId;
    if (body.metierAutre !== undefined) data.metierAutre = body.metierAutre;
    if (body.serviceAutre !== undefined) data.serviceAutre = body.serviceAutre;
    if (body.experienceRequise !== undefined) data.experienceRequise = body.experienceRequise;

    const updated = await prisma.mission.update({
      where: { id },
      data,
      include: { _count: { select: { applications: true } } },
    });

    revalidatePath("/missions");
    revalidatePath("/dashboard/client/missions");
    revalidatePath(`/dashboard/client/missions/${id}`);

    // Re-qualification asynchrone après mise à jour
    if (existing.status === "OPEN" || existing.status === "DRAFT") {
      const title = (body.title ?? existing.title) as string;
      const description = (body.description ?? existing.description) as string;
      const skills = (body.skills ?? existing.skills) as string[];
      const budget = body.budget !== undefined ? (body.budget ?? 0) : (existing.budget ?? 0);
      const qualification = qualifyMission({ title, description, budget, skills });

      enqueueJob("MISSION_QUALIFIED", {
        missionId: updated.id, title,
        score: qualification.score,
        passed: qualification.passed,
        warnings: qualification.warnings,
        suggestedSkills: qualification.suggestedSkills,
        suggestedBudget: qualification.suggestedBudget,
      }).catch(() => {});

      if (qualification.passed) {
        enqueueJob("MISSION_PUBLISHED", { missionId: updated.id, title, skills, budget }).catch(() => {});
      }
    }

    return apiSuccess(serializeMission(updated, updated._count.applications));
  },
});

export async function PUT(req: NextRequest, ctx: { params: Record<string, string> }) {
  return _PUT(req, ctx);
}

// ── DELETE /api/missions/[id] ──────────────────
const _DELETE = createApiHandler({
  methods: ["DELETE"],
  requireRole: "CLIENT",
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { id } = ctx.params;
    const sessionUserId = (ctx.session as any)?.user?.id as string | undefined;
    if (!sessionUserId) return apiError("Non authentifié", 401);

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: sessionUserId },
      select: { id: true },
    });
    if (!clientProfile) return apiError("Profil client introuvable", 404);

    const existing = await prisma.mission.findUnique({ where: { id } });
    if (!existing) return apiError("Mission introuvable", 404);
    if (existing.clientId !== clientProfile.id) return apiError("Accès non autorisé", 403);

    await prisma.mission.delete({ where: { id } });
    revalidatePath("/dashboard/client/missions");

    return apiSuccess({ message: "Mission supprimée" });
  },
});

export async function DELETE(req: NextRequest, ctx: { params: Record<string, string> }) {
  return _DELETE(req, ctx);
}
