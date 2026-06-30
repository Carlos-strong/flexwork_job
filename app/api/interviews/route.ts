import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import {
  candidateInterviews,
  scheduleInterview,
  completeInterview,
} from "@/lib/recruitment";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/interviews?applicationId=X ────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const applicationId = ctx.searchParams.get("applicationId");
    const filtered = applicationId
      ? candidateInterviews.filter((i) => i.applicationId === applicationId)
      : candidateInterviews;
    return apiSuccess(filtered);
  },
});

// ── POST /api/interviews ───────────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      applicationId?: string;
      meetingUrl?: string;
      scheduledAt?: string;
      duration?: number;
    }>(req);

    if (!body.applicationId || !body.meetingUrl) {
      return apiError("applicationId et meetingUrl requis", 400);
    }

    const interview = scheduleInterview({
      applicationId: body.applicationId,
      meetingUrl: body.meetingUrl,
      scheduledAt: body.scheduledAt || new Date().toISOString(),
      duration: body.duration || 30,
    });

    return apiSuccess(interview, 201);
  },
});

// ── PUT /api/interviews/[id] ───────────────────
export async function PUT(
  req: NextRequest,
  ctx: { params: Record<string, string> }
) {
  const body = await parseBody<{ action?: string; notes?: string }>(req);
  const interview = candidateInterviews.find((i) => i.id === ctx.params.id);
  if (!interview) return apiError("Entretien introuvable", 404);

  if (body.action === "complete") {
    completeInterview(ctx.params.id, body.notes);
  }

  return apiSuccess(interview);
}
