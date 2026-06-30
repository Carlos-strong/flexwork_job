import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
  apiPaginated,
  getPaginationParams,
} from "@/lib/api-gateway";
import { enqueueJob } from "@/lib/queue";
import { payments } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { virtualCardService, isVirtualCardEnabled } from "@/lib/payments";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/payments ─────────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { searchParams } = ctx;
    const contractId = searchParams.get("contractId");
    const type = searchParams.get("type");
    const userId = searchParams.get("userId");
    const { page, pageSize, skip } = getPaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (contractId) where.metadata = { path: ["contractId"], equals: contractId };
    if (type) where.type = type;

    const [dbPayments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.count({ where }),
    ]);

    const paginated = dbPayments.map((p) => ({
      id: p.id,
      userId: p.userId,
      amount: p.amount,
      type: p.type,
      status: p.status,
      currency: p.currency,
      contractId: (p.metadata as { contractId?: string } | null)?.contractId ?? "",
      stripePaymentId: p.stripePaymentId,
      trustEngineId: p.trustEngineId,
      virtualCardId: p.virtualCardId,
      createdAt: p.createdAt.toISOString(),
    }));

    return apiPaginated(paginated, page, pageSize, total);
  },
});

// ── POST /api/payments ────────────────────────
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      contractId?: string;
      amount?: number;
      type?: string;
      currency?: string;
      milestoneId?: string;
      milestoneTitle?: string;
      freelancerId?: string;
      stripeAccountId?: string;
      missionId?: string;
      missionTitle?: string;
      clientId?: string;  // Requis pour la vérification KYC entreprise
      useVirtualCard?: boolean; // Force l'utilisation d'une carte virtuelle (mode test)
    }>(req);

    if (!body.contractId || !body.amount || !body.type) {
      return apiError("contractId, amount et type requis", 400);
    }

    // ── Règle métier #5 (PRD) : Porte KYC entreprise cliente ──
    // Un client entreprise doit avoir son KYC validé avant tout paiement.
    // Sauf en mode test avec VirtualCard (KYC Différé).
    if (body.clientId && !body.useVirtualCard) {
      try {
        const clientProfile = await prisma.clientProfile.findUnique({
          where: { userId: body.clientId },
          select: { companyName: true, companyVerificationStatus: true },
        });
        if (
          clientProfile?.companyName &&
          clientProfile.companyVerificationStatus !== "VALIDE"
        ) {
          const statusLabel =
            clientProfile.companyVerificationStatus === "EN_ATTENTE"
              ? "en cours de traitement"
              : "rejetée";
          return apiError(
            `Paiement bloqué : la vérification entreprise est ${statusLabel}. Veuillez fournir votre SIRET, KBIS et RIB.`,
            403
          );
        }
      } catch {
        // Prisma non disponible (dev sans DB) → on laisse passer
      }
    }

    // ── Mode KYC Différé : Paiement via carte Virtuelle ──
    // En développement/test, on utilise une carte Visa virtuelle
    // au lieu de Stripe. Aucun document requis (KYC Différé).
    if (body.useVirtualCard && isVirtualCardEnabled() && body.type === "DEPOSIT" && body.clientId) {
      return await handleVirtualCardPayment(body);
    }

    const payment = {
      id: `pay-${Date.now()}`,
      contractId: body.contractId,
      type: body.type,
      amount: body.amount,
      currency: body.currency || "EUR",
      status: "SUCCEEDED",
      stripePaymentId: body.type === "DEPOSIT" ? `pi_${Date.now()}` : undefined,
      trustEngineId: body.type === "DEPOSIT" ? `escrow_${Date.now()}` : undefined,
      stripePayoutId: body.type === "PAYOUT" ? `po_${Date.now()}` : undefined,
      createdAt: new Date().toISOString(),
    };
    payments.push(payment);

    // Sauvegarder en base pour synchronisation
    const payerUserId = body.type === "PAYOUT" ? body.freelancerId : body.clientId;
    if (payerUserId) {
      try {
        await prisma.payment.create({
          data: {
            userId: payerUserId ?? body.clientId ?? "",
            amount: body.amount ?? 0,
            currency: body.currency ?? "EUR",
            type: (body.type as "DEPOSIT" | "RELEASE" | "PAYOUT" | "REFUND") ?? "DEPOSIT",
            status: "SUCCEEDED",
            stripePaymentId: payment.stripePaymentId ?? null,
            trustEngineId: payment.trustEngineId ?? null,
            metadata: { contractId: body.contractId, milestoneId: body.milestoneId },
          },
        }).catch(() => { /* fallback silencieux */ });
      } catch { /* prisma indisponible */ }
    }

    // Invalider le cache des pages paiement
    revalidatePath("/dashboard/client/paiements");
    revalidatePath("/dashboard/freelancer/paiements");

    // Enqueue le job selon le type
    const jobType = body.type === "DEPOSIT" ? "PAYMENT_DEPOSIT"
      : body.type === "RELEASE" ? "PAYMENT_RELEASE"
      : body.type === "PAYOUT" ? "PAYMENT_PAYOUT"
      : null;

    if (jobType) {
      await enqueueJob(jobType, {
        paymentId: payment.id,
        contractId: payment.contractId,
        amount: payment.amount,
        milestoneId: body.milestoneId,
        milestoneTitle: body.milestoneTitle || "Milestone",
        freelancerId: body.freelancerId || "",
        stripeAccountId: body.stripeAccountId || "",
        stripePaymentIntentId: payment.stripePaymentId || "",
      });
    }

    // 🎯 Auto-transition FUNDED→PAID sur PAYOUT final
    if (body.type === "PAYOUT" && body.missionId) {
      await enqueueJob("MISSION_PAID", {
        missionId: body.missionId,
        title: body.missionTitle || "Mission",
        amount: body.amount,
      });
    }

    return apiSuccess(payment, 201);
  },
});

