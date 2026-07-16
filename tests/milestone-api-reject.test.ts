/**
 * Tests unitaires — API REJECT_MILESTONE + SUBMIT_MILESTONE cleanup
 *
 * Couvre les actions PUT /api/contracts/[id] :
 *   - REJECT_MILESTONE : rejet motivé avec révisionCount++ et rejectedAt
 *   - SUBMIT_MILESTONE : nettoyage de rejectionReason / rejectedAt après resoumission
 *   - Validation des entrées (motif obligatoire, milestoneId requis)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ════════════════════════════════════════════════════════════════
// MOCKS
// ════════════════════════════════════════════════════════════════
const mockMilestoneUpdate = vi.fn();
const mockContractFindUnique = vi.fn();
const mockEnqueueJob = vi.fn().mockResolvedValue(undefined);
const mockSyncStoreEmit = vi.fn();
const mockAddSystemMessage = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contract: {
      findUnique: (opts: any) => mockContractFindUnique(opts),
    },
    milestone: {
      update: (opts: any) => mockMilestoneUpdate(opts),
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  enqueueJob: (...args: any[]) => mockEnqueueJob(...args) ?? Promise.resolve(undefined),
}));

vi.mock("@/lib/sync-store", () => ({
  syncStore: {
    emit: (...args: any[]) => mockSyncStoreEmit(...args),
  },
}));

vi.mock("@/lib/collaboration", () => ({
  conversations: [],
  addSystemMessage: (...args: any[]) => mockAddSystemMessage(...args),
}));

vi.mock("@/lib/mock-data", () => ({
  contracts: [],
  applications: [],
  persistMockStore: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";

const CLIENT_USER = "client_1";
const FREELANCER_USER = "free_1";

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function createMockRequest(body: Record<string, unknown>): NextRequest {
  const headers = new Headers();
  const obj = {
    json: async () => body,
    clone: () => ({ json: async () => body }),
    headers,
    method: "PUT",
  };
  return obj as unknown as NextRequest;
}

const DEFAULT_CONTRACT = {
  id: "c1",
  status: "ACTIVE",
  mission: { title: "Chantier test", client: { userId: CLIENT_USER } },
  freelancer: { userId: FREELANCER_USER },
};

function asClient() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: CLIENT_USER } } as any);
}
function asFreelancer() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: FREELANCER_USER } } as any);
}

// ════════════════════════════════════════════════════════════════
// TESTS — REJECT_MILESTONE
// ════════════════════════════════════════════════════════════════

describe("PUT /api/contracts/[id] — REJECT_MILESTONE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindUnique.mockResolvedValue(DEFAULT_CONTRACT);
    asClient();
  });

  describe("Validation des entrées", () => {
    it("retourne 400 si milestoneId est manquant", async () => {
      const { PUT } = await import("@/app/api/contracts/[id]/route");
      const req = createMockRequest({ action: "REJECT_MILESTONE", rejectionReason: "Motif" });
      const res = await PUT(req, { params: { id: "c1" } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("milestoneId");
    });

    it("retourne 400 si rejectionReason est manquant", async () => {
      const { PUT } = await import("@/app/api/contracts/[id]/route");
      const req = createMockRequest({ action: "REJECT_MILESTONE", milestoneId: "m1" });
      const res = await PUT(req, { params: { id: "c1" } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Motif");
    });
  });

  describe("Mise à jour BDD", () => {
    it("passe le statut IN_REVIEW avec revisionCount incrémenté et rejectedAt", async () => {
      mockMilestoneUpdate.mockResolvedValue({
        id: "m1",
        title: "Terrassement",
        amount: 12000,
      });

      const { PUT } = await import("@/app/api/contracts/[id]/route");
      const req = createMockRequest({
        action: "REJECT_MILESTONE",
        milestoneId: "m1",
        rejectionReason: "Non conforme à la norme NF C 15-100",
      });
      const res = await PUT(req, { params: { id: "c1" } });
      expect(res.status).toBe(200);

      // Vérifier l'appel Prisma
      expect(mockMilestoneUpdate).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: expect.objectContaining({
          status: "IN_REVIEW",
          revisionCount: { increment: 1 },
          rejectionReason: "Non conforme à la norme NF C 15-100",
          rejectedAt: expect.any(Date),
        }),
        select: { id: true, title: true, amount: true },
      });
    });

    it("émet un événement SSE milestone_update avec le statut IN_REVIEW", async () => {
      mockMilestoneUpdate.mockResolvedValue({
        id: "m1",
        title: "Terrassement",
        amount: 12000,
      });

      const { PUT } = await import("@/app/api/contracts/[id]/route");
      const req = createMockRequest({
        action: "REJECT_MILESTONE",
        milestoneId: "m1",
        rejectionReason: "Reprises à corriger",
      });
      await PUT(req, { params: { id: "c1" } });

      expect(mockSyncStoreEmit).toHaveBeenCalledWith("c1", {
        type: "milestone_update",
        data: expect.objectContaining({
          milestoneId: "m1",
          status: "IN_REVIEW",
          rejectionReason: "Reprises à corriger",
        }),
      });
    });

    it("envoie un job MILESTONE_REJECTED dans la queue", async () => {
      mockMilestoneUpdate.mockResolvedValue({
        id: "m1",
        title: "Terrassement",
        amount: 12000,
      });

      const { PUT } = await import("@/app/api/contracts/[id]/route");
      const req = createMockRequest({
        action: "REJECT_MILESTONE",
        milestoneId: "m1",
        rejectionReason: "Fuite sur le raccordement",
      });
      await PUT(req, { params: { id: "c1" } });

      expect(mockEnqueueJob).toHaveBeenCalledWith("MILESTONE_REJECTED", {
        milestoneId: "m1",
        contractId: "c1",
        title: "Terrassement",
        amount: 12000,
        reason: "Fuite sur le raccordement",
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════
// TESTS — SUBMIT_MILESTONE (nettoyage)
// ════════════════════════════════════════════════════════════════

describe("PUT /api/contracts/[id] — SUBMIT_MILESTONE (nettoyage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindUnique.mockResolvedValue(DEFAULT_CONTRACT);
    asFreelancer();
  });

  it("nettoie rejectionReason et rejectedAt lors d'une resoumission", async () => {
    mockMilestoneUpdate.mockResolvedValue({
      id: "m1",
      title: "Plomberie",
      amount: 5000,
    });

    const { PUT } = await import("@/app/api/contracts/[id]/route");
    const req = createMockRequest({
      action: "SUBMIT_MILESTONE",
      milestoneId: "m1",
    });
    const res = await PUT(req, { params: { id: "c1" } });
    expect(res.status).toBe(200);

    // Vérifier que la BDD reçoit bien le nettoyage
    expect(mockMilestoneUpdate).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: expect.objectContaining({
        status: "IN_REVIEW",
        rejectionReason: null,
        rejectedAt: null,
      }),
      select: { id: true, title: true, amount: true },
    });
  });
});

// ════════════════════════════════════════════════════════════════
// TESTS — Message d'erreur "Action non supportée"
// ════════════════════════════════════════════════════════════════

describe("PUT /api/contracts/[id] — Action inconnue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindUnique.mockResolvedValue(DEFAULT_CONTRACT);
    asClient();
  });

  it("retourne 400 avec la liste des actions supportées incluant REJECT_MILESTONE", async () => {
    const { PUT } = await import("@/app/api/contracts/[id]/route");
    const req = createMockRequest({
      action: "INVALID_ACTION",
    });
    const res = await PUT(req, { params: { id: "c1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("REJECT_MILESTONE");
    expect(body.error).toContain("SUBMIT_MILESTONE");
    expect(body.error).toContain("APPROVE_MILESTONE");
    expect(body.error).toContain("RELEASE_MILESTONE");
  });
});
