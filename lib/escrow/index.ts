/**
 * Escrow Provider — Façade unifiée
 *
 * Abstraction au-dessus de TrustEngine (séquestre juridique + milestones)
 * et Stripe (paiements + Connect + capture manuelle).
 *
 * Les deux services sont utilisés en tandem :
 *   - TrustEngine gère le contrat, les milestones, les litiges
 *   - Stripe gère les flux financiers (dépôt, capture, payout)
 *
 * Usage :
 *   import { escrow } from "@/lib/escrow";
 *   const result = await escrow.create({ ... });
 */

import { trustEngineEscrow } from "./trustengine";
import { stripeEscrow } from "./stripe";
import type { TrustEngineEscrow, TrustEngineMilestone, DisputeResult } from "./trustengine";
import type { StripeEscrow, StripePayout, StripeConnectAccount } from "./stripe";

// ── Interface commune ──────────────────────────

export type EscrowProvider = "trustengine" | "stripe" | "both";

export interface EscrowCreateParams {
  contractId: string;
  missionTitle: string;
  totalAmount: number;
  currency?: string;
  clientId: string;
  freelancerId: string;
  /** Choix du prestataire escrow par le freelance */
  provider?: EscrowProvider;
  /** Compte Stripe Connect du freelance (requis si provider = stripe ou both) */
  freelancerStripeAccountId?: string;
  milestones: { title: string; amount: number }[];
}

export interface EscrowCreateResult {
  provider: EscrowProvider;
  /** ID escrow TrustEngine (null si provider = stripe) */
  trustEngineEscrowId: string | null;
  /** PaymentIntent Stripe (null si provider = trustengine) */
  stripePaymentIntentId: string | null;
  /** Secret client Stripe (pour le frontend Stripe Elements) */
  stripeClientSecret: string | null;
  /** Statut global */
  status: "pending_funding" | "funded" | "active";
}

export interface EscrowReleaseResult {
  trustEngineMilestone: TrustEngineMilestone;
  stripePayout: StripePayout | null;
}

// ── Service unifié ─────────────────────────────

