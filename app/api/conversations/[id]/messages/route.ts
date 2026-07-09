import { NextRequest, NextResponse } from "next/server";
import {
  chatMessages,
  addTextMessage,
} from "@/lib/collaboration";
import { parseBody, apiSuccess, apiError } from "@/lib/api-gateway";

// GET /api/conversations/[id]/messages
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const msgs = chatMessages.filter((m) => m.conversationId === params.id);

  // Si aucun message trouvé, tenter avec le préfixe conv- (conversation virtuelle)
  if (msgs.length === 0 && params.id.startsWith("conv-")) {
    const extractedContractId = params.id.slice("conv-".length);
    const { conversations } = await import("@/lib/collaboration");
    const storedConv = conversations.find((c) => c.contractId === extractedContractId);
    if (storedConv) {
      const storedMsgs = chatMessages.filter((m) => m.conversationId === storedConv.id);
      return NextResponse.json({ success: true, data: storedMsgs });
    }
  }

  return NextResponse.json({ success: true, data: msgs });
}

// POST /api/conversations/[id]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await parseBody<{
    senderId?: string;
    senderName?: string;
    content?: string;
    type?: string;
  }>(req);

  if (!body.content || !body.senderId) {
    return apiError("senderId et content requis", 400);
  }

  const msg = addTextMessage({
    conversationId: params.id,
    senderId: body.senderId,
    senderName: body.senderName || "Utilisateur",
    content: body.content,
  });

  return NextResponse.json({ success: true, data: msg }, { status: 201 });
}
