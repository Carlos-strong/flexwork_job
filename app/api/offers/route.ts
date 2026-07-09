import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
} from "@/lib/api-gateway";
import {
  contractOffers,
} from "@/lib/recruitment";
import type { ApiContext } from "@/lib/api-gateway";
import { prisma } from "@/lib/prisma";

// ── GET /api/offers?applicationId=X ────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const applicationId = ctx.searchParams.get("applicationId");

    // 1. Essayer Prisma d'abord (offres persistées)
    try {
      const dbOffers = await prisma.offer.findMany({
        where: applicationId ? { applicationId } : {},
        orderBy: { createdAt: "desc" },
        include: { milestones: true },
      });
      if (dbOffers.length > 0) {
        return apiSuccess(dbOffers.map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          offerType: o.offerType,
          totalBudget: o.totalBudget,
          hourlyRate: o.hourlyRate,
          startDate: o.startDate?.toISOString(),
          endDate: o.endDate?.toISOString(),
          status: o.status,
          expiresAt: o.expiresAt?.toISOString(),
          sentAt: o.sentAt?.toISOString(),
          declinedAt: o.declinedAt?.toISOString(),
          declineReason: o.declineReason,
          milestones: o.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            amount: m.amount,
            executionRate: m.executionRate ?? 100,
            status: m.status,
            dueDate: m.dueDate?.toISOString(),
          })),
        })));
      }
    } catch { /* Fallback: in-memory */ }

    // 2. Fallback: store in-memory (legacy)
    const filtered = applicationId
      ? contractOffers.filter((o) => o.applicationId === applicationId)
      : contractOffers;
    return apiSuccess(filtered);
  },
});

// ── POST /api/offers ──────────────────────────
// Crée et envoie une offre (DRAFT → SENT) en une seule opération
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      applicationId?: string;
      missionId?: string;
      title?: string;
      description?: string;
      offerType?: "FIXED" | "HOURLY";
      totalBudget?: number;
      hourlyRate?: number;
      weeklyHourLimit?: number;
      startDate?: string;
      endDate?: string;
      duration?: string;
      milestones?: Array<{
        title: string;
        description?: string;
        amount: number;
        dueDate?: string;
        executionRate?: number;
      }>;
      expiresAt?: string;
    }>(req);

    if (!body.applicationId || !body.title || !body.offerType || !body.startDate) {
      return apiError("applicationId, title, offerType et startDate sont requis", 400);
    }

    const budget = body.offerType === "FIXED"
      ? (body.totalBudget ?? 0)
      : (body.hourlyRate ?? 0);

    if (budget <= 0) {
      return apiError("Budget ou taux horaire requis (> 0)", 400);
    }

    try {
      const { OfferService } = await import("@/lib/services/offer.service");

      // 1. Créer l'offre en DRAFT
      const offer = await OfferService.createOffer({
        applicationId: body.applicationId,
        title: body.title,
        description: body.description,
        offerType: body.offerType,
        totalBudget: body.offerType === "FIXED" ? budget : undefined,
        hourlyRate: body.offerType === "HOURLY" ? budget : undefined,
        weeklyHourLimit: body.weeklyHourLimit,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        milestones: body.milestones?.map((m) => ({
          title: m.title,
          description: m.description,
          amount: m.amount,
          dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
          executionRate: m.executionRate,
        })),
      });

      // 2. Envoyer immédiatement (DRAFT → SENT + application → OFFER_SENT)
      const sentOffer = await OfferService.sendOffer(
        offer.id,
        body.expiresAt ? new Date(body.expiresAt) : undefined
      );

      return apiSuccess(sentOffer, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création de l'offre";
      return apiError(message, 500);
    }
  },
});

// NOTE : l'acceptation/refus d'une offre se fait via PATCH /api/offers/[id]?action=accept|decline
// (voir app/api/offers/[id]/route.ts qui utilise OfferService pour créer le contrat correctement).

