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
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ApiContext } from "@/lib/api-gateway";

/** Enrichit une conversation avec le nom de l'autre participant */
async function enrichConversation(
  conv: { id: string; contractId: string; title: string; createdAt: string },
  currentUserId: string | undefined,
) {
  // 1. Chercher les participants stockés en mémoire
  const storedParticipants = participants.filter((p) => p.conversationId === conv.id);
  if (storedParticipants.length > 0) {
    if (currentUserId) {
      const other = storedParticipants.find((p) => p.userId !== currentUserId);
      if (other) {
        return { ...conv, otherPartyName: other.userName, otherPartyId: other.userId };
      }
    }
    // Si pas de session, prendre le premier participant comme "autre"
    // (chaque côté voit l'autre)
    const other = storedParticipants[0];
    return { ...conv, otherPartyName: other.userName, otherPartyId: other.userId };
  }

  // 2. Interroger Prisma (contrat → mission → client / freelancer → user)
  if (conv.contractId) {
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: conv.contractId },
        include: {
          freelancer: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
          mission: { select: { client: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } } } },
        },
      });
      if (contract) {
        const freelancerUserId = contract.freelancer.userId;
        const clientUserId = contract.mission.client.userId;
        const freelancerName = [contract.freelancer.user.firstName, contract.freelancer.user.lastName].filter(Boolean).join(" ") || "Freelance";
        const clientName = [contract.mission.client.user.firstName, contract.mission.client.user.lastName].filter(Boolean).join(" ") || "Client";

        if (currentUserId) {
          const isFreelancer = currentUserId === freelancerUserId;
          return {
            ...conv,
            otherPartyName: isFreelancer ? clientName : freelancerName,
            otherPartyId: isFreelancer ? clientUserId : freelancerUserId,
          };
        }
        // Pas de session → prendre le client par défaut
        return { ...conv, otherPartyName: clientName, otherPartyId: clientUserId };
      }
    } catch {
      // Prisma indisponible
    }
  }

  // 3. Fallback : si on a des participants sans conversationId correspondant
  // (peut arriver si la conversation a été créée sans participants)
  if (conv.contractId) {
    const contractParticipants = participants.filter((p) => {
      const pConv = conversations.find((c) => c.id === p.conversationId);
      return pConv?.contractId === conv.contractId;
    });
    if (contractParticipants.length > 0) {
      const other = contractParticipants[0];
      return { ...conv, otherPartyName: other.userName, otherPartyId: other.userId };
    }
  }

  // 4. Dernier recours : remplacer le titre générique "Conversation"
  if (conv.title === "Conversation" || conv.title.startsWith("Conversation —")) {
    // Utiliser l'ID court comme identifiant plutôt qu'un libellé vide
    return { ...conv, otherPartyName: `Mission #${conv.contractId.slice(-6)}`, otherPartyId: undefined };
  }

  return conv;
}

/** Crée les participants d'une conversation à partir du contrat Prisma */
async function createParticipantsFromContract(contractId: string, conversationId: string): Promise<void> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        freelancer: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
        mission: { select: { client: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } } } },
      },
    });
    if (contract) {
      const fName = [contract.freelancer.user.firstName, contract.freelancer.user.lastName].filter(Boolean).join(" ") || "Freelance";
      const cName = [contract.mission.client.user.firstName, contract.mission.client.user.lastName].filter(Boolean).join(" ") || "Client";
      participants.push(
        { id: generateId("part"), conversationId, userId: contract.freelancer.userId, userName: fName, role: "FREELANCER" },
        { id: generateId("part"), conversationId, userId: contract.mission.client.userId, userName: cName, role: "CLIENT" },
      );
    }
  } catch { /* Prisma indisponible */ }
}

