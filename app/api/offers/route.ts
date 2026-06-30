import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import {
  contractOffers,
  createOffer,
  acceptOffer,
} from "@/lib/recruitment";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/offers?applicationId=X ────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const applicationId = ctx.searchParams.get("applicationId");
    const filtered = applicationId
      ? contractOffers.filter((o) => o.applicationId === applicationId)
      : contractOffers;
    return apiSuccess(filtered);
  },
});

// ── POST /api/offers ──────────────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      applicationId?: string;
      contractId?: string;
      amount?: number;
      deadline?: string;
      proposedBy?: "CLIENT" | "FREELANCER";
    }>(req);

    if (!body.applicationId || !body.contractId || !body.amount) {
      return apiError("applicationId, contractId et amount requis", 400);
    }

    const offer = createOffer({
      applicationId: body.applicationId,
      contractId: body.contractId,
      amount: body.amount,
      deadline: body.deadline || new Date(Date.now() + 7 * 86400000).toISOString(),
      proposedBy: body.proposedBy || "CLIENT",
    });

    return apiSuccess(offer, 201);
  },
});

// ── PUT /api/offers/[id] ───────────────────────
export async function PUT(
  req: NextRequest,
  ctx: { params: Record<string, string> }
) {
  const body = await parseBody<{ action?: string }>(req);
  const offer = contractOffers.find((o) => o.id === ctx.params.id);
  if (!offer) return apiError("Offre introuvable", 404);

  if (body.action === "accept") {
    acceptOffer(ctx.params.id);
  }

  return apiSuccess(offer);
}
