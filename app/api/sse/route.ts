import { NextRequest } from "next/server";
import { syncStore } from "@/lib/sync-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/sse?room=<contractId>
 *
 * Connexion SSE persistante. Le client s'abonne à une "room" (contractId ou conversationId).
 * Les événements sont poussés dès qu'un autre participant envoie un message
 * ou modifie l'état du contrat / d'un milestone.
 */
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  if (!room) {
    return new Response("Paramètre 'room' requis", { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // Ping initial pour établir la connexion côté client
      controller.enqueue(encoder.encode(": ping\n\n"));

      unsubscribe = syncStore.subscribe(room, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          unsubscribe?.();
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
