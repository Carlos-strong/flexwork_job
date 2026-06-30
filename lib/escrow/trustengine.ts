/**
 * TrustEngine Escrow Service
 *
 * API externe de séquestre (escrow) avec milestones, litiges, KYC.
 * Docs simulées — à remplacer par les vrais endpoints TrustEngine.
 *
 * Interface commune : EscrowProvider (voir index.ts)
 */

const TE_BASE = process.env.TRUSTENGINE_API_URL || "https://api.trustengine.io/v1";
const TE_API_KEY = process.env.TRUSTENGINE_API_KEY || "te_xxxxxxxx";

// ── Types ──────────────────────────────────────

export interface TrustEngineEscrow {
  id: string;
  status: "pending" | "funded" | "partially_released" | "fully_released" | "disputed" | "refunded";
  totalAmount: number;
  releasedAmount: number;
  currency: string;
  clientId: string;
  freelancerId: string;
  contractId: string;
  milestones: TrustEngineMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface TrustEngineMilestone {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "in_review" | "approved" | "released";
  releasedAt?: string;
}

export interface DisputeResult {
  resolution: "client_wins" | "freelancer_wins" | "split";
  clientAmount: number;
  freelancerAmount: number;
}

// ── API Client ─────────────────────────────────

async function teFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${TE_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TE_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`[TrustEngine] ${(err as { message?: string }).message || res.statusText}`);
  }

  return res.json();
}

// ── Service ────────────────────────────────────

export const trustEngineEscrow = {
  /**
   * Crée un escrow pour un contrat.
   * Le client devra ensuite le funder via Stripe.
   */
  async create(params: {
    contractId: string;
    missionTitle: string;
    totalAmount: number;
    currency?: string;
    clientId: string;
    freelancerId: string;
    milestones: { title: string; amount: number }[];
  }): Promise<TrustEngineEscrow> {
    console.log(`[TrustEngine] 🔐 Création escrow pour "${params.missionTitle}"`);
    console.log(`[TrustEngine]   → Montant: ${params.totalAmount} ${params.currency || "EUR"}`);
    console.log(`[TrustEngine]   → Milestones: ${params.milestones.length}`);

    try {
      const result = await teFetch("/escrows", {
        method: "POST",
        body: JSON.stringify({
          contract_id: params.contractId,
          title: params.missionTitle,
          total_amount: params.totalAmount,
          currency: params.currency || "EUR",
          client_id: params.clientId,
          freelancer_id: params.freelancerId,
          milestones: params.milestones.map((m) => ({
            title: m.title,
            amount: m.amount,
          })),
        }),
      });

      console.log(`[TrustEngine] ✅ Escrow créé: ${(result as TrustEngineEscrow).id}`);
      return result as TrustEngineEscrow;
    } catch {
      // Fallback simulé si l'API est indisponible
      console.log("[TrustEngine] ⚠️ Mode simulé activé");
      return {
        id: `te-escrow-${Date.now()}`,
        status: "pending",
        totalAmount: params.totalAmount,
        releasedAmount: 0,
        currency: params.currency || "EUR",
        clientId: params.clientId,
        freelancerId: params.freelancerId,
        contractId: params.contractId,
        milestones: params.milestones.map((m, i) => ({
          id: `te-milestone-${Date.now()}-${i}`,
          title: m.title,
          amount: m.amount,
          status: "pending" as const,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  /** Libère un milestone vers le freelance */
  async releaseMilestone(
    escrowId: string,
    milestoneId: string,
    amount: number
  ): Promise<TrustEngineMilestone> {
    console.log(`[TrustEngine] 🔓 Libération milestone ${milestoneId} — ${amount}€`);

    try {
      const result = await teFetch(`/escrows/${escrowId}/milestones/${milestoneId}/release`, {
        method: "POST",
      });
      return result as TrustEngineMilestone;
    } catch {
      return {
        id: milestoneId,
        title: "Milestone",
        amount,
        status: "released",
        releasedAt: new Date().toISOString(),
      };
    }
  },

  /** Libère tout le solde restant */
  async releaseFull(escrowId: string): Promise<TrustEngineEscrow> {
    console.log(`[TrustEngine] 💸 Libération totale de l'escrow ${escrowId}`);

    try {
      const result = await teFetch(`/escrows/${escrowId}/release`, { method: "POST" });
      return result as TrustEngineEscrow;
    } catch {
      return {
        id: escrowId,
        status: "fully_released",
        totalAmount: 0,
        releasedAmount: 0,
        currency: "EUR",
        clientId: "",
        freelancerId: "",
        contractId: "",
        milestones: [],
        createdAt: "",
        updatedAt: new Date().toISOString(),
      };
    }
  },

  /** Rembourse l'escrow au client (annulation/litige) */
  async refund(escrowId: string, reason?: string): Promise<TrustEngineEscrow> {
    console.log(`[TrustEngine] ↩️ Remboursement escrow ${escrowId} — ${reason || "Sans raison"}`);

    try {
      const result = await teFetch(`/escrows/${escrowId}/refund`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return result as TrustEngineEscrow;
    } catch {
      return {
        id: escrowId,
        status: "refunded",
        totalAmount: 0,
        releasedAmount: 0,
        currency: "EUR",
        clientId: "",
        freelancerId: "",
        contractId: "",
        milestones: [],
        createdAt: "",
        updatedAt: new Date().toISOString(),
      };
    }
  },

  /** Ouvre un litige */
  async openDispute(escrowId: string, reason: string): Promise<void> {
    console.log(`[TrustEngine] ⚠️ Litige ouvert sur ${escrowId}: ${reason}`);

    try {
      await teFetch(`/escrows/${escrowId}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    } catch {
      console.log("[TrustEngine] ⚠️ Litige enregistré (mode simulé)");
    }
  },

  /** Résout un litige */
  async resolveDispute(escrowId: string, result: DisputeResult): Promise<void> {
    console.log(`[TrustEngine] ⚖️ Résolution litige ${escrowId}: ${result.resolution}`);

    try {
      await teFetch(`/escrows/${escrowId}/dispute/resolve`, {
        method: "POST",
        body: JSON.stringify(result),
      });
    } catch {
      console.log("[TrustEngine] ⚠️ Résolution enregistrée (mode simulé)");
    }
  },

  /** Récupère le statut d'un escrow */
  async getStatus(escrowId: string): Promise<TrustEngineEscrow> {
    try {
      return (await teFetch(`/escrows/${escrowId}`)) as TrustEngineEscrow;
    } catch {
      return {
        id: escrowId,
        status: "funded",
        totalAmount: 0,
        releasedAmount: 0,
        currency: "EUR",
        clientId: "",
        freelancerId: "",
        contractId: "",
        milestones: [],
        createdAt: "",
        updatedAt: "",
      };
    }
  },
};
