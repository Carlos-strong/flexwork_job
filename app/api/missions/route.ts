import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
  getPaginationParams,
  apiPaginated,
} from "@/lib/api-gateway";
import { enqueueJob } from "@/lib/queue";
import { missions } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { qualifyMission } from "@/lib/workflow";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/missions ──────────────────────────
const _GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { searchParams } = ctx;
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const search = searchParams.get("search")?.toLowerCase();
    const skill = searchParams.get("skill")?.toLowerCase();
    const { page, pageSize, skip } = getPaginationParams(searchParams);

    try {
      // Tentative d'utilisation de PostgreSQL avec full-text search
      const where: Record<string, unknown> = {};

      if (status) where.status = status;
      if (clientId) where.clientId = clientId;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }
      if (skill) where.skills = { hasSome: [skill] };

      const [dbMissions, total] = await Promise.all([
        prisma.mission.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { applications: true } } },
        }),
        prisma.mission.count({ where }),
      ]);

      if (dbMissions.length > 0) {
        return apiPaginated(
          dbMissions.map((m) => ({
            id: m.id,
            clientId: m.clientId,
            title: m.title,
            description: m.description,
            budget: m.budget ?? 0,
            currency: m.currency,
            budgetType: m.budgetType,
            skills: m.skills,
            duration: m.duration,
            location: m.location,
            workMode: m.workMode,
            missionCity: m.missionCity,
            missionCountry: m.missionCountry,
            status: m.status,
            applicationsCount: m._count.applications,
            expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
            createdAt: m.createdAt.toISOString(),
          })),
          page, pageSize, total
        );
      }
    } catch {
      console.log("[Missions] Fallback vers mock data (BDD non disponible)");
    }

    // ── Fallback mock data ──────────────────────
    let filtered = [...missions];
    if (status) filtered = filtered.filter((m) => m.status === status);
    if (clientId) filtered = filtered.filter((m) => m.clientId === clientId);
    if (search) {
      filtered = filtered.filter(
        (m) => m.title.toLowerCase().includes(search) || m.description.toLowerCase().includes(search)
      );
    }
    if (skill) {
      filtered = filtered.filter((m) => m.skills.some((s) => s.toLowerCase().includes(skill)));
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + pageSize);

    return apiPaginated(paginated, page, pageSize, total);
  },
});

export async function GET(req: NextRequest, ctx: { params: Record<string, string> }) {
  return _GET(req, ctx);
}

// ── POST /api/missions ─────────────────────────
// Pipeline: DRAFT → PUBLISHED
const _POST = createApiHandler({
  methods: ["POST"],
  requireRole: "CLIENT",
  async handler(req: NextRequest, ctx: ApiContext) {
    const body = await parseBody<{
      title?: string;
      description?: string;
      budget?: number | null;
      budgetType?: string;
      currency?: string;
      skills?: string[];
      duration?: string;
      location?: string;
      clientId?: string;
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
      serviceAutre?: string | null;
      experienceRequise?: string | null;
    }>(req);

    if (!body.title || !body.description || (body.budgetType !== "OPEN_QUOTE" && !body.budget)) {
      return apiError("Le titre, la description et le budget sont requis", 400);
    }

    // Sanitize and validate input
    const sanitizedTitle = body.title.trim();
    const sanitizedDescription = body.description.trim();
    const sanitizedBudget = body.budgetType === "OPEN_QUOTE" ? null : Number(body.budget);

    if (sanitizedTitle.length < 10) {
      return apiError("Le titre doit contenir au moins 10 caractères", 400);
    }

    if (sanitizedDescription.length < 50) {
      return apiError("La description doit contenir au moins 50 caractères", 400);
    }

    if (sanitizedBudget !== null && (isNaN(sanitizedBudget) || sanitizedBudget <= 0)) {
      return apiError("Le budget doit être un nombre positif", 400);
    }

    const missionId = `mission-${Date.now()}`;
    const title = sanitizedTitle;
    const description = sanitizedDescription;
    const budget = sanitizedBudget;
    const skills = body.skills || [];

    // 1. Qualification IA (synchrone, pas d'appel externe)
    const qualification = qualifyMission({ title, description, budget: sanitizedBudget ?? 0, skills });
    const workflowStep = qualification.passed ? "PUBLISHED" : "DRAFT";
    const status = qualification.passed ? "OPEN" : "DRAFT";

    // Résoudre le profil client depuis la session
    const sessionUserId = (ctx.session as any)?.user?.id as string | undefined;
    if (!sessionUserId) return apiError("Non authentifié", 401);

    const clientProfile = await prisma.clientProfile.findUnique({
      where: { userId: sessionUserId },
      select: { id: true },
    });
    if (!clientProfile) {
      return apiError("Profil client introuvable. Complétez votre inscription.", 404);
    }

    // Persister en base
    const dbMission = await prisma.mission.create({
      data: {
        clientId: clientProfile.id,
        title: sanitizedTitle,
        description: sanitizedDescription,
        budget: sanitizedBudget,
        budgetType: (body.budgetType === "FIXED" || body.budgetType === "OPEN_QUOTE") ? body.budgetType : "FIXED",
        currency: body.currency ?? "XAF",
        skills,
        duration: body.duration,
        workMode: (body.workMode as "REMOTE" | "ON_SITE" | "HYBRID") ?? "REMOTE",
        hybridDaysPerWeek: body.hybridDaysPerWeek ?? null,
        missionCity: body.missionCity ?? null,
        missionCountry: body.missionCountry ?? null,
        location: body.location ?? null,
        missionStartDate: body.missionStartDate ? new Date(body.missionStartDate) : null,
        missionEndDate: body.missionEndDate ? new Date(body.missionEndDate) : null,        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,        missionDays: body.missionDays ?? null,
        missionStartHour: body.missionStartHour ?? null,
        missionEndHour: body.missionEndHour ?? null,
        categorieId: body.categorieId ?? null,
        categorieAutre: body.categorieAutre ?? null,
        serviceAutre: body.serviceAutre ?? null,
        experienceRequise: body.experienceRequise ?? null,
        status: status as "OPEN" | "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      },
    });

    // Invalider le cache des pages dashboard client
    revalidatePath("/missions");
    revalidatePath("/dashboard/client");
    revalidatePath("/dashboard/client/missions");

    // 2. Jobs asynchrones — non bloquants (Redis peut être down)
    enqueueJob("MISSION_QUALIFIED", {
      missionId: dbMission.id, title,
      score: qualification.score,
      passed: qualification.passed,
      warnings: qualification.warnings,
      suggestedSkills: qualification.suggestedSkills,
      suggestedBudget: qualification.suggestedBudget,
    }).catch(() => {});

    if (qualification.passed) {
      enqueueJob("MISSION_PUBLISHED", { missionId: dbMission.id, title, skills, budget: sanitizedBudget ?? 0 }).catch(() => {});
    }

    return apiSuccess({
      id: dbMission.id,
      clientId: clientProfile.id,
      title, description, budget,
      currency: body.currency || "XAF",
      skills,
      duration: body.duration || "",
      location: body.location || "Remote",
      status,
      workflowStep,
      applicationsCount: 0,
      createdAt: dbMission.createdAt.toISOString(),
      qualification,
    }, 201);
  },
});

export async function POST(req: NextRequest, ctx: { params: Record<string, string> }) {
  return _POST(req, ctx);
}
