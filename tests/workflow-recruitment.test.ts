import { describe, it, expect } from "vitest";
import {
  canTransitionApplication,
  isInterviewStep,
  isNegotiationStep,
  APPLICATION_STATUS_LABELS,
  VALID_APPLICATION_TRANSITIONS,
} from "@/lib/recruitment";
import {
  canTransition as canTransitionMission,
  nextStep as nextMissionStep,
  isAutoTransition,
  qualifyMission,
} from "@/lib/workflow";

// ═══════════════════════════════════════════════
// WORKFLOW
// ═══════════════════════════════════════════════

describe("lib/workflow.ts", () => {
  it("T001 — DRAFT → PUBLISHED est valide", () => {
    expect(canTransitionMission("DRAFT", "PUBLISHED")).toBe(true);
  });

  it("T002 — PUBLISHED → DRAFT est invalide", () => {
    expect(canTransitionMission("PUBLISHED", "DRAFT")).toBe(false);
  });

  it("T003 — PAID → CANCELLED est invalide", () => {
    expect(canTransitionMission("PAID", "CANCELLED")).toBe(false);
  });

  it("T004 — nextStep(DRAFT) → PUBLISHED", () => {
    expect(nextMissionStep("DRAFT")).toBe("PUBLISHED");
  });

  it("T005 — nextStep(PAID) → null", () => {
    expect(nextMissionStep("PAID")).toBeNull();
  });

  it("T006 — PUBLISHED→PROPOSALS_RECEIVED est auto", () => {
    expect(isAutoTransition("PUBLISHED", "PROPOSALS_RECEIVED")).toBe(true);
  });

  it("T007 — Mission parfaite → score 100", () => {
    const result = qualifyMission({
      title: "Développeur React Senior",
      description: "Nous recherchons un développeur React expérimenté pour construire un dashboard analytics complet avec Next.js.",
      budget: 5000,
      skills: ["React", "Next.js", "TypeScript"],
    });
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("T008 — Mission mal décrite → score < 50", () => {
    const result = qualifyMission({
      title: "Dev",
      description: "Court",
      budget: 50,
      skills: [],
    });
    expect(result.score).toBeLessThan(50);
    expect(result.passed).toBe(false);
  });

  it("T009 — Suggestions de compétences manquantes", () => {
    const result = qualifyMission({
      title: "Développeur Frontend Senior",
      description: "Nous avons besoin de compétences en React et design pour une application mobile.",
      budget: 6000,
      skills: ["React"],
    });
    expect(result.suggestedSkills.length).toBeGreaterThan(0);
  });

  it("T010 — Suggestion budget pour poste senior", () => {
    const result = qualifyMission({
      title: "Architecte Logiciel Senior",
      description: "Recherche un architecte pour superviser la refonte complète de notre SI.",
      budget: 3000,
      skills: ["Architecture", "Cloud"],
    });
    expect(result.suggestedBudget).toBe(5000);
  });
});

// ═══════════════════════════════════════════════
// RECRUITMENT
// ═══════════════════════════════════════════════

describe("lib/recruitment.ts", () => {
  it("T011 — SUBMITTED → UNDER_REVIEW est valide", () => {
    expect(canTransitionApplication("SUBMITTED", "UNDER_REVIEW")).toBe(true);
  });

  it("T012 — SUBMITTED → SELECTED est invalide", () => {
    expect(canTransitionApplication("SUBMITTED", "SELECTED")).toBe(false);
  });

  it("T013 — REJECTED → SUBMITTED est invalide (terminal)", () => {
    expect(canTransitionApplication("REJECTED", "SUBMITTED")).toBe(false);
  });

  it("T014 — INTERVIEW_PENDING est une étape d'entretien", () => {
    expect(isInterviewStep("INTERVIEW_PENDING")).toBe(true);
    expect(isInterviewStep("SUBMITTED")).toBe(false);
  });

  it("T015 — CONTRACT_PENDING est une étape de négociation", () => {
    expect(isNegotiationStep("CONTRACT_PENDING")).toBe(true);
    expect(isNegotiationStep("SUBMITTED")).toBe(false);
  });

  it("T016 — Tous les statuts ont des transitions valides", () => {
    for (const [status, transitions] of Object.entries(VALID_APPLICATION_TRANSITIONS)) {
      for (const to of transitions) {
        expect(canTransitionApplication(status as never, to)).toBe(true);
      }
    }
  });

  it("T017 — Tous les statuts ont un label", () => {
    for (const key of Object.keys(VALID_APPLICATION_TRANSITIONS)) {
      expect(APPLICATION_STATUS_LABELS[key as keyof typeof APPLICATION_STATUS_LABELS]).toBeDefined();
      expect(APPLICATION_STATUS_LABELS[key as keyof typeof APPLICATION_STATUS_LABELS].length).toBeGreaterThan(0);
    }
  });

  it("T018 — REJECTED est terminal (aucune transition sortante)", () => {
    expect(VALID_APPLICATION_TRANSITIONS.REJECTED).toEqual([]);
  });

  it("T019 — ACTIVE est terminal", () => {
    expect(VALID_APPLICATION_TRANSITIONS.ACTIVE).toEqual([]);
  });

  it("T020 — SHORTLISTED peut aller vers INTERVIEW_PENDING ou SELECTED", () => {
    const t = VALID_APPLICATION_TRANSITIONS.SHORTLISTED;
    expect(t).toContain("INTERVIEW_PENDING");
    expect(t).toContain("SELECTED");
  });
});
