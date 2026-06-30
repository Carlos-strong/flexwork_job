import { NextRequest } from "next/server";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
  apiPaginated,
  getPaginationParams,
} from "@/lib/api-gateway";
import { virtualCardService, isVirtualCardEnabled } from "@/lib/payments";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/payments/virtual-card ─────────────
// Liste les cartes de l'utilisateur ou retourne une carte spécifique
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { searchParams } = ctx;
    const cardId = searchParams.get("cardId");
    const userId = searchParams.get("userId");
    const tx = searchParams.get("transactions");

    // Vérifier que le service est activé
    if (!isVirtualCardEnabled()) {
      return apiError("Service de carte virtuelle désactivé en production", 403);
    }

    // Transactions d'une carte
    if (cardId && tx === "true") {
      const txs = await virtualCardService.getTransactions(cardId);
      return apiSuccess(txs);
    }

    // Carte spécifique
    if (cardId) {
      const card = await virtualCardService.getById(cardId);
      if (!card) {
        return apiError("Carte virtuelle introuvable", 404);
      }
      return apiSuccess(card);
    }

    // Liste des cartes d'un utilisateur
    if (userId) {
      const cards = await virtualCardService.listByUser(userId);
      return apiSuccess(cards);
    }

    // Stats (admin)
    const stats = virtualCardService.getStats();
    return apiSuccess(stats);
  },
});

// ── POST /api/payments/virtual-card ────────────
// Crée une carte ou effectue un paiement
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    if (!isVirtualCardEnabled()) {
      return apiError("Service de carte virtuelle désactivé en production", 403);
    }

    const body = await parseBody<{
      action: "create" | "pay" | "deposit" | "refund" | "reset" | "deactivate";
      // create
      userId?: string;
      cardholderName?: string;
      label?: string;
      initialBalance?: number;
      currency?: string;
      // pay / deposit / refund / reset / deactivate
      virtualCardId?: string;
      amount?: number;
      contractId?: string;
      missionTitle?: string;
      description?: string;
      originalTransactionId?: string;
    }>(req);

    switch (body.action) {
      // ── Création d'une carte virtuelle ──────────
      case "create": {
        if (!body.userId || !body.cardholderName) {
          return apiError("userId et cardholderName requis", 400);
        }
        const card = await virtualCardService.create({
          userId: body.userId,
          cardholderName: body.cardholderName,
          label: body.label,
          initialBalance: body.initialBalance,
          currency: body.currency,
        });
        return apiSuccess(card, 201);
      }

      // ── Paiement avec une carte virtuelle ───────
      case "pay": {
        if (!body.virtualCardId || !body.amount) {
          return apiError("virtualCardId et amount requis", 400);
        }
        try {
          const result = await virtualCardService.pay({
            virtualCardId: body.virtualCardId,
            amount: body.amount,
            currency: body.currency,
            contractId: body.contractId,
            missionTitle: body.missionTitle,
            description: body.description,
          });
          return apiSuccess(result, 200);
        } catch (err) {
          return apiError((err as Error).message, 402);
        }
      }

      // ── Dépôt / Crédit sur une carte ────────────
      case "deposit": {
        if (!body.virtualCardId || !body.amount) {
          return apiError("virtualCardId et amount requis", 400);
        }
        try {
          const tx = await virtualCardService.deposit({
            virtualCardId: body.virtualCardId,
            amount: body.amount,
            currency: body.currency,
            description: body.description,
          });
          return apiSuccess(tx, 200);
        } catch (err) {
          return apiError((err as Error).message, 400);
        }
      }

      // ── Remboursement ───────────────────────────
      case "refund": {
        if (!body.virtualCardId || !body.amount) {
          return apiError("virtualCardId et amount requis", 400);
        }
        try {
          const tx = await virtualCardService.refund({
            virtualCardId: body.virtualCardId,
            amount: body.amount,
            currency: body.currency,
            description: body.description,
          });
          return apiSuccess(tx, 200);
        } catch (err) {
          return apiError((err as Error).message, 400);
        }
      }

      // ── Réinitialisation du solde ───────────────
      case "reset": {
        if (!body.virtualCardId) {
          return apiError("virtualCardId requis", 400);
        }
        try {
          const card = await virtualCardService.resetBalance(body.virtualCardId);
          return apiSuccess(card);
        } catch (err) {
          return apiError((err as Error).message, 404);
        }
      }

      // ── Désactivation ───────────────────────────
      case "deactivate": {
        if (!body.virtualCardId) {
          return apiError("virtualCardId requis", 400);
        }
        try {
          await virtualCardService.deactivate(body.virtualCardId);
          return apiSuccess({ message: "Carte désactivée" });
        } catch (err) {
          return apiError((err as Error).message, 404);
        }
      }

      default:
        return apiError(
          "Action invalide. Actions supportées : create, pay, deposit, refund, reset, deactivate",
          400
        );
    }
  },
});
