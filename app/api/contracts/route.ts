import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createApiHandler,
  apiSuccess,
  apiError,
  parseBody,
  apiPaginated,
  getPaginationParams,
} from "@/lib/api-gateway";
import { enqueueJob } from "@/lib/queue";
import { escrow } from "@/lib/escrow";
import type { EscrowProvider } from "@/lib/escrow";
import { createConversation, addSystemMessage, generateId, chatMessages, conversations } from "@/lib/collaboration";
import { contracts, persistMockStore } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import type { ApiContext } from "@/lib/api-gateway";

// ── GET /api/contracts ─────────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const { page, pageSize, skip } = getPaginationParams(ctx.searchParams);
    
    // Récupérer la session pour filtrer par utilisateur
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    try {
      // Filtrer par utilisateur : client (via mission) OU freelance
      const where = userId ? {
        OR: [
          { mission: { client: { userId } } },
          { freelancer: { userId } },
        ],
      } : {};

      const [dbContracts, total] = await Promise.all([
        prisma.contract.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: { mission: { select: { title: true, clientId: true } } },
        }),
        prisma.contract.count({ where }),
      ]);
      return apiPaginated(
        dbContracts.map((c) => ({
          id: c.id,
          missionId: c.missionId,
          missionTitle: c.mission?.title ?? "Mission",
          clientId: c.mission?.clientId,
          freelancerId: c.freelancerId,
          status: c.status,
          contractType: c.contractType,
          totalBudget: c.totalBudget,
          escrowAmount: c.escrowAmount,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
        page, pageSize, total
      );
    } catch {
      // DB indisponible — fallback mock
    }

    const total = contracts.length;
    const paginated = contracts.slice(skip, skip + pageSize);
    return apiPaginated(paginated, page, pageSize, total);
  },
});

// ── POST /api/contracts ────────────────────────
// Pipeline: CONTRACT → ESCROW (TrustEngine + Stripe)
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      missionId?: string;
      freelancerId?: string;
      missionTitle?: string;
      clientId?: string;
      clientName?: string;
      freelancerName?: string;
      freelancerStripeAccountId?: string;
      preferredEscrow?: EscrowProvider;
      escrowAmount?: number;
      milestones?: { title: string; amount: number }[];
    }>(req);

    if (!body.missionId || !body.freelancerId) {
      return apiError("missionId et freelancerId requis", 400);
    }

    const contractId = `c-${Date.now()}`;
    const escrowAmount = body.escrowAmount || 0;
    const milestones = body.milestones || [];
    const missionTitle = body.missionTitle || "Mission";

    // 1. Créer le contrat
    const contract = {
      id: contractId,
      missionId: body.missionId,
      missionTitle,
      clientName: body.clientName || "Client",
      clientId: body.clientId || "",
      freelancerId: body.freelancerId,
      freelancerName: body.freelancerName || "Freelancer",
      status: "PENDING",
      escrowAmount,
      escrowId: null as string | null,
      stripePaymentIntentId: null as string | null,
      stripeClientSecret: null as string | null,
      milestones: milestones.map((m, i) => ({ id: `ms-${i}`, title: m.title, amount: m.amount, status: "PENDING", dueDate: "" })),
      conversationId: undefined as string | undefined,
      createdAt: new Date().toISOString(),
    };

    contracts.push(contract);
    persistMockStore();

    // 2. Notifier création contrat
    await enqueueJob("CONTRACT_CREATED", {
      contractId,
      missionId: body.missionId,
      missionTitle,
      clientId: body.clientId || "",
      freelancerId: body.freelancerId,
      escrowAmount,
    });

    // 3. Créer l'escrow selon le choix du freelance
    const escrowResult = await escrow.create({
      contractId,
      missionTitle,
      totalAmount: escrowAmount,
      clientId: body.clientId || "",
      freelancerId: body.freelancerId,
      provider: body.preferredEscrow || "both",
      freelancerStripeAccountId: body.freelancerStripeAccountId,
      milestones: milestones.length > 0 ? milestones : [
        { title: "Livraison finale", amount: escrowAmount },
      ],
    });

    // 4. Mettre à jour le contrat avec les IDs escrow
    contract.escrowId = escrowResult.trustEngineEscrowId;
    contract.stripePaymentIntentId = escrowResult.stripePaymentIntentId;
    contract.stripeClientSecret = escrowResult.stripeClientSecret;
    contract.status = "ACTIVE";
    persistMockStore();

    // 5. Créer la conversation + messages système
    // 5a. Vérifier si une conversation pré-contrat existe (créée lors du SHORTLISTED)
    const preContractConv = conversations.find(
      (c) => c.contractId.startsWith("pre-") && c.title.includes(body.freelancerId || "")
    );
    if (preContractConv) {
      // Mettre à jour le contractId de la conversation pré-existante
      preContractConv.contractId = contractId;
      // Transférer les messages de l'ancienne conversation vers la nouvelle
      const preMessages = chatMessages.filter((m) => m.conversationId === preContractConv.id);
      preMessages.forEach((m) => { m.conversationId = preContractConv.id; });
    }

    const conversation = preContractConv || createConversation({
      contractId,
      title: missionTitle,
      clientId: body.clientId || "",
      clientName: body.clientName || "Client",
      freelancerId: body.freelancerId,
      freelancerName: body.freelancerName || "Freelancer",
    });

    addSystemMessage(conversation.id, `🎉 Contrat créé pour la mission "${missionTitle}".`);
    addSystemMessage(conversation.id, `💰 Montant séquestré : ${escrowAmount.toLocaleString()} €`);
    addSystemMessage(conversation.id, `🔐 Escrow actif — les fonds sont sécurisés.`);

    // Stocker conversationId dans le contrat
    contract.conversationId = conversation.id;

    // 6. Notifier création escrow + auto-transition
    await enqueueJob("CONTRACT_ESCROW_CREATED", {
      contractId,
      escrowId: escrowResult.trustEngineEscrowId || "",
      missionTitle,
      amount: escrowAmount,
      clientId: body.clientId || "",
      freelancerId: body.freelancerId,
    });

    await enqueueJob("MISSION_FUNDED", {
      missionId: body.missionId,
      title: missionTitle,
      amount: escrowAmount,
      paymentIntentId: escrowResult.stripePaymentIntentId || "",
    });

    return apiSuccess(contract, 201);
  },
});
