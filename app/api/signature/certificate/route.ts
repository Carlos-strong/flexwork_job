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

// ── GET /api/signature/certificate ────────────
// Liste les certificats de l'utilisateur connecté
export const GET = createApiHandler({
  methods: ["GET"],
  requireRole: "FREELANCER",
  async handler(_req: NextRequest, ctx: ApiContext) {
    const userId = (ctx.session as any)?.user?.id;
    if (!userId) return apiError("Non authentifié", 401);

    const certificates = await SignatureService.getUserCertificates(userId);
    return apiSuccess(certificates);
  },
});

// ── POST /api/signature/certificate ───────────
// Génère un nouveau certificat numérique
export const POST = createApiHandler({
  methods: ["POST"],
  requireRole: "FREELANCER",
  async handler(req: NextRequest, ctx: ApiContext) {
    const userId = (ctx.session as any)?.user?.id;
    if (!userId) return apiError("Non authentifié", 401);

    const body = await parseBody<{
      commonName?: string;
      email?: string;
      organization?: string;
      passphrase?: string;
    }>(req);

    if (!body.commonName || !body.email || !body.passphrase) {
      return apiError("commonName, email et passphrase sont requis", 400);
    }

    if (body.passphrase.length < 8) {
      return apiError("La passphrase doit contenir au moins 8 caractères", 400);
    }

    try {
      const certificate = await SignatureService.generateCertificate({
        userId,
        commonName: body.commonName,
        email: body.email,
        organization: body.organization,
        passphrase: body.passphrase,
      });

      return apiSuccess(certificate, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la génération du certificat";
      return apiError(message, 500);
    }
  },
});
