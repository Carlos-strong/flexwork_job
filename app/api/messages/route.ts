import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import type { ApiContext } from "@/lib/api-gateway";

const messages: {
  id: string; contractId: string; senderId: string; senderName: string;
  content: string; createdAt: string;
}[] = [
  { id: "msg-1", contractId: "c-1", senderId: "client-2", senderName: "WebAgency", content: "Bonjour ! Prêt à démarrer la mission ?", createdAt: "2026-06-11T09:00:00Z" },
  { id: "msg-2", contractId: "c-1", senderId: "f-2", senderName: "Lucas Petit", content: "Bonjour ! Oui, tout est prêt.", createdAt: "2026-06-11T10:30:00Z" },
  { id: "msg-3", contractId: "c-1", senderId: "client-2", senderName: "WebAgency", content: "Super, le premier milestone est validé !", createdAt: "2026-06-18T14:00:00Z" },
];

// ── GET /api/messages ─────────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const contractId = ctx.searchParams.get("contractId");
    const filtered = contractId
      ? messages.filter((m) => m.contractId === contractId)
      : messages;
    return apiSuccess(filtered);
  },
});

// ── POST /api/messages ────────────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      contractId?: string;
      senderId?: string;
      senderName?: string;
      content?: string;
    }>(req);

    if (!body.contractId || !body.content || !body.senderId || !body.senderName) {
      return apiError("contractId, senderId, senderName et content requis", 400);
    }

    const msg = {
      id: `msg-${Date.now()}`,
      contractId: body.contractId,
      senderId: body.senderId,
      senderName: body.senderName,
      content: body.content.trim(),
      createdAt: new Date().toISOString(),
    };
    messages.push(msg);

    return apiSuccess(msg, 201);
  },
});
