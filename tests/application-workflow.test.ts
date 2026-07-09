import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getNextStates,
  validateTransition,
  canPerformAction,
  validateOffer,
  VALID_TRANSITIONS,
  APPLICATION_STATUS_LABELS,
} from "@/lib/validations/application-workflow";

// ═══════════════════════════════════════════════
// STATE MACHINE - TRANSITIONS
// ═══════════════════════════════════════════════

describe("application-workflow — transitions", () => {
  it("T001 — UNREAD → READ est valide", () => {
    expect(isValidTransition("UNREAD", "READ")).toBe(true);
  });

  it("T002 — UNREAD → SHORTLISTED est valide", () => {
    expect(isValidTransition("UNREAD", "SHORTLISTED")).toBe(true);
  });

  it("T003 — UNREAD → DISCUSSION est invalide", () => {
    expect(isValidTransition("UNREAD", "DISCUSSION")).toBe(false);
  });

  it("T004 — SHORTLISTED → DISCUSSION est valide", () => {
    expect(isValidTransition("SHORTLISTED", "DISCUSSION")).toBe(true);
  });

  it("T005 — DISCUSSION → INTERVIEW est valide", () => {
    expect(isValidTransition("DISCUSSION", "INTERVIEW")).toBe(true);
  });

  it("T006 — INTERVIEW → OFFER_SENT est valide", () => {
    expect(isValidTransition("INTERVIEW", "OFFER_SENT")).toBe(true);
  });

  it("T007 — OFFER_SENT → OFFER_ACCEPTED est valide", () => {
    expect(isValidTransition("OFFER_SENT", "OFFER_ACCEPTED")).toBe(true);
  });

  it("T008 — OFFER_SENT → OFFER_DECLINED est valide", () => {
    expect(isValidTransition("OFFER_SENT", "OFFER_DECLINED")).toBe(true);
  });

  it("T009 — ACCEPTED → SHORTLISTED est invalide (terminal)", () => {
    expect(isValidTransition("ACCEPTED", "SHORTLISTED")).toBe(false);
  });

  it("T010 — REJECTED → READ est invalide (terminal)", () => {
    expect(isValidTransition("REJECTED", "READ")).toBe(false);
  });

  it("T011 — ARCHIVED → SHORTLISTED est valide (récupération)", () => {
    expect(isValidTransition("ARCHIVED", "SHORTLISTED")).toBe(true);
  });

  it("T012 — WITHDRAWN → SHORTLISTED est valide (récupération)", () => {
    expect(isValidTransition("WITHDRAWN", "SHORTLISTED")).toBe(true);
  });

  it("T013 — getNextStates retourne transitions valides depuis DISCUSSION", () => {
    const next = getNextStates("DISCUSSION");
    expect(next).toContain("INTERVIEW");
    expect(next).toContain("OFFER_SENT");
    expect(next).toContain("ARCHIVED");
    expect(next).not.toContain("UNREAD");
  });

  it("T014 — getNextStates retourne [] pour ACCEPTED (terminal)", () => {
    expect(getNextStates("ACCEPTED")).toEqual([]);
  });

  it("T015 — getNextStates retourne [] pour REJECTED (terminal)", () => {
    expect(getNextStates("REJECTED")).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// VALIDATION TRANSITIONS
// ═══════════════════════════════════════════════

describe("application-workflow — validateTransition", () => {
  it("V001 — transition valide retourne valid=true", () => {
    const result = validateTransition("UNREAD", "READ");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("V002 — transition invalide retourne valid=false avec erreur", () => {
    const result = validateTransition("ACCEPTED", "UNREAD");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("V003 — REJECTED sans raison retourne erreur", () => {
    const result = validateTransition("UNREAD", "REJECTED");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("motif"))).toBe(true);
  });

  it("V004 — REJECTED avec raison retourne valid=true", () => {
    const result = validateTransition("UNREAD", "REJECTED", "Ne correspond pas");
    expect(result.valid).toBe(true);
  });

  it("V005 — ARCHIVED sans raison retourne erreur", () => {
    const result = validateTransition("READ", "ARCHIVED");
    expect(result.valid).toBe(false);
  });

  it("V006 — ARCHIVED avec raison retourne valid=true", () => {
    const result = validateTransition("READ", "ARCHIVED", "Profil inadapté");
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// PERMISSIONS PAR RÔLE
// ═══════════════════════════════════════════════

describe("application-workflow — canPerformAction", () => {
  it("P001 — CLIENT peut shortlister depuis UNREAD", () => {
    const result = canPerformAction("shortlist", "CLIENT", "UNREAD");
    expect(result.allowed).toBe(true);
  });

  it("P002 — FREELANCER ne peut pas shortlister", () => {
    const result = canPerformAction("shortlist", "FREELANCER", "UNREAD");
    expect(result.allowed).toBe(false);
  });

  it("P003 — ADMIN ne peut pas shortlister (non-CLIENT)", () => {
    const result = canPerformAction("shortlist", "ADMIN", "UNREAD");
    expect(result.allowed).toBe(false);
  });

  it("P004 — CLIENT peut voir dans tous les statuts", () => {
    for (const status of Object.keys(VALID_TRANSITIONS)) {
      const result = canPerformAction("view", "CLIENT", status as any);
      expect(result.allowed).toBe(true);
    }
  });

  it("P005 — CLIENT peut envoyer offre depuis DISCUSSION", () => {
    const result = canPerformAction("sendOffer", "CLIENT", "DISCUSSION");
    expect(result.allowed).toBe(true);
  });

  it("P006 — CLIENT ne peut pas envoyer offre depuis UNREAD", () => {
    const result = canPerformAction("sendOffer", "CLIENT", "UNREAD");
    expect(result.allowed).toBe(false);
  });

  it("P007 — CLIENT peut archiver depuis UNREAD", () => {
    const result = canPerformAction("archive", "CLIENT", "UNREAD");
    expect(result.allowed).toBe(true);
  });

  it("P008 — CLIENT ne peut pas archiver depuis OFFER_SENT (en attente décision)", () => {
    const result = canPerformAction("archive", "CLIENT", "OFFER_SENT");
    expect(result.allowed).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// VALIDATION OFFRES
// ═══════════════════════════════════════════════

describe("application-workflow — validateOffer", () => {
  it("O001 — offre FIXED valide avec titre, budget, date", () => {
    const result = validateOffer({
      title: "Mission React",
      offerType: "FIXED",
      totalBudget: 5000,
      startDate: new Date("2026-08-01"),
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("O002 — offre sans titre retourne erreur", () => {
    const result = validateOffer({
      offerType: "FIXED",
      totalBudget: 5000,
      startDate: new Date(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it("O003 — offre FIXED sans budget retourne erreur", () => {
    const result = validateOffer({
      title: "Mission React",
      offerType: "FIXED",
      startDate: new Date(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.totalBudget).toBeDefined();
  });

  it("O004 — offre HOURLY sans taux retourne erreur", () => {
    const result = validateOffer({
      title: "Mission React",
      offerType: "HOURLY",
      startDate: new Date(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.hourlyRate).toBeDefined();
  });

  it("O005 — offre HOURLY valide avec taux et date", () => {
    const result = validateOffer({
      title: "Mission React",
      offerType: "HOURLY",
      hourlyRate: 75,
      startDate: new Date("2026-08-01"),
    });
    expect(result.valid).toBe(true);
  });

  it("O006 — offre sans date retourne erreur", () => {
    const result = validateOffer({
      title: "Mission React",
      offerType: "FIXED",
      totalBudget: 5000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.startDate).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// LABELS & INTÉGRITÉ
// ═══════════════════════════════════════════════

describe("application-workflow — intégrité", () => {
  it("I001 — tous les statuts ont un label", () => {
    for (const status of Object.keys(VALID_TRANSITIONS)) {
      expect(APPLICATION_STATUS_LABELS[status as keyof typeof APPLICATION_STATUS_LABELS]).toBeDefined();
    }
  });

  it("I002 — VALID_TRANSITIONS ne référence que des statuts existants", () => {
    const allStatuses = new Set(Object.keys(VALID_TRANSITIONS));
    for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const to of targets) {
        expect(allStatuses.has(to)).toBe(true);
      }
    }
  });
});