/**
 * Gère un paiement via carte virtuelle (mode KYC Différé).
 * Crée la carte si nécessaire, débite le montant, enregistre la transaction.
 */
async function handleVirtualCardPayment(body: {
  contractId?: string;
  amount?: number;
  clientId?: string;
  missionTitle?: string;
  currency?: string;
}) {
  const clientId = body.clientId!;
  const amount = body.amount!;
  const currency = body.currency || "EUR";

  // 1. Récupérer ou créer une carte virtuelle pour le client
  const existingCards = await virtualCardService.listByUser(clientId);
  let card = existingCards[0];

  if (!card) {
    card = await virtualCardService.create({
      userId: clientId,
      cardholderName: `Client ${clientId.slice(0, 8)}`,
      label: "Carte test — Paiement KYC Différé",
      initialBalance: Math.max(amount * 2, 10000),
      currency,
    });
  }

  // 2. Vérifier que le solde est suffisant
  if (card.balance < amount) {
    // Recharger automatiquement
    await virtualCardService.deposit({
      virtualCardId: card.id,
      amount: Math.max(amount * 2 - card.balance, 10000),
      currency,
      description: "Recharge automatique pour paiement",
    });
  }

  // 3. Effectuer le paiement
  const payResult = await virtualCardService.pay({
    virtualCardId: card.id,
    amount,
    currency,
    contractId: body.contractId,
    missionTitle: body.missionTitle,
    description: `Dépôt escrow — ${body.missionTitle || "Mission"}`,
  });

  // 4. Enregistrer le paiement
  const payment = {
    id: `pay-vc-${Date.now()}`,
    contractId: body.contractId!,
    type: "DEPOSIT",
    amount,
    currency,
    status: "SUCCEEDED",
    virtualCardId: card.id,
    stripePaymentId: `pi_vc_${payResult.transaction.id}`,
    trustEngineId: `escrow_vc_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  payments.push(payment);

  // Persister en base pour synchronisation
  try {
    await prisma.payment.create({
      data: {
        userId: clientId,
        amount,
        currency,
        type: "DEPOSIT",
        status: "SUCCEEDED",
        stripePaymentId: payment.stripePaymentId ?? null,
        trustEngineId: payment.trustEngineId ?? null,
        virtualCardId: card.id,
        metadata: { contractId: body.contractId },
      },
    }).catch(() => {});
  } catch { /* prisma indisponible */ }

  revalidatePath("/dashboard/client/paiements");
  revalidatePath("/dashboard/freelancer/paiements");

  // 5. Enqueue le job de dépôt
  await enqueueJob("PAYMENT_DEPOSIT", {
    paymentId: payment.id,
    contractId: payment.contractId,
    amount: payment.amount,
    virtualCardId: card.id,
    virtualCardTransactionId: payResult.transaction.id,
    authorizationCode: payResult.receipt.authorizationCode,
  });

  return apiSuccess({
    ...payment,
    card: {
      id: card.id,
      cardNumber: card.cardNumber,
      balanceAfter: payResult.transaction.balanceAfter,
    },
    receipt: payResult.receipt,
  }, 201);
}
