import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import { enqueueJob } from "@/lib/queue";
import { milestones } from "@/lib/mock-data";

interface Milestone {
  id: string; title: string; description: string; amount: number;
  status: string; dueDate: string; completedAt?: string;
}

// ── GET /api/contracts/[id]/milestones ────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: { params: Record<string, string> }) {
    return apiSuccess(milestones[ctx.params.id] || []);
  },
});

// ── POST /api/contracts/[id]/milestones ───────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest, ctx: { params: Record<string, string> }) {
    const body = await parseBody<{ title?: string; amount?: number }>(req);
    if (!body.title || !body.amount) {
      return apiError("Titre et montant requis", 400);
    }

    const milestone = {
      id: `m-${Date.now()}`,
      title: body.title,
      description: "",
      amount: body.amount,
      status: "PENDING",
      dueDate: "",
    };

    if (!milestones[ctx.params.id]) milestones[ctx.params.id] = [];
    milestones[ctx.params.id].push(milestone);

    await enqueueJob("MILESTONE_SUBMITTED", {
      milestoneId: milestone.id,
      contractId: ctx.params.id,
      title: milestone.title,
      amount: milestone.amount,
    });

    return apiSuccess(milestone, 201);
  },
});

// ── PUT /api/contracts/[id]/milestones ────────
export const PUT = createApiHandler({
  methods: ["PUT"],
  async handler(req: NextRequest, ctx: { params: Record<string, string> }) {
    const body = await parseBody<{
      milestoneId?: string;
      status?: string;
      missionId?: string;
      missionTitle?: string;
    }>(req);

    if (!body.milestoneId || !body.status) {
      return apiError("milestoneId et status requis", 400);
    }

    const validStatuses = ["PENDING", "IN_REVIEW", "APPROVED", "RELEASED"];
    if (!validStatuses.includes(body.status)) {
      return apiError(`Statut invalide. Valides: ${validStatuses.join(", ")}`, 400);
    }

    const list = milestones[ctx.params.id] || [];
    const idx = list.findIndex((m: Milestone) => m.id === body.milestoneId);
    if (idx === -1) return apiError("Milestone introuvable", 404);

    list[idx] = {
      ...list[idx],
      status: body.status,
      completedAt: body.status === "APPROVED" ? new Date().toISOString() : undefined,
    };

    if (body.status === "APPROVED") {
      await enqueueJob("PAYMENT_RELEASE", {
        paymentId: `pay-${Date.now()}`,
        contractId: ctx.params.id,
        milestoneId: body.milestoneId,
        milestoneTitle: list[idx].title,
        amount: list[idx].amount,
      });
      await enqueueJob("MILESTONE_APPROVED", {
        milestoneId: body.milestoneId,
        contractId: ctx.params.id,
        title: list[idx].title,
        amount: list[idx].amount,
      });
      if (body.missionId) {
        await enqueueJob("MISSION_APPROVED", {
          missionId: body.missionId,
          title: body.missionTitle || "Mission",
          contractId: ctx.params.id,
        });
      }
    }

    if (body.status === "RELEASED") {
      await enqueueJob("MILESTONE_RELEASED", {
        milestoneId: body.milestoneId,
        contractId: ctx.params.id,
        title: list[idx].title,
        amount: list[idx].amount,
      });
    }

    return apiSuccess(list[idx]);
  },
});