export const escrow = {
  /**
   * Crée un escrow complet (TrustEngine + Stripe).
   *
   * Flow :
   * 1. TrustEngine crée l'escrow avec les milestones
   * 2. Stripe crée un PaymentIntent en mode "manual capture"
   * 3. Le client funde le PaymentIntent (côté frontend via Stripe Elements)
   * 4. Webhook Stripe "payment_intent.succeeded" → on capture
   */
  async create(params: EscrowCreateParams): Promise<EscrowCreateResult> {
    const provider = params.provider || "both";
    console.log(`\n[Escrow] 🏗️ Création escrow pour "${params.missionTitle}"`);
    console.log(`[Escrow]   → Provider: ${provider}`);
    console.log(`[Escrow]   → Montant: ${params.totalAmount} ${params.currency || "EUR"}`);

    let trustEngineEscrowId: string | null = null;
    let stripePI: { id: string; clientSecret: string | null } | null = null;

    // 1. TrustEngine : escrow contractuel + milestones + litiges
    if (provider === "trustengine" || provider === "both") {
      const teEscrow = await trustEngineEscrow.create({
        contractId: params.contractId,
        missionTitle: params.missionTitle,
        totalAmount: params.totalAmount,
        currency: params.currency,
        clientId: params.clientId,
        freelancerId: params.freelancerId,
        milestones: params.milestones,
      });
      trustEngineEscrowId = teEscrow.id;
      console.log(`[Escrow]   → TrustEngine: ${teEscrow.id}`);
    }

    // 2. Stripe : paiement + payout (via PaymentIntent capture manuelle)
    if (provider === "stripe" || provider === "both") {
      const pi = await stripeEscrow.create({
        amount: params.totalAmount,
        currency: params.currency,
        clientId: params.clientId,
        freelancerId: params.freelancerId,
        contractId: params.contractId,
        missionTitle: params.missionTitle,
      });
      stripePI = { id: pi.id, clientSecret: pi.clientSecret };
      console.log(`[Escrow]   → Stripe PI: ${pi.id}`);
    }

    console.log(`[Escrow] ✅ Escrow prêt (${provider})\n`);

    return {
      provider,
      trustEngineEscrowId,
      stripePaymentIntentId: stripePI?.id ?? null,
      stripeClientSecret: stripePI?.clientSecret ?? null,
      status: "pending_funding",
    };
  },

  /**
   * Capture le paiement Stripe (appelé après le webhook payment_intent.succeeded).
   * Les fonds sont maintenant chez Stripe, prêts à être libérés.
   */
  async captureFunding(paymentIntentId: string): Promise<StripeEscrow> {
    return stripeEscrow.capture(paymentIntentId);
  },

  /**
   * Libère un milestone — agit uniquement sur le provider choisi.
   */
  async releaseMilestone(params: {
    provider: EscrowProvider;
    trustEngineEscrowId: string | null;
    milestoneId: string;
    amount: number;
    freelancerStripeAccountId?: string;
    paymentIntentId?: string | null;
  }): Promise<EscrowReleaseResult> {
    console.log(`\n[Escrow] 🔓 Libération milestone ${params.milestoneId} — ${params.amount}€ (${params.provider})`);

    let teMilestone: TrustEngineMilestone | null = null;
    let stripePayout: StripePayout | null = null;

    if ((params.provider === "trustengine" || params.provider === "both") && params.trustEngineEscrowId) {
      teMilestone = await trustEngineEscrow.releaseMilestone(
        params.trustEngineEscrowId,
        params.milestoneId,
        params.amount
      );
    }

    if ((params.provider === "stripe" || params.provider === "both") && params.freelancerStripeAccountId && params.paymentIntentId) {
      stripePayout = await stripeEscrow.releaseMilestone(
        params.paymentIntentId,
        params.amount,
        params.freelancerStripeAccountId
      );
    }

    console.log(`[Escrow] ✅ Milestone libéré\n`);
    return {
      trustEngineMilestone: teMilestone!,
      stripePayout,
    };
  },

  /** Libère tout le solde restant sur le provider actif */
  async releaseFull(
    provider: EscrowProvider,
    trustEngineEscrowId: string | null,
    paymentIntentId?: string | null
  ): Promise<void> {
    if ((provider === "trustengine" || provider === "both") && trustEngineEscrowId) {
      await trustEngineEscrow.releaseFull(trustEngineEscrowId);
    }
    if ((provider === "stripe" || provider === "both") && paymentIntentId) {
      await stripeEscrow.capture(paymentIntentId);
    }
  },

  /** Rembourse l'escrow sur le provider actif */
  async refund(
    provider: EscrowProvider,
    trustEngineEscrowId: string | null,
    paymentIntentId?: string | null,
    reason?: string
  ): Promise<void> {
    if ((provider === "trustengine" || provider === "both") && trustEngineEscrowId) {
      await trustEngineEscrow.refund(trustEngineEscrowId, reason);
    }
    if ((provider === "stripe" || provider === "both") && paymentIntentId) {
      await stripeEscrow.refund(paymentIntentId);
    }
  },

  /** Ouvre un litige */
  async openDispute(escrowId: string, reason: string): Promise<void> {
    await trustEngineEscrow.openDispute(escrowId, reason);
  },

  /** Résout un litige */
  async resolveDispute(escrowId: string, result: DisputeResult): Promise<void> {
    await trustEngineEscrow.resolveDispute(escrowId, result);
  },

  /** Crée un compte Stripe Connect pour un freelance */
  async createConnectAccount(email: string, country?: string): Promise<StripeConnectAccount> {
    return stripeEscrow.createConnectAccount({ email, country });
  },

  /** Accès direct aux services sous-jacents (pour des cas spécifiques) */
  trustEngine: trustEngineEscrow,
  stripe: stripeEscrow,
};

// ── Re-exports ─────────────────────────────────
export type { TrustEngineEscrow, TrustEngineMilestone, DisputeResult };
export type { StripeEscrow, StripePayout, StripeConnectAccount };
