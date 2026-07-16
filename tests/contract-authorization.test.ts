import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════

const contractFindUnique = vi.fn();
const contractUpdate = vi.fn();
const milestoneUpdate = vi.fn();

// tx interne utilisé par persistContext (jamais atteint sur les rejets d'accès)
const txStub = {
  contract: {
    findUnique: vi.fn().mockResolvedValue({
      clientSignedAt: null,
      freelancerSignedAt: null,
      fullySignedAt: null,
      appealOpenedAt: null,
    }),
    update: contractUpdate,
  },
  milestone: { update: milestoneUpdate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contract: {
      findUnique: (o: any) => contractFindUnique(o),
      update: (o: any) => contractUpdate(o),
    },
    milestone: { update: (o: any) => milestoneUpdate(o) },
    $transaction: async (fn: any) => fn(txStub),
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/sync-store", () => ({ syncStore: { emit: vi.fn() } }));

import { POST as workflowPost, GET as workflowGet } from "@/app/api/contracts/[id]/workflow/route";
import { getServerSession } from "next-auth";

// ── Fabrique d'un contrat de test (superset couvrant tous les select/include) ──
const CLIENT_USER = "client_1";
const FREELANCER_USER = "free_1";

function makeContract() {
  return {
    id: "c1",
    status: "ACTIVE",
    workflowPhase: "CONTRACT_ACTIVE",
    disputeStep: null,
    clientSignedAt: new Date(),
    freelancerSignedAt: new Date(),
    fullySignedAt: new Date(),
    appealOpenedAt: null,
    freelancer: { userId: FREELANCER_USER },
    mission: { client: { userId: CLIENT_USER } },
    milestones: [
      {
        id: "m1",
        title: "Jalon 1",
        amount: 100,
        executionRate: 100,
        status: "IN_REVIEW", // = SUBMITTED côté workflow
        updatedAt: new Date(),
        completedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        proofs: null,
        revisionCount: 0,
      },
    ],
  };
}

function asSession(userId: string | null) {
  vi.mocked(getServerSession).mockResolvedValue(userId ? ({ user: { id: userId } } as any) : null);
}

const params = { params: { id: "c1" } };
const req = (body: unknown) =>
  new Request("http://localhost/api/contracts/c1/workflow", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  contractFindUnique.mockResolvedValue(makeContract());
});

// ═══════════════════════════════════════════════
// Authentification
// ═══════════════════════════════════════════════

describe("POST /api/contracts/[id]/workflow — authentification", () => {
  it("A001 — refuse un appel sans session (403)", async () => {
    asSession(null);
    const res = await workflowPost(req({ action: "VALIDATE_MILESTONE", milestoneId: "m1" }), params);
    expect(res.status).toBe(403);
    expect(contractUpdate).not.toHaveBeenCalled();
    expect(milestoneUpdate).not.toHaveBeenCalled();
  });

  it("A002 — refuse un utilisateur qui n'est pas partie au contrat (403)", async () => {
    asSession("intrus_999");
    const res = await workflowPost(req({ action: "VALIDATE_MILESTONE", milestoneId: "m1" }), params);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("partie");
    expect(milestoneUpdate).not.toHaveBeenCalled();
  });

  it("A003 — renvoie 404 sur un contrat inexistant", async () => {
    asSession(CLIENT_USER);
    contractFindUnique.mockResolvedValue(null);
    const res = await workflowPost(req({ action: "VALIDATE_MILESTONE", milestoneId: "m1" }), params);
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════
// Autorisation par rôle
// ═══════════════════════════════════════════════

describe("POST /api/contracts/[id]/workflow — rôle", () => {
  it("R001 — le freelance ne peut pas valider un jalon (403)", async () => {
    asSession(FREELANCER_USER);
    const res = await workflowPost(req({ action: "VALIDATE_MILESTONE", milestoneId: "m1" }), params);
    expect(res.status).toBe(403);
    expect(milestoneUpdate).not.toHaveBeenCalled();
  });

  it("R002 — le client ne peut pas soumettre un jalon (403)", async () => {
    asSession(CLIENT_USER);
    const res = await workflowPost(req({ action: "SUBMIT_MILESTONE", milestoneId: "m1" }), params);
    expect(res.status).toBe(403);
    expect(milestoneUpdate).not.toHaveBeenCalled();
  });

  it("R003 — le client ne peut pas rejeter sans motif (400)", async () => {
    asSession(CLIENT_USER);
    const res = await workflowPost(req({ action: "REJECT_MILESTONE", milestoneId: "m1", rejectionReason: "" }), params);
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════
// Chemin nominal (revalidation métier serveur)
// ═══════════════════════════════════════════════

describe("POST /api/contracts/[id]/workflow — chemin nominal", () => {
  it("V001 — le client valide un jalon soumis → persistance", async () => {
    asSession(CLIENT_USER);
    const res = await workflowPost(req({ action: "VALIDATE_MILESTONE", milestoneId: "m1" }), params);
    expect(res.status).toBe(200);
    // La transition est persistée via la transaction (contract + milestone).
    expect(contractUpdate).toHaveBeenCalled();
    expect(milestoneUpdate).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// GET (lecture du contexte)
// ═══════════════════════════════════════════════

describe("GET /api/contracts/[id]/workflow", () => {
  it("G001 — refuse un tiers (403)", async () => {
    asSession("intrus_999");
    const res = await workflowGet(new Request("http://localhost/api/contracts/c1/workflow") as any, params);
    expect(res.status).toBe(403);
  });

  it("G002 — renvoie le contexte à une partie du contrat", async () => {
    asSession(FREELANCER_USER);
    const res = await workflowGet(new Request("http://localhost/api/contracts/c1/workflow") as any, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.context.contractId).toBe("c1");
    expect(body.role).toBe("freelancer");
  });
});
