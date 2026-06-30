import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import {
  meetings,
  meetingLogs,
  createMeeting,
  logMeetingEvent,
  generateId,
} from "@/lib/collaboration";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/meetings ─────────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const contractId = ctx.searchParams.get("contractId");
    const filtered = contractId
      ? meetings.filter((m) => m.contractId === contractId)
      : meetings;
    return apiSuccess(filtered);
  },
});

// ── POST /api/meetings ────────────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      contractId?: string;
      conversationId?: string;
      title?: string;
      hostId?: string;
      guestId?: string;
      meetUrl?: string;
      scheduledAt?: string;
      duration?: number;
    }>(req);

    if (!body.contractId || !body.title || !body.meetUrl) {
      return apiError("contractId, title et meetUrl requis", 400);
    }

    const meeting = createMeeting({
      contractId: body.contractId,
      conversationId: body.conversationId || "",
      title: body.title,
      hostId: body.hostId || "host",
      guestId: body.guestId || "guest",
      meetUrl: body.meetUrl,
      scheduledAt: body.scheduledAt || new Date().toISOString(),
      duration: body.duration || 30,
    });

    return apiSuccess(meeting, 201);
  },
});

// ── PUT /api/meetings/[id] ────────────────────
export async function PUT(
  req: NextRequest,
  ctx: { params: Record<string, string> }
) {
  const body = await parseBody<{ action?: string }>(req);
  const meeting = meetings.find((m) => m.id === ctx.params.id);
  if (!meeting) return apiError("Réunion introuvable", 404);

  if (body.action === "start") {
    logMeetingEvent(ctx.params.id, "started");
  } else if (body.action === "end") {
    logMeetingEvent(ctx.params.id, "ended");
  }

  return apiSuccess(meeting);
}

// ── GET /api/meetings/[id]/logs ───────────────
export async function GET_LOGS(
  _req: NextRequest,
  ctx: { params: Record<string, string> }
) {
  const logs = meetingLogs.filter((l) => l.meetingId === ctx.params.id);
  return apiSuccess(logs);
}
