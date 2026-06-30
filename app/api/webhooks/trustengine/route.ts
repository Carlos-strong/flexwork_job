import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/queue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body.event as string;
    const escrowId = body.escrowId || body.data?.escrowId as string;

    // Traitement immédiat selon l'événement
    switch (event) {
      case "escrow.created": {
        console.log(`[Webhook TE] 🔐 Escrow créé: ${escrowId}`);
        break;
      }

      case "milestone.released": {
        const milestoneId = body.data?.milestoneId as string;
        const amount = body.data?.amount as number;
        console.log(`[Webhook TE] 🔓 Milestone libéré: ${milestoneId} — ${amount}€`);
        break;
      }

      case "milestone.approved": {
        const milestoneId = body.data?.milestoneId as string;
        console.log(`[Webhook TE] ✅ Milestone approuvé: ${milestoneId}`);
        break;
      }

      case "escrow.fully_released": {
        console.log(`[Webhook TE] 💸 Escrow totalement libéré: ${escrowId}`);
        break;
      }

      case "dispute.opened": {
        const reason = body.data?.reason as string;
        console.log(`[Webhook TE] ⚠️ Litige ouvert sur ${escrowId}: ${reason}`);
        break;
      }

      case "dispute.resolved": {
        console.log(`[Webhook TE] ⚖️ Litige résolu: ${escrowId}`);
        break;
      }

      case "escrow.refunded": {
        console.log(`[Webhook TE] ↩️ Escrow remboursé: ${escrowId}`);
        break;
      }
    }

    // Toujours enqueue pour traitement asynchrone
    await enqueueJob("WEBHOOK_TRUSTENGINE", {
      event,
      escrowId: escrowId || "unknown",
      data: body.data || body,
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Erreur webhook TrustEngine" }, { status: 500 });
  }
}
