import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/queue";
import { escrow } from "@/lib/escrow";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const eventType = body.type as string;

    // Traitement immédiat des événements critiques
    switch (eventType) {
      case "payment_intent.succeeded": {
        const paymentIntentId = body.data?.object?.id as string;
        if (paymentIntentId) {
          console.log(`[Webhook Stripe] 💰 Paiement reçu — capture ${paymentIntentId}`);
          await escrow.captureFunding(paymentIntentId);
        }
        break;
      }

      case "account.updated": {
        const accountId = body.data?.object?.id as string;
        console.log(`[Webhook Stripe] 🏦 Compte Connect mis à jour: ${accountId}`);
        break;
      }

      case "payout.paid": {
        const payoutId = body.data?.object?.id as string;
        console.log(`[Webhook Stripe] 💸 Payout effectué: ${payoutId}`);
        break;
      }
    }

    // Toujours enqueue pour traitement asynchrone + logging
    await enqueueJob("WEBHOOK_STRIPE", {
      eventType,
      eventId: body.id || body.data?.object?.id || "unknown",
      data: body.data || {},
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Erreur webhook Stripe" }, { status: 500 });
  }
}
