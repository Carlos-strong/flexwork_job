import { describe, it, expect, beforeEach } from "vitest";
import {
  logApplicationAudit,
  scheduleInterview,
  completeInterview,
  createOffer,
  acceptOffer,
  applicationAudits,
  candidateInterviews,
  contractOffers,
} from "@/lib/recruitment";

beforeEach(() => {
  applicationAudits.length = 0;
  candidateInterviews.length = 0;
  contractOffers.length = 0;
});

describe("lib/recruitment.ts — audit + interviews + offres", () => {
  it("T016 — logApplicationAudit crée une entrée", () => {
    const entry = logApplicationAudit({
      applicationId: "app-1",
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      actorId: "client-1",
      actorName: "Client",
      reason: "Examen initial",
    });
    expect(entry.id).toBeDefined();
    expect(entry.fromStatus).toBe("SUBMITTED");
    expect(entry.toStatus).toBe("UNDER_REVIEW");
    expect(entry.reason).toBe("Examen initial");
    expect(applicationAudits).toHaveLength(1);
  });

  it("T017 — scheduleInterview crée un entretien", () => {
    const interview = scheduleInterview({
      applicationId: "app-1",
      meetingUrl: "https://meet.google.com/abc",
      scheduledAt: new Date().toISOString(),
      duration: 45,
    });
    expect(interview.status).toBe("scheduled");
    expect(interview.duration).toBe(45);
    expect(candidateInterviews).toHaveLength(1);
  });

  it("T018 — completeInterview passe en completed", () => {
    const interview = scheduleInterview({
      applicationId: "app-1",
      meetingUrl: "https://meet.google.com/abc",
      scheduledAt: new Date().toISOString(),
    });
    completeInterview(interview.id, "Entretien positif");
    expect(interview.status).toBe("completed");
    expect(interview.notes).toBe("Entretien positif");
  });

  it("T019 — createOffer versionne correctement", () => {
    const o1 = createOffer({ applicationId: "app-1", contractId: "c-1", amount: 5000, deadline: "2026-07-01", proposedBy: "CLIENT" });
    expect(o1.version).toBe(1);
    expect(o1.status).toBe("pending");

    const o2 = createOffer({ applicationId: "app-1", contractId: "c-1", amount: 5500, deadline: "2026-07-01", proposedBy: "FREELANCER" });
    expect(o2.version).toBe(2);
    expect(o1.status).toBe("rejected"); // offre précédente rejetée
    expect(contractOffers).toHaveLength(2);
  });

  it("T020 — acceptOffer accepte une offre et rejette les autres", () => {
    const o1 = createOffer({ applicationId: "app-2", contractId: "c-2", amount: 3000, deadline: "2026-07-01", proposedBy: "CLIENT" });
    const o2 = createOffer({ applicationId: "app-2", contractId: "c-2", amount: 3200, deadline: "2026-07-01", proposedBy: "FREELANCER" });
    acceptOffer(o1.id);
    expect(o1.status).toBe("accepted");
    expect(o2.status).toBe("rejected");
  });
});
