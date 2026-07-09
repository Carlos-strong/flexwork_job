import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import { SignatureService } from "@/lib/services/signature.service";
import type { ApiContext } from "@/lib/api-gateway";

// PATCH /api/signature/certificate/[id]
// Révoque un certificat
export const PATCH = createApiHandler({
  methods: ["PATCH"],
  requireRole: "FREELANCER",
  async handler(req: NextRequest, ctx: ApiContext) {
    const userId = (ctx.session as any)?.user?.id;
    if (!userId) return apiError("Non authentifié", 401);

    const certificateId = ctx.params?.id;
    if (!certificateId) return apiError("ID du certificat requis", 400);

    const body = await parseBody<{ reason?: string }>(req);

    try {
      const result = await SignatureService.revokeCertificate(
        certificateId,
        body.reason || "Révocation demandée par l'utilisateur"
      );

      return apiSuccess(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la révocation";
      return apiError(message, 500);
    }
  },
});
