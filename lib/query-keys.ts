/**
 * Query key factory — centralise toutes les clés TanStack Query.
 *
 * Architecture plan5.md (section 2) :
 *   Toutes les données API → TanStack Query
 *
 * Usage :
 *   queryKeys.missions.list({ status: "OPEN" })
 *   queryKeys.missions.detail("m1")
 *   queryKeys.contracts.milestones("c1")
 */
export const queryKeys = {
  // ── Auth ─────────────────────────────────
  auth: {
    me: ["auth", "me"] as const,
  },

  // ── Missions ────────────────────────────
  missions: {
    all: ["missions"] as const,
    list: (filters?: Record<string, string>) =>
      ["missions", "list", filters] as const,
    detail: (id: string) => ["missions", id] as const,
  },

  // ── Applications / Candidatures ────────
  applications: {
    all: ["applications"] as const,
    list: (filters?: Record<string, string>) =>
      ["applications", "list", filters] as const,
    detail: (id: string) => ["applications", id] as const,
  },

  // ── Contrats ────────────────────────────
  contracts: {
    all: ["contracts"] as const,
    detail: (id: string) => ["contracts", id] as const,
    milestones: (contractId: string) =>
      ["contracts", contractId, "milestones"] as const,
  },

  // ── Offres ─────────────────────────────
  offers: {
    client: ["offers", "client"] as const,
    freelancer: ["offers", "freelancer"] as const,
    detail: (id: string) => ["offers", id] as const,
  },

  // ── Paiements ──────────────────────────
  payments: {
    byContract: (contractId: string) =>
      ["payments", "contract", contractId] as const,
  },

  // ── Messages / Conversations ───────────
  conversations: {
    all: ["conversations"] as const,
    messages: (conversationId: string) =>
      ["messages", conversationId] as const,
  },

  // ── Freelancers ────────────────────────
  freelancers: {
    search: (params: Record<string, string>) =>
      ["freelancers", "search", params] as const,
    detail: (id: string) => ["freelancers", id] as const,
  },

  // ── Profil utilisateur ─────────────────
  profile: {
    me: ["profile", "me"] as const,
  },

  // ── Catalogue / localisation ───────────
  catalog: {
    categories: ["catalog", "categories"] as const,
    services: (categorieId?: string) =>
      ["catalog", "services", categorieId] as const,
  },

  localisation: {
    pays: ["localisation", "pays"] as const,
    villes: (pays: string) => ["localisation", "villes", pays] as const,
    quartiers: (ville: string) => ["localisation", "quartiers", ville] as const,
  },
};
