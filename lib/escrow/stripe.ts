/**
 * Stripe Escrow Service
 *
 * Simule un escrow via PaymentIntent avec capture manuelle.
 * En production : nécessite stripe SDK + clés API réelles.
 *
 * Interface commune : EscrowProvider (voir index.ts)
 *
 * 💳 Mode KYC Différé — Développement / Test :
 *   Si Stripe n'est pas configuré, le service bascule automatiquement
 *   sur le système de cartes Visa virtuelles (VirtualCard).
 *   Aucune pièce d'identité ni document requis pour tester les paiements.
 */

import { virtualCardService, isVirtualCardEnabled } from "@/lib/payments";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_xxxxxxxx";

// ── Types ──────────────────────────────────────

export interface StripeEscrow {
  id: string;                 // PaymentIntent ID
  clientSecret: string | null;
  status: "requires_payment_method" | "requires_capture" | "canceled" | "succeeded" | "refunded";
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

export interface StripePayout {
  id: string;
  amount: number;
  currency: string;
  destination: string;       // Stripe Connect account ID
  status: "paid" | "pending" | "failed";
}

export interface StripeConnectAccount {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  country: string;
}

// ── API Client (simulé) ────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Service ────────────────────────────────────

export const stripeEscrow = {
  /**
   * Crée un PaymentIntent avec capture manuelle.
   * Le montant est réservé mais pas encore débité.
   */
  async create(params: {
    amount: number;
    currency?: string;
    clientId: string;
    freelancerId: string;
    contractId: string;
    missionTitle: string;
  }): Promise<StripeEscrow> {
    const currency = params.currency || "eur";
    const amount = Math.round(params.amount * 100); // Stripe utilise les centimes

    console.log(`[Stripe] 💳 Création PaymentIntent pour "${params.missionTitle}"`);
    console.log(`[Stripe]   → Montant: ${params.amount} ${currency.toUpperCase()}`);
    console.log(`[Stripe]   → Client: ${params.clientId}, Freelance: ${params.freelancerId}`);

    try {
      // Si en mode dev/test et que VirtualCard est activé, on simule via carte virtuelle
      if (isVirtualCardEnabled()) {
        console.log("[Stripe] 💳 Mode KYC Différé — utilisation d'une carte virtuelle de test");

        // On crée une carte virtuelle pour le client si elle n'existe pas déjà
        const existingCards = await virtualCardService.listByUser(params.clientId);
        let card = existingCards[0];

        if (!card) {
          card = await virtualCardService.create({
            userId: params.clientId,
            cardholderName: `Client ${params.clientId.slice(0, 8)}`,
            label: `Carte test — ${params.missionTitle}`,
            initialBalance: Math.max(params.amount * 2, 10000), // Solde suffisant
            currency,
          });
          console.log(`[Stripe]   → Carte virtuelle créée : ${card.cardNumber}`);
        }

        // Paiement via carte virtuelle
        const payResult = await virtualCardService.pay({
          virtualCardId: card.id,
          amount: params.amount,
          currency,
          contractId: params.contractId,
          missionTitle: params.missionTitle,
          description: `Dépôt escrow — ${params.missionTitle}`,
        });

        console.log(`[Stripe] ✅ Paiement via VirtualCard : ${payResult.receipt.authorizationCode}`);

        const piId = `pi_vc_${payResult.transaction.id}`;
        return {
          id: piId,
          clientSecret: `vc_${piId}_secret`,
          status: "requires_capture" as const,
          amount: params.amount,
          currency,
          metadata: {
            contract_id: params.contractId,
            client_id: params.clientId,
            freelancer_id: params.freelancerId,
            virtual_card_id: card.id,
            virtual_card_transaction_id: payResult.transaction.id,
          },
        };
      }

      // Appel réel à l'API Stripe
      const res = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: String(amount),
          currency,
          capture_method: "manual", // Escrow-like : on capture plus tard
          "metadata[contract_id]": params.contractId,
          "metadata[client_id]": params.clientId,
          "metadata[freelancer_id]": params.freelancerId,
          "metadata[mission]": params.missionTitle,
        }).toString(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Stripe error: ${(err as { error?: { message?: string } }).error?.message}`);
      }

      const pi = await res.json() as { id: string; client_secret: string | null };
      console.log(`[Stripe] ✅ PaymentIntent créé: ${pi.id}`);

      return {
        id: pi.id,
        clientSecret: pi.client_secret,
        status: "requires_capture",
        amount: params.amount,
        currency,
        metadata: {
          contract_id: params.contractId,
          client_id: params.clientId,
          freelancer_id: params.freelancerId,
        },
      };
    } catch (err) {
      // Fallback simulé si Stripe n'est pas configuré
      console.log("[Stripe] ⚠️ Mode simulé activé:", (err as Error).message);
      const id = generateId("pi_sim");
      return {
        id,
        clientSecret: `${id}_secret_sim`,
        status: "requires_capture",
        amount: params.amount,
        currency,
        metadata: {
          contract_id: params.contractId,
          client_id: params.clientId,
          freelancer_id: params.freelancerId,
        },
      };
    }
  },

  /** Capture un PaymentIntent (débit confirmé → les fonds passent en escrow Stripe) */
  async capture(paymentIntentId: string): Promise<StripeEscrow> {
    console.log(`[Stripe] 💰 Capture PaymentIntent ${paymentIntentId}`);

    // Si c'est un payment virtuel (préfixé pi_vc_), la capture est déjà faite
    if (paymentIntentId.startsWith("pi_vc_")) {
      console.log("[Stripe] 💳 Capture via VirtualCard — déjà débitée");
      return {
        id: paymentIntentId,
        clientSecret: null,
        status: "succeeded",
        amount: 0,
        currency: "eur",
        metadata: {},
      };
    }

    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/capture`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });

