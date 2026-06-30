import { describe, it, expect, afterAll } from "vitest";
import { enqueueJob, closeAllQueues } from "@/lib/queue";

describe("lib/queue.ts", () => {
  it("T045 — enqueueJob avec type valide retourne un job", async () => {
    const job = await enqueueJob("NOTIFICATION_EMAIL", {
      to: "test@test.com",
      subject: "Test",
      template: "welcome",
      data: { name: "Test" },
    });
    expect(job).toBeDefined();
    expect(job?.id).toBeDefined();
  });

  it("T046 — enqueueJob avec type inconnu retourne null", async () => {
    // @ts-expect-error - test volontaire d'un type invalide
    const job = await enqueueJob("INVALID_TYPE", {} as never);
    expect(job).toBeNull();
  });

  // Nettoyage
  afterAll(async () => {
    await closeAllQueues();
  });
});
