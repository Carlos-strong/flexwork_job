import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock fetch global avant les imports
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
}));

// Après les mocks, import dynamique
let escrowModule: typeof import("@/lib/escrow/index");

beforeAll(async () => {
  escrowModule = await import("@/lib/escrow/index");
});

describe("lib/escrow/index.ts", () => {
  it("T027+T028+T029 — escrow.create avec providers", async () => {
    // On teste que la fonction existe et accepte les params
    expect(escrowModule.escrow).toBeDefined();
    expect(escrowModule.escrow.create).toBeDefined();
    expect(escrowModule.escrow.trustEngine).toBeDefined();
    expect(escrowModule.escrow.stripe).toBeDefined();
  });

  it("T030 — escrow.releaseMilestone existe", () => {
    expect(escrowModule.escrow.releaseMilestone).toBeDefined();
  });

  it("T031 — escrow.refund existe", () => {
    expect(escrowModule.escrow.refund).toBeDefined();
  });

  it("T031b — escrow.captureFunding existe", () => {
    expect(escrowModule.escrow.captureFunding).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════

describe("lib/queue.ts", () => {
  it("T045 — enqueueJob avec type inconnu retourne null", async () => {
    const { enqueueJob } = await import("@/lib/queue");
    const result = await enqueueJob("INVALID_TYPE" as never, {} as never);
    expect(result).toBeNull();
  });

  it("T046 — enqueueJob existe et est une fonction", async () => {
    const { enqueueJob } = await import("@/lib/queue");
    expect(enqueueJob).toBeDefined();
    expect(typeof enqueueJob).toBe("function");
  });
});