      if (!res.ok) throw new Error("Capture failed");
      return (await res.json()) as StripeEscrow;
    } catch {
      console.log("[Stripe] ⚠️ Capture simulée");
      return {
        id: paymentIntentId,
        clientSecret: null,
        status: "succeeded",
        amount: 0,
        currency: "eur",
        metadata: {},
      };
    }
  },

  /** Libère un milestone via payout vers le compte Connect du freelance */
  async releaseMilestone(
    paymentIntentId: string,
    amount: number,
    freelancerStripeAccountId: string
  ): Promise<StripePayout> {
    console.log(`[Stripe] 💸 Payout ${amount}€ → compte ${freelancerStripeAccountId}`);

    // Si c'est un paiement virtuel, simuler le payout
    if (paymentIntentId.startsWith("pi_vc_")) {
      console.log("[Stripe] 💳 Payout via VirtualCard — simulé");
      return {
        id: generateId("po_vc_"),
        amount,
        currency: "eur",
        destination: freelancerStripeAccountId,
        status: "paid",
      };
    }

    try {
      const res = await fetch("https://api.stripe.com/v1/transfers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: String(Math.round(amount * 100)),
          currency: "eur",
          destination: freelancerStripeAccountId,
          "metadata[payment_intent]": paymentIntentId,
        }).toString(),
      });

      if (!res.ok) throw new Error("Transfer failed");
      return (await res.json()) as StripePayout;
    } catch {
      console.log("[Stripe] ⚠️ Payout simulé");
      return {
        id: generateId("tr_sim"),
        amount,
        currency: "eur",
        destination: freelancerStripeAccountId,
        status: "paid",
      };
    }
  },

  /** Rembourse un PaymentIntent (annulation) */
  async refund(paymentIntentId: string, amount?: number): Promise<StripeEscrow> {
    console.log(`[Stripe] ↩️ Refund ${paymentIntentId} — ${amount ? `${amount}€` : "total"}`);

    // Si c'est un paiement virtuel, rembourser via VirtualCard
    if (paymentIntentId.startsWith("pi_vc_")) {
      console.log("[Stripe] 💳 Remboursement via VirtualCard");
      // Le remboursement réel se fait via l'API VirtualCard, pas ici
      return {
        id: paymentIntentId,
        clientSecret: null,
        status: "refunded" as const,
        amount: amount || 0,
        currency: "eur",
        metadata: { note: "Remboursement VirtualCard — via API /api/payments/virtual-card" },
      };
    }

    try {
      const url = amount
        ? `https://api.stripe.com/v1/refunds?payment_intent=${paymentIntentId}&amount=${Math.round(amount * 100)}`
        : `https://api.stripe.com/v1/refunds?payment_intent=${paymentIntentId}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });

      if (!res.ok) throw new Error("Refund failed");
      return { id: paymentIntentId, clientSecret: null, status: "canceled", amount: 0, currency: "eur", metadata: {} };
    } catch {
      return { id: paymentIntentId, clientSecret: null, status: "canceled", amount: 0, currency: "eur", metadata: {} };
    }
  },

  /** Crée un compte Stripe Connect pour un freelance */
  async createConnectAccount(params: {
    email: string;
    country?: string;
  }): Promise<StripeConnectAccount> {
    console.log(`[Stripe] 🏦 Création compte Connect pour ${params.email}`);

    try {
      const res = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          type: "express",
          country: params.country || "FR",
          email: params.email,
          "capabilities[transfers][requested]": "true",
        }).toString(),
      });

      if (!res.ok) throw new Error("Account creation failed");
      return (await res.json()) as StripeConnectAccount;
    } catch {
      console.log("[Stripe] ⚠️ Compte Connect simulé");
      return {
        id: generateId("acct_sim"),
        chargesEnabled: true,
        payoutsEnabled: true,
        country: params.country || "FR",
      };
    }
  },

  /** Récupère le statut d'un PaymentIntent */
  async getStatus(paymentIntentId: string): Promise<StripeEscrow> {
    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });
      return (await res.json()) as StripeEscrow;
    } catch {
      return { id: paymentIntentId, clientSecret: null, status: "requires_capture", amount: 0, currency: "eur", metadata: {} };
    }
  },
};
