/**
 * Tests — Workflow route (intentions serveur) : persistance des jalons.
 *
 * Depuis la réarchitecture (audit) la route n'accepte plus d'état brut mais des
 * intentions authentifiées. On vérifie que :
 *   - un rejet client persiste rejectionReason + rejectedAt + revisionCount incrémenté,
 *   - une soumission prestataire persiste les preuves (proofs) et l'executionRate,
 *   - un broadcast SSE workflow_update est émis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const contractFindUnique = vi.fn();
const contractUpdate = vi.fn().mockResolvedValue({});
const milestoneUpdateCalls: any[] = [];

const txStub = {
  contract: {
    findUnique: vi.fn().mockResolvedValue({
      clientSignedAt: new Date(),
      freelancerSignedAt: new Date(),
      fullySignedAt: new Date(),
      appealOpenedAt: null,
    }),
    update: (o: any) => contractUpdate(o),
  },
  milestone: { update: (o: any) => { milestoneUpdateCalls.push(o); return Promise.resolve({}); } },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contract: { findUnique: (o: any) => contractFindUnique(o), update: (o: any) => contractUpdate(o) },
    milestone: { update: (o: any) => { milestoneUpdateCalls.push(o); return Promise.resolve({}); } },
    $transaction: async (fn: any) => fn(txStub),
  },
}));

const mockSyncStoreEmit = vi.fn();
vi.mock("@/lib/sync-store", () => ({ syncStore: { emit: (...a: any[]) => mockSyncStoreEmit(...a) } }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/contracts/[id]/workflow/route";
import { getServerSession } from "next-auth";

const CLIENT_USER = "client_1";
const FREELANCER_USER = "free_1";

function makeContract(milestoneStatus: string) {
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
        status: milestoneStatus,
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

const req = (body: unknown) =>
  new Request("http://localhost/api/contracts/c1/workflow", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
const params = { params: { id: "c1" } };

beforeEach(() => {
  vi.clearAllMocks();
  milestoneUpdateCalls.length = 0;
});

describe("POST /api/contracts/[id]/workflow — persistance (intentions)", () => {
  it("rejet client → persiste rejectionReason, rejectedAt et incrémente revisionCount", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: CLIENT_USER } } as any);
    contractFindUnique.mockResolvedValue(makeContract("IN_REVIEW")); // = SUBMITTED

    const res = await POST(req({ action: "REJECT_MILESTONE", milestoneId: "m1", rejectionReason: "Non conforme" }), params);
    expect(res.status).toBe(200);

    const m1 = milestoneUpdateCalls.find((c) => c.where.id === "m1");
    expect(m1).toBeTruthy();
    expect(m1.data).toEqual(
      expect.objectContaining({
        status: "PENDING", // IN_PROGRESS → PENDING (Prisma)
        rejectionReason: "Non conforme",
        rejectedAt: expect.any(Date),
        revisionCount: 1,
      })
    );
  });

  it("soumission prestataire → persiste proofs et executionRate", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: FREELANCER_USER } } as any);
    contractFindUnique.mockResolvedValue(makeContract("PENDING")); // NOT_STARTED → auto IN_PROGRESS → SUBMITTED

    const evidence = { photos: ["photo_01.jpg"], videos: [], documents: [], geoloc: null, autres: [] };
    const res = await POST(
      req({ action: "SUBMIT_MILESTONE", milestoneId: "m1", evidence, executionRate: 70 }),
      params
    );
    expect(res.status).toBe(200);

    const m1 = milestoneUpdateCalls.find((c) => c.where.id === "m1");
    expect(m1).toBeTruthy();
    expect(m1.data).toEqual(
      expect.objectContaining({
        status: "IN_REVIEW", // SUBMITTED → IN_REVIEW (Prisma)
        executionRate: 70,
        proofs: evidence,
      })
    );
  });

  it("broadcast SSE workflow_update lors d'un rejet", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: CLIENT_USER } } as any);
    contractFindUnique.mockResolvedValue(makeContract("IN_REVIEW"));

    await POST(req({ action: "REJECT_MILESTONE", milestoneId: "m1", rejectionReason: "Travaux non conformes" }), params);

    expect(mockSyncStoreEmit).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        type: "workflow_update",
        data: expect.objectContaining({
          contractId: "c1",
          milestoneId: "m1",
          milestoneStatus: "REJECTED",
        }),
      })
    );
  });
});
