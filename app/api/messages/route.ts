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
  generateId,
} from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { pushNotification } from "@/lib/socket-server-client";
import type { ApiContext } from "@/lib/api-gateway";

/** Trouve ou crée la conversation liée à un contractId */
async function ensureConversation(
  contractId: string,
  participantInfo?: { senderId?: string; senderName?: string; receiverId?: string; title?: string },
): Promise<string> {
  let conv = conversations.find((c) => c.contractId === contractId);

  // Essayer de récupérer le contrat depuis Prisma pour un titre parlant
  let missionTitle = participantInfo?.title || "";
  if (!missionTitle) {
    try {
      const dbContract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: { mission: { select: { title: true } } },
      });
      if (dbContract?.mission?.title) {
        missionTitle = dbContract.mission.title;
      }
    } catch {
      // Prisma indisponible
    }
  }

  // Si la conversation existe déjà mais a un titre générique, le mettre à jour
  if (conv) {
    const isGeneric = conv.title.startsWith("Conversation") || conv.title.startsWith("Contrat");
    if (isGeneric && missionTitle) {
      conv.title = missionTitle;
    } else if (isGeneric && !missionTitle) {
      // Fallback : essayer de trouver le nom via les participants stockés
      const storedParts = participants.filter((p) => p.conversationId === conv!.id);
      if (storedParts.length > 0) {
        conv.title = storedParts.map((p) => p.userName).join(" - ");
      }
    }
    return conv.id;
  }

  // Créer une nouvelle conversation
  const title = missionTitle || "Conversation";
  conv = {
    id: generateId("conv"),
    contractId,
    title,
    createdAt: new Date().toISOString(),
  };
  conversations.push(conv);

  // Ajouter les participants si fournis
  if (participantInfo?.senderId && participantInfo?.senderName) {
    participants.push({
      id: generateId("part"),
      conversationId: conv.id,
      userId: participantInfo.senderId,
      userName: participantInfo.senderName,
      role: "CLIENT", // rôle par défaut, sera affiné si besoin
    });
  }
  if (participantInfo?.receiverId) {
    // Essayer de récupérer le nom du destinataire depuis la base.
    // Le receiverId peut être un User ID ou un FreelancerProfile ID.
    let receiverUserId = participantInfo.receiverId;
    let receiverName = participantInfo.receiverId;
    try {
      // D'abord essayer comme User ID direct
      let receiver = await prisma.user.findUnique({
        where: { id: participantInfo.receiverId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (receiver) {
        receiverUserId = receiver.id;
        receiverName = [receiver.firstName, receiver.lastName].filter(Boolean).join(" ") || receiverName;
      } else {
        // Essayer comme FreelancerProfile ID (résoudre vers User)
        const profile = await prisma.freelancerProfile.findUnique({
          where: { id: participantInfo.receiverId },
          select: { userId: true, user: { select: { firstName: true, lastName: true } } },
        });
        if (profile) {
          receiverUserId = profile.userId;
          receiverName = [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ") || receiverName;
        }
      }
    } catch { /* Prisma indisponible */ }
    participants.push({
      id: generateId("part"),
      conversationId: conv.id,
      userId: receiverUserId,
      userName: receiverName,
      role: "FREELANCER",
    });
  }

  return conv.id;
}

// ── GET /api/messages ─────────────────────────
// Supporte ?contractId=X  ET  ?conversationId=X
export const GET = createApiHandler({
  methods: ["GET"],
  async handler(_req: NextRequest, ctx: ApiContext) {
    const contractId     = ctx.searchParams.get("contractId");
    const conversationId = ctx.searchParams.get("conversationId");

    // 1. Essayer Prisma d'abord (messages persistés)
    try {
      if (contractId) {
        const dbMessages = await prisma.message.findMany({
          where: { contractId },
          orderBy: { createdAt: "asc" },
        });
        if (dbMessages.length > 0) {
          return apiSuccess(dbMessages.map(m => ({
            id: m.id,
            conversationId: m.contractId,
            senderId: m.senderId,
            senderName: m.senderId, // sera complété côté client
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })));
        }
      }

      if (conversationId) {
        const conv = conversations.find((c) => c.id === conversationId);
        if (conv) {
          const dbMessages = await prisma.message.findMany({
            where: { contractId: conv.contractId },
            orderBy: { createdAt: "asc" },
          });
          if (dbMessages.length > 0) {
            return apiSuccess(dbMessages.map(m => ({
              id: m.id,
              conversationId: m.contractId,
              senderId: m.senderId,
              senderName: m.senderId,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            })));
          }
        }
      }
    } catch {
      // Fallback: in-memory si Prisma indisponible
    }

    // 2. Fallback: store in-memory (legacy)
    if (contractId) {
      const convId = conversations.find((c) => c.contractId === contractId)?.id;
      if (!convId) return apiSuccess([]);
      return apiSuccess(chatMessages.filter((m) => m.conversationId === convId));
    }

    if (conversationId) {
      // D'abord par conversationId exact
      const byConvId = chatMessages.filter((m) => m.conversationId === conversationId);
      if (byConvId.length > 0) return apiSuccess(byConvId);

      // Sinon, tenter d'extraire le contractId du pattern conv-{contractId}
      // (conversation virtuelle créée depuis Prisma) et chercher les messages
      // de la conversation stockée correspondante.
      if (conversationId.startsWith("conv-")) {
        const extractedContractId = conversationId.slice("conv-".length);
        const storedConv = conversations.find((c) => c.contractId === extractedContractId);
        if (storedConv) {
          return apiSuccess(chatMessages.filter((m) => m.conversationId === storedConv.id));
        }
      }

      return apiSuccess([]);
    }

    return apiSuccess(chatMessages);
  },
});

// ── POST /api/messages ────────────────────────
// Accepte { contractId } OU { conversationId } + { senderId, senderName, content, receiverId }
export const POST = createApiHandler({
  methods: ["POST"],
  async handler(req: NextRequest) {
    const body = await parseBody<{
      contractId?: string;
      conversationId?: string;
      senderId?: string;
      senderName?: string;
      content?: string;
      receiverId?: string;
    }>(req);

    if (!body.content?.trim()) {
      return apiError("content requis", 400);
    }

    let conversationId: string;
    let contractId: string | undefined;

    if (body.conversationId) {
      conversationId = body.conversationId;
      const conv = conversations.find((c) => c.id === conversationId);
      contractId = conv?.contractId || conversationId;
    } else if (body.contractId) {
      contractId = body.contractId;
      conversationId = await ensureConversation(contractId, {
        senderId: body.senderId,
        senderName: body.senderName,
        receiverId: body.receiverId,
        title: (body as any).title,
      });
    } else {
      return apiError("contractId ou conversationId requis", 400);
    }

    const senderId   = body.senderId   || "anon";
    const senderName = body.senderName || "Utilisateur";
    // Déterminer le receiverId : soit fourni, soit déduit des participants de la conversation
    let receiverId = body.receiverId || "";
    if (!receiverId && conversationId) {
      const otherParty = participants.find(
        (p) => p.conversationId === conversationId && p.userId !== senderId
      );
      if (otherParty) receiverId = otherParty.userId;
    }
    // 1. Sauvegarder en mémoire (compatible existant)
    const msg = addTextMessage({ conversationId, senderId, senderName, content: body.content.trim() });

    // 2. Persister en base de données (Prisma)
    if (contractId && receiverId) {
      try {
        await prisma.message.create({
          data: {
            id: msg.id,
            contractId,
            senderId,
            receiverId,
            content: body.content.trim(),
          },
        });
      } catch (dbError) {
        console.error("[API messages] Erreur Prisma:", dbError);
        // Non bloquant — le message est déjà en mémoire
      }
    }

    // 3. Notification push temps réel au destinataire
    if (receiverId) {
      try {
        pushNotification({
          userId: receiverId,
          type: "new_message",
          title: `💬 ${senderName}`,
          body: body.content.trim().substring(0, 120),
          link: contractId ? `/dashboard?chat=${contractId}` : undefined,
        });
      } catch {
        // Non bloquant
      }
    }

    // Le broadcast temps réel est géré côté client via WebSocket (send_message → WS server).
    return apiSuccess({ ...msg, receiverId }, 201);
  },
});