// ── GET /api/conversations ────────────────────
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const contractId = ctx.searchParams.get("contractId");

    // Récupérer la session pour identifier l'utilisateur courant
    let currentUserId: string | undefined;
    try {
      const session = await getServerSession(authOptions);
      currentUserId = (session?.user as { id?: string } | undefined)?.id;
    } catch {
      // Session indisponible
    }

    // 1. Essayer Prisma d'abord (contrats persistés → on reconstruit les conversations)
    try {
      if (contractId) {
        // Chercher le contrat et ses messages pour construire une conversation virtuelle
        const dbContract = await prisma.contract.findUnique({
          where: { id: contractId },
          include: {
            mission: { select: { title: true } },
            messages: { take: 1, orderBy: { createdAt: "asc" } },
          },
        });
        if (dbContract) {
          // ⚡ Priorité au store mémoire/fichier : si une conversation existe déjà
          // avec ce contractId, on la retourne pour préserver son ID (lié aux messages).
          const storedConv = conversations.find((c) => c.contractId === contractId);
          if (storedConv) {
            // Mettre à jour le titre si générique
            if (storedConv.title.startsWith("Conversation") || storedConv.title.startsWith("Contrat")) {
              storedConv.title = dbContract.mission?.title ?? "Mission";
            }
            // Créer des participants si absents
            if (!participants.some((p) => p.conversationId === storedConv.id)) {
              await createParticipantsFromContract(storedConv.contractId, storedConv.id);
            }
            const enriched = await enrichConversation(storedConv, currentUserId);
            return apiSuccess([enriched]);
          }

          const virtualConv = {
            id: `conv-${contractId}`,
            contractId,
            title: dbContract.mission?.title ?? "Mission",
            createdAt: dbContract.createdAt.toISOString(),
          };
          const enriched = await enrichConversation(virtualConv, currentUserId);
          return apiSuccess([enriched]);
        }
      } else {
        // Lister toutes les conversations à partir des contrats en base
        const dbContracts = await prisma.contract.findMany({
          take: 50,
          orderBy: { createdAt: "desc" },
          include: { mission: { select: { title: true } } },
        });
        if (dbContracts.length > 0) {
          // ⚡ Pour chaque contrat, on préfère la conversation stockée (ID réel)
          // si elle existe, sinon on crée une conversation virtuelle.
          const convs = await Promise.all(
            dbContracts.map(async (c) => {
              const stored = conversations.find((s) => s.contractId === c.id);
              if (stored) {
                // Mettre à jour le titre si générique
                if (stored.title.startsWith("Conversation") || stored.title.startsWith("Contrat")) {
                  stored.title = c.mission?.title ?? "Mission";
                }
                // Créer des participants si absents
                if (!participants.some((p) => p.conversationId === stored.id)) {
                  await createParticipantsFromContract(stored.contractId, stored.id);
                }
                return enrichConversation(stored, currentUserId);
              }
              return enrichConversation(
                {
                  id: `conv-${c.id}`,
                  contractId: c.id,
                  title: c.mission?.title ?? "Mission",
                  createdAt: c.createdAt.toISOString(),
                },
                currentUserId,
              );
            }),
          );
          return apiSuccess(convs);
        }
      }
    } catch {
      // Prisma indisponible — fallback fichier/mémoire
    }

    // 2. Fallback: store fichier/mémoire (persistant grâce à lib/collaboration.ts)
    const convs = contractId
      ? conversations.filter((c) => c.contractId === contractId)
      : conversations;

    // Créer des participants pour les conversations stockées qui n'en ont pas
    await Promise.all(convs.map(async (c) => {
      if (participants.some((p) => p.conversationId === c.id)) return;
      await createParticipantsFromContract(c.contractId, c.id);
      // Mettre à jour le titre si générique
      if (c.title === "Conversation" || c.title.startsWith("Conversation —")) {
        try {
          const contract = await prisma.contract.findUnique({
            where: { id: c.contractId },
            select: { mission: { select: { title: true } } },
          });
          if (contract?.mission?.title) c.title = contract.mission.title;
        } catch { /* ignore */ }
      }
    }));

    const enriched = await Promise.all(
      convs.map((c) => enrichConversation(c, currentUserId)),
    );
    return apiSuccess(enriched);
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
