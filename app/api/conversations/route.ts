import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import {
  conversations,
  participants,
  chatMessages,
  addTextMessage,
  addSystemMessage,
  generateId,
} from "@/lib/collaboration";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/conversations ────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const contractId = ctx.searchParams.get("contractId");
    const convs = contractId
      ? conversations.filter((c) => c.contractId === contractId)
      : conversations;
    return apiSuccess(convs);
  },
});

// ── POST /api/conversations ───────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      contractId?: string;
      title?: string;
      clientId?: string;
      clientName?: string;
      freelancerId?: string;
      freelancerName?: string;
    }>(req);

    if (!body.contractId || !body.title) {
      return apiError("contractId et title requis", 400);
    }

    const conv = {
      id: generateId("conv"),
      contractId: body.contractId,
      title: body.title,
      createdAt: new Date().toISOString(),
    };
    conversations.push(conv);

    if (body.clientId && body.freelancerId) {
      participants.push(
        { id: generateId("part"), conversationId: conv.id, userId: body.clientId, userName: body.clientName || "Client", role: "CLIENT" },
        { id: generateId("part"), conversationId: conv.id, userId: body.freelancerId, userName: body.freelancerName || "Freelancer", role: "FREELANCER" },
      );
    }

    addSystemMessage(conv.id, `💬 Conversation créée pour le contrat.`);

    return apiSuccess(conv, 201);
  },
});

// ── GET /api/conversations/[id]/messages ───────
export async function GET_MESSAGES(
  _req: NextRequest,
  ctx: { params: Record<string, string> }
) {
  const msgs = chatMessages.filter((m) => m.conversationId === ctx.params.id);
  return apiSuccess(msgs);
}

// ── POST /api/conversations/[id]/messages ──────
export async function POST_MESSAGE(
  req: NextRequest,
  ctx: { params: Record<string, string> }
) {
  const body = await parseBody<{
    senderId?: string;
    senderName?: string;
    content?: string;
    type?: string;
  }>(req);

  if (!body.content || !body.senderId) {
    return apiError("senderId et content requis", 400);
  }

  const msg = addTextMessage({
    conversationId: ctx.params.id,
    senderId: body.senderId,
    senderName: body.senderName || "Utilisateur",
    content: body.content,
  });

  return apiSuccess(msg, 201);
}
