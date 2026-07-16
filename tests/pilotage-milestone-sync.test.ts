/**
 * Tests unitaires — Pilotage par jalons (freelancer ↔ client).
 *
 * Couvre :
 *  1. Types et helpers (toPilotageMilestone, evCount, emptyEvidence)
 *  2. Machine à états des jalons (transitions, gardes)
 *  3. Workflow prestataire (preuves, progression, soumission)
 *  4. Workflow client (progression constatée, validation, rejet)
 *  5. Synchronisation freelancer ↔ client (scénarios complets)
 *  6. Cas limites (jalons vides, transitions invalides, litige)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canTransitionMilestone,
  canSubmitMilestone,
  advanceMilestone,
  allMilestonesValidated,
  isDisputeThresholdReached,
  applyTacitValidations,
  type ContractWorkflowContext,
  type MilestoneWorkflowState,
  type MilestoneWorkflowStatus,
} from "@/lib/contract-workflow";
import {
  toPilotageMilestone,
  evCount,
  emptyEvidence,
  type PilotageMilestone,
  type EvidenceSet,
  PILOTAGE_STATUS_MAP,
  CLIENT_STATUS_MAP,
} from "@/components/contracts/workflow/pilotage/types";

// ═══════════════════════════════════════════════════════════════
// Helpers de test
// ═══════════════════════════════════════════════════════════════

function makeMilestone(
  overrides: Partial<MilestoneWorkflowState> & { milestoneId: string; title: string; amount: number }
): MilestoneWorkflowState {
  return {
    milestoneId: overrides.milestoneId,
    title: overrides.title,
    amount: overrides.amount,
    executionRate: overrides.executionRate ?? 0,
    status: overrides.status ?? "NOT_STARTED",
    submittedAt: overrides.submittedAt,
    validatedAt: overrides.validatedAt,
    rejectedAt: overrides.rejectedAt,
    rejectionReason: overrides.rejectionReason,
  };
}

function makeContext(
  overrides: Partial<ContractWorkflowContext> & { contractId: string }
): ContractWorkflowContext {
  return {
    contractId: overrides.contractId,
    phase: overrides.phase ?? "CONTRACT_ACTIVE",
    milestones: overrides.milestones ?? [],
    totalMilestones: overrides.totalMilestones ?? (overrides.milestones?.length ?? 0),
    validatedCount: overrides.validatedCount ?? 0,
    rejectionCount: overrides.rejectionCount ?? 0,
    maxRejectionsBeforeDispute: overrides.maxRejectionsBeforeDispute ?? 5,
    signedByClient: overrides.signedByClient ?? true,
    signedByFreelancer: overrides.signedByFreelancer ?? true,
    fullySignedAt: overrides.fullySignedAt,
    prorataClientShare: overrides.prorataClientShare ?? 0.5,
    prorataFreelancerShare: overrides.prorataFreelancerShare ?? 0.5,
    appealOpenedAt: overrides.appealOpenedAt,
    platformFeeAmount: overrides.platformFeeAmount ?? 0,
    contestedMilestoneIds: overrides.contestedMilestoneIds ?? [],
  };
}

// ═══════════════════════════════════════════════════════════════
// 1 — Types et Helpers
// ═══════════════════════════════════════════════════════════════

describe("Types et Helpers — PilotageMilestone", () => {
  it("toPilotageMilestone convertit correctement un MilestoneWorkflowState", () => {
    const wm = makeMilestone({
      milestoneId: "m1",
      title: "Terrassement",
      amount: 12000,
      executionRate: 50,
      status: "IN_PROGRESS",
    });

    const pm = toPilotageMilestone(wm);

    expect(pm.milestoneId).toBe("m1");
    expect(pm.title).toBe("Terrassement");
    expect(pm.amount).toBe(12000);
    expect(pm.executionRate).toBe(50);
    expect(pm.status).toBe("IN_PROGRESS");
    // Valeurs par défaut pilotage
    expect(pm.progressionDeclaree).toBe(50);
    expect(pm.progressionConstatee).toBeNull();
    expect(pm.revisionCount).toBe(0);
    expect(pm.evidence).toEqual(emptyEvidence());
  });

  it("toPilotageMilestone sur un jalon VALIDATED met progressionConstatee à 100", () => {
    const wm = makeMilestone({
      milestoneId: "m1",
      title: "Validé",
      amount: 5000,
      executionRate: 100,
      status: "VALIDATED",
    });
    const pm = toPilotageMilestone(wm);
    expect(pm.progressionConstatee).toBe(100);
  });

  it("evCount compte correctement tous les types de preuves", () => {
    const ev: EvidenceSet = {
      photos: ["p1.jpg", "p2.jpg"],
      videos: ["v1.mp4"],
      documents: [],
      geoloc: { lat: 48.85, lng: 2.35 },
      autres: [{ label: "attestation" }, { label: "certificat" }],
    };
    expect(evCount(ev)).toBe(6); // 2 photos + 1 video + 0 docs + 1 geoloc + 2 autres
  });

  it("evCount retourne 0 pour un EvidenceSet vide", () => {
    expect(evCount(emptyEvidence())).toBe(0);
  });

  it("emptyEvidence produit un objet avec tous les tableaux vides et geoloc null", () => {
    const ev = emptyEvidence();
    expect(ev.photos).toEqual([]);
    expect(ev.videos).toEqual([]);
    expect(ev.documents).toEqual([]);
    expect(ev.geoloc).toBeNull();
    expect(ev.autres).toEqual([]);
  });

  it("PILOTAGE_STATUS_MAP contient tous les statuts avec label et cls", () => {
    const statuses: MilestoneWorkflowStatus[] = [
      "NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "VALIDATED", "REJECTED",
    ];
    for (const s of statuses) {
      expect(PILOTAGE_STATUS_MAP[s]).toBeDefined();
      expect(PILOTAGE_STATUS_MAP[s].cls).toBeTruthy();
      expect(PILOTAGE_STATUS_MAP[s].label).toBeTruthy();
    }
  });

  it("CLIENT_STATUS_MAP utilise des labels orientés client", () => {
    expect(CLIENT_STATUS_MAP["SUBMITTED"].label).toBe("À valider");
    expect(CLIENT_STATUS_MAP["REJECTED"].label).toBe("Rejeté par vous");
    expect(CLIENT_STATUS_MAP["IN_PROGRESS"].label).toBe("Non soumis");
    expect(CLIENT_STATUS_MAP["VALIDATED"].label).toBe("Validé");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2 — Machine à états des jalons
// ═══════════════════════════════════════════════════════════════

describe("Machine à états — Transitions de jalon", () => {
  describe("Transitions valides", () => {
    it("NOT_STARTED → IN_PROGRESS", () => {
      expect(canTransitionMilestone("NOT_STARTED", "IN_PROGRESS")).toBe(true);
    });

    it("IN_PROGRESS → SUBMITTED", () => {
      expect(canTransitionMilestone("IN_PROGRESS", "SUBMITTED")).toBe(true);
    });

    it("SUBMITTED → VALIDATED", () => {
      expect(canTransitionMilestone("SUBMITTED", "VALIDATED")).toBe(true);
    });

    it("SUBMITTED → IN_PROGRESS (rejet)", () => {
      expect(canTransitionMilestone("SUBMITTED", "IN_PROGRESS")).toBe(true);
    });
  });

  describe("Transitions invalides", () => {
    it("NOT_STARTED → SUBMITTED (interdit, saute IN_PROGRESS)", () => {
      expect(canTransitionMilestone("NOT_STARTED", "SUBMITTED")).toBe(false);
    });

    it("NOT_STARTED → VALIDATED (interdit)", () => {
      expect(canTransitionMilestone("NOT_STARTED", "VALIDATED")).toBe(false);
    });

    it("VALIDATED → IN_PROGRESS (interdit, déjà validé)", () => {
      expect(canTransitionMilestone("VALIDATED", "IN_PROGRESS")).toBe(false);
    });

    it("VALIDATED → SUBMITTED (interdit)", () => {
      expect(canTransitionMilestone("VALIDATED", "SUBMITTED")).toBe(false);
    });

    it("REJECTED n'est pas un statut final de transition", () => {
      // REJECTED n'est pas dans la machine, c'est SUBMITTED→IN_PROGRESS avec rejectionReason
      const ctx = makeContext({
        contractId: "c1",
        milestones: [
          makeMilestone({
            milestoneId: "m1",
            title: "Test",
            amount: 1000,
            executionRate: 100,
            status: "SUBMITTED",
          }),
        ],
        totalMilestones: 1,
      });
      const result = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
        rejectionReason: "Non conforme",
      });
      expect(result.success).toBe(true);
      const m = result.context.milestones[0];
      expect(m.status).toBe("IN_PROGRESS");
      expect(m.rejectionReason).toBe("Non conforme");
    });
  });

  describe("Garde — Soumission (progression déclarée non bloquante)", () => {
    it("canSubmitMilestone true quel que soit executionRate", () => {
      const m = makeMilestone({
        milestoneId: "m1",
        title: "Ok",
        amount: 1000,
        executionRate: 100,
        status: "IN_PROGRESS",
      });
      expect(canSubmitMilestone(m)).toBe(true);
    });

    it("canSubmitMilestone true même si executionRate < 100 (non bloquant)", () => {
      const m = makeMilestone({
        milestoneId: "m1",
        title: "Pas ok",
        amount: 1000,
        executionRate: 30,
        status: "IN_PROGRESS",
      });
      expect(canSubmitMilestone(m)).toBe(true);
    });

    it("advanceMilestone accepte SUBMITTED même si executionRate < 100", () => {
      const ctx = makeContext({
        contractId: "c1",
        milestones: [
          makeMilestone({
            milestoneId: "m1",
            title: "Pas fini",
            amount: 1000,
            executionRate: 60,
            status: "IN_PROGRESS",
          }),
        ],
        totalMilestones: 1,
      });
      const result = advanceMilestone(ctx, "m1", "SUBMITTED");
      expect(result.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3 — Workflow Prestataire (freelancer)
// ═══════════════════════════════════════════════════════════════

describe("Workflow Prestataire — Gestion des jalons", () => {
  let ctx: ContractWorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      contractId: "contract-1",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1",
          title: "Terrassement & fondations",
          amount: 12000,
          executionRate: 0,
          status: "NOT_STARTED",
        }),
        makeMilestone({
          milestoneId: "m2",
          title: "Gros œuvre",
          amount: 25000,
          executionRate: 0,
          status: "NOT_STARTED",
        }),
        makeMilestone({
          milestoneId: "m3",
          title: "Finitions",
          amount: 9000,
          executionRate: 0,
          status: "NOT_STARTED",
        }),
      ],
      totalMilestones: 3,
    });
  });

  it("Démarrage du 1er jalon : NOT_STARTED → IN_PROGRESS", () => {
    const result = advanceMilestone(ctx, "m1", "IN_PROGRESS");
    expect(result.success).toBe(true);

    const m1 = result.context.milestones.find((m) => m.milestoneId === "m1")!;
    expect(m1.status).toBe("IN_PROGRESS");

    // Les autres jalons restent NOT_STARTED
    const m2 = result.context.milestones.find((m) => m.milestoneId === "m2")!;
    expect(m2.status).toBe("NOT_STARTED");
  });

  it("Soumission après progression à 100% : IN_PROGRESS → SUBMITTED", () => {
    // D'abord démarrer
    const r1 = advanceMilestone(ctx, "m1", "IN_PROGRESS");
    expect(r1.success).toBe(true);
    // Mettre executionRate à 100
    r1.context.milestones[0].executionRate = 100;

    const r2 = advanceMilestone(r1.context, "m1", "SUBMITTED");
    expect(r2.success).toBe(true);

    const m = r2.context.milestones[0];
    expect(m.status).toBe("SUBMITTED");
    expect(m.submittedAt).toBeTruthy();
  });

  it("Démarrage auto du jalon suivant après validation", () => {
    // m1 : démarré → soumis → validé
    let current = ctx;
    const r1 = advanceMilestone(current, "m1", "IN_PROGRESS");
    current = r1.context;
    current.milestones[0].executionRate = 100;

    const r2 = advanceMilestone(current, "m1", "SUBMITTED");
    current = r2.context;

    const r3 = advanceMilestone(current, "m1", "VALIDATED");
    expect(r3.success).toBe(true);

    // m2 doit être passé en IN_PROGRESS automatiquement
    const m2 = r3.context.milestones.find((m) => m.milestoneId === "m2")!;
    expect(m2.status).toBe("IN_PROGRESS");
  });

  it("Rejet → retour à IN_PROGRESS avec motif conservé", () => {
    // Soumettre d'abord
    let current = ctx;
    const r1 = advanceMilestone(current, "m1", "IN_PROGRESS");
    current = r1.context;
    current.milestones[0].executionRate = 100;

    const r2 = advanceMilestone(current, "m1", "SUBMITTED");
    current = r2.context;

    // Rejeter
    const r3 = advanceMilestone(current, "m1", "IN_PROGRESS", {
      rejectionReason: "Raccordements non conformes",
    });
    expect(r3.success).toBe(true);

    const m = r3.context.milestones[0];
    expect(m.status).toBe("IN_PROGRESS");
    expect(m.rejectionReason).toBe("Raccordements non conformes");
    expect(m.rejectedAt).toBeTruthy();
    expect(m.submittedAt).toBeUndefined();
  });

  it("Incrementation du compteur de rejets après rejet", () => {
    let current = ctx;
    const r1 = advanceMilestone(current, "m1", "IN_PROGRESS");
    current = r1.context;
    current.milestones[0].executionRate = 100;

    const r2 = advanceMilestone(current, "m1", "SUBMITTED");
    current = r2.context;

    const r3 = advanceMilestone(current, "m1", "IN_PROGRESS", {
      rejectionReason: "Non conforme",
    });
    expect(r3.context.rejectionCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4 — Workflow Client (validation/rejet)
// ═══════════════════════════════════════════════════════════════

describe("Workflow Client — Validation et rejet", () => {
  let ctx: ContractWorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      contractId: "contract-1",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1",
          title: "Terrassement",
          amount: 12000,
          executionRate: 100,
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
        makeMilestone({
          milestoneId: "m2",
          title: "Gros œuvre",
          amount: 25000,
          executionRate: 100,
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
      ],
      totalMilestones: 2,
    });
  });

  it("Validation d'un jalon soumis : SUBMITTED → VALIDATED", () => {
    const result = advanceMilestone(ctx, "m1", "VALIDATED");
    expect(result.success).toBe(true);

    const m = result.context.milestones[0];
    expect(m.status).toBe("VALIDATED");
    expect(m.validatedAt).toBeTruthy();
    expect(result.context.validatedCount).toBe(1);
  });

  it("Rejet avec motif obligatoire : SUBMITTED → IN_PROGRESS", () => {
    const result = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
      rejectionReason: "Électricité non conforme NF C 15-100",
    });
    expect(result.success).toBe(true);

    const m = result.context.milestones[0];
    expect(m.status).toBe("IN_PROGRESS");
    expect(m.rejectionReason).toBe("Électricité non conforme NF C 15-100");
    expect(result.context.rejectionCount).toBe(1);
  });

  it("Impossible de valider un jalon déjà VALIDATED", () => {
    const r1 = advanceMilestone(ctx, "m1", "VALIDATED");
    const r2 = advanceMilestone(r1.context, "m1", "VALIDATED");
    expect(r2.success).toBe(false);
    expect(r2.error).toContain("interdite");
  });

  it("Validation tacite — applyTacitValidations valide les SUBMITTED expirés", () => {
    // Mettre submittedAt à 8 jours dans le passé pour dépasser le délai de 7 jours
    const expiredCtx = {
      ...ctx,
      tacitValidationDays: 7,
      milestones: ctx.milestones.map((m) => ({
        ...m,
        submittedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      })),
    };
    const result = applyTacitValidations(expiredCtx);
    expect(result.success).toBe(true);

    const allValidated = result.context.milestones.every(
      (m) => m.status === "VALIDATED"
    );
    expect(allValidated).toBe(true);
    expect(result.context.validatedCount).toBe(2);
  });

  it("Tous les jalons validés → allMilestonesValidated = true", () => {
    const r1 = advanceMilestone(ctx, "m1", "VALIDATED");
    const r2 = advanceMilestone(r1.context, "m2", "VALIDATED");
    expect(allMilestonesValidated(r2.context)).toBe(true);
  });

  it("Jalons partiellement validés → allMilestonesValidated = false", () => {
    const r1 = advanceMilestone(ctx, "m1", "VALIDATED");
    expect(allMilestonesValidated(r1.context)).toBe(false);
  });

  it("Litige déclenché si rejets >= maxRejectionsBeforeDispute", () => {
    let current = ctx;

    // 5 rejets
    for (let i = 0; i < 5; i++) {
      const r = advanceMilestone(current, "m1", "IN_PROGRESS", {
        rejectionReason: `Rejet ${i + 1}`,
      });
      current = r.context;
      current.milestones[0].executionRate = 100;
      // Re-soumettre pour pouvoir re-rejeter
      const s = advanceMilestone(current, "m1", "SUBMITTED");
      current = s.context;
    }

    expect(isDisputeThresholdReached(current)).toBe(true);
    // Le dernier rejet a dû déclencher DISPUTE_OPENED
    // (vérifié par advanceMilestone -> isDisputeThresholdReached)
    expect(current.phase).toBe("DISPUTE_OPENED");
    expect(current.disputeStep).toBe("PURGE");
  });
});

// ═══════════════════════════════════════════════════════════════
// 5 — Synchronisation Freelancer ↔ Client (scénarios complets)
// ═══════════════════════════════════════════════════════════════

describe("Synchronisation Freelancer ↔ Client", () => {
  /**
   * Scénario complet : un prestataire démarre un jalon, ajoute des preuves,
   * soumet, le client l'examine, le valide.
   */
  it("Scénario nominal — Démarrage → Preuves → Soumission → Validation", () => {
    // ── Initialisation côté prestataire ──
    let ctx = makeContext({
      contractId: "sync-1",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1",
          title: "Terrassement & fondations",
          amount: 12000,
          executionRate: 0,
          status: "NOT_STARTED",
        }),
      ],
      totalMilestones: 1,
    });

    // 1. Prestataire démarre le jalon
    const r1 = advanceMilestone(ctx, "m1", "IN_PROGRESS");
    expect(r1.success).toBe(true);
    ctx = r1.context;
    expect(ctx.milestones[0].status).toBe("IN_PROGRESS");

    // 2. Prestataire déclare progression 100% et ajoute preuves
    ctx.milestones[0].executionRate = 100;
    const pilotageMilestone = toPilotageMilestone(ctx.milestones[0]);
    pilotageMilestone.evidence = {
      photos: ["Photo_01.jpg", "Photo_02.jpg"],
      videos: [],
      documents: ["Rapport_sol.pdf"],
      geoloc: { lat: 48.8566, lng: 2.3522 },
      autres: [],
    };
    expect(evCount(pilotageMilestone.evidence)).toBe(4);
    expect(pilotageMilestone.progressionDeclaree).toBe(100);

    // 3. Prestataire soumet
    const r2 = advanceMilestone(ctx, "m1", "SUBMITTED");
    expect(r2.success).toBe(true);
    ctx = r2.context;
    expect(ctx.milestones[0].status).toBe("SUBMITTED");
    expect(ctx.milestones[0].submittedAt).toBeTruthy();

    // ── Côté client ──
    // 4. Client voit un jalon "À valider"
    const clientView = CLIENT_STATUS_MAP["SUBMITTED"];
    expect(clientView.label).toBe("À valider");

    // 5. Client examine les preuves et fixe progression constatée à 100%
    const clientPilotage = toPilotageMilestone(ctx.milestones[0]);
    clientPilotage.progressionConstatee = 100;
    expect(clientPilotage.progressionConstatee).toBe(100);

    // 6. Client valide
    const r3 = advanceMilestone(ctx, "m1", "VALIDATED");
    expect(r3.success).toBe(true);
    ctx = r3.context;
    expect(ctx.milestones[0].status).toBe("VALIDATED");
    expect(ctx.milestones[0].validatedAt).toBeTruthy();
    expect(ctx.validatedCount).toBe(1);

    // 7. Tous les jalons validés → prêt pour clôture
    expect(allMilestonesValidated(ctx)).toBe(true);
  });

  it("Scénario avec rejet et re-soumission", () => {
    let ctx = makeContext({
      contractId: "sync-2",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1",
          title: "Plomberie",
          amount: 8000,
          executionRate: 100,
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
      ],
      totalMilestones: 1,
    });

    // 1. Client rejette avec motif
    const r1 = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
      rejectionReason: "Fuite détectée, joints à reprendre",
    });
    expect(r1.success).toBe(true);
    ctx = r1.context;
    expect(ctx.milestones[0].status).toBe("IN_PROGRESS");
    expect(ctx.milestones[0].rejectionReason).toBe("Fuite détectée, joints à reprendre");
    expect(ctx.rejectionCount).toBe(1);

    // 2. Prestataire corrige et re-soumet
    ctx.milestones[0].executionRate = 100;
    const pilotagePM = toPilotageMilestone(ctx.milestones[0]);
    pilotagePM.revisionCount = 1;
    expect(pilotagePM.revisionCount).toBe(1);

    const r2 = advanceMilestone(ctx, "m1", "SUBMITTED");
    expect(r2.success).toBe(true);
    ctx = r2.context;
    expect(ctx.milestones[0].status).toBe("SUBMITTED");

    // 3. Client valide cette fois
    const r3 = advanceMilestone(ctx, "m1", "VALIDATED");
    expect(r3.success).toBe(true);
    ctx = r3.context;
    expect(ctx.milestones[0].status).toBe("VALIDATED");
  });

  it("Scénario avec jalons multiples et auto-démarrage", () => {
    let ctx = makeContext({
      contractId: "sync-3",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Phase 1", amount: 5000,
          executionRate: 100, status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
        makeMilestone({
          milestoneId: "m2", title: "Phase 2", amount: 7000,
          executionRate: 0, status: "NOT_STARTED",
        }),
        makeMilestone({
          milestoneId: "m3", title: "Phase 3", amount: 3000,
          executionRate: 0, status: "NOT_STARTED",
        }),
      ],
      totalMilestones: 3,
    });

    // Valider m1 → m2 doit démarrer auto
    const r1 = advanceMilestone(ctx, "m1", "VALIDATED");
    expect(r1.success).toBe(true);
    ctx = r1.context;

    const m2 = ctx.milestones.find((m) => m.milestoneId === "m2")!;
    expect(m2.status).toBe("IN_PROGRESS");

    const m3 = ctx.milestones.find((m) => m.milestoneId === "m3")!;
    expect(m3.status).toBe("NOT_STARTED"); // pas encore

    expect(ctx.validatedCount).toBe(1);
    expect(allMilestonesValidated(ctx)).toBe(false);
  });

  it("Scénario — Soumission acceptée même si progression < 100%", () => {
    const ctx = makeContext({
      contractId: "sync-4",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1",
          title: "Incomplet",
          amount: 5000,
          executionRate: 60, // < 100 — n'est plus bloquant
          status: "IN_PROGRESS",
        }),
      ],
      totalMilestones: 1,
    });

    const result = advanceMilestone(ctx, "m1", "SUBMITTED");
    expect(result.success).toBe(true);
    expect(result.context.milestones[0].status).toBe("SUBMITTED");
  });

  it("Scénario — Refus de soumission sans preuve (logique applicative)", () => {
    // La garde canSubmitMilestone ne vérifie que l'executionRate.
    // La vérification "au moins une preuve" est au niveau du composant React.
    // On teste donc que la logique evCount fonctionne côté UI.
    const pm = toPilotageMilestone(
      makeMilestone({
        milestoneId: "m1",
        title: "Sans preuve",
        amount: 5000,
        executionRate: 100,
        status: "IN_PROGRESS",
      })
    );
    // Sans preuve ajoutée
    expect(evCount(pm.evidence)).toBe(0);
    // Le composant bloquera : progressionDeclaree === 100 && evCount > 0
    const canSubmitUI = pm.progressionDeclaree === 100 && evCount(pm.evidence) > 0;
    expect(canSubmitUI).toBe(false);

    // Avec preuve
    pm.evidence.photos = ["preuve.jpg"];
    expect(evCount(pm.evidence)).toBe(1);
    const canSubmitUI2 = pm.progressionDeclaree === 100 && evCount(pm.evidence) > 0;
    expect(canSubmitUI2).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6 — Cas limites
// ═══════════════════════════════════════════════════════════════

describe("Cas limites — Pilotage", () => {
  it("Jalon inexistant → erreur", () => {
    const ctx = makeContext({
      contractId: "c1",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Seul", amount: 1000,
          executionRate: 100, status: "IN_PROGRESS",
        }),
      ],
      totalMilestones: 1,
    });

    const result = advanceMilestone(ctx, "m999", "SUBMITTED");
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("Aucun jalon → allMilestonesValidated = false", () => {
    const ctx = makeContext({
      contractId: "c1",
      milestones: [],
      totalMilestones: 0,
    });
    expect(allMilestonesValidated(ctx)).toBe(false);
  });

  it("Progression à 0% → canSubmitMilestone = true (non bloquant)", () => {
    const m = makeMilestone({
      milestoneId: "m1", title: "Vide", amount: 100,
      executionRate: 0, status: "IN_PROGRESS",
    });
    expect(canSubmitMilestone(m)).toBe(true);
  });

  it("Progression à 100% mais statut SUBMITTED → canSubmitMilestone = false (déjà soumis)", () => {
    const m = makeMilestone({
      milestoneId: "m1", title: "Déjà", amount: 100,
      executionRate: 100, status: "SUBMITTED",
    });
    expect(canSubmitMilestone(m)).toBe(false);
  });

  it("Transition interdite avec message d'erreur clair", () => {
    const ctx = makeContext({
      contractId: "c1",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Test", amount: 1000,
          executionRate: 100, status: "VALIDATED",
        }),
      ],
      totalMilestones: 1,
    });

    const result = advanceMilestone(ctx, "m1", "SUBMITTED");
    expect(result.success).toBe(false);
    expect(result.error).toContain("VALIDATED");
    expect(result.error).toContain("SUBMITTED");
    expect(result.error).toContain("interdite");
  });

  it("Contexte non modifié en cas d'erreur de transition", () => {
    const ctx = makeContext({
      contractId: "c1",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Test", amount: 1000,
          executionRate: 100, status: "VALIDATED",
        }),
      ],
      totalMilestones: 1,
    });

    const result = advanceMilestone(ctx, "m1", "SUBMITTED");
    expect(result.success).toBe(false);
    // Le contexte retourné doit être identique à l'original
    expect(result.context.milestones[0].status).toBe("VALIDATED");
    expect(result.context.milestones[0].executionRate).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7 — Nettoyage des champs après rejet/resoumission
// ═══════════════════════════════════════════════════════════════

describe("Nettoyage rejectionReason / rejectedAt après resoumission", () => {
  let ctx: ContractWorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      contractId: "c-clean-1",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1",
          title: "Plomberie",
          amount: 8000,
          executionRate: 100,
          status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
      ],
      totalMilestones: 1,
    });
  });

  it("Rejet positionne rejectedAt et rejectionReason, efface submittedAt", () => {
    const result = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
      rejectionReason: "Fuite détectée sur le raccordement",
    });
    expect(result.success).toBe(true);

    const m = result.context.milestones[0];
    expect(m.status).toBe("IN_PROGRESS");
    expect(m.rejectedAt).toBeTruthy();
    expect(m.rejectionReason).toBe("Fuite détectée sur le raccordement");
    expect(m.submittedAt).toBeUndefined();
  });

  it("Resoumission après rejet efface rejectionReason et rejectedAt", () => {
    // 1. Rejet
    const r1 = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
      rejectionReason: "Raccordement non conforme",
    });
    expect(r1.success).toBe(true);
    expect(r1.context.milestones[0].rejectedAt).toBeTruthy();
    expect(r1.context.milestones[0].rejectionReason).toBe("Raccordement non conforme");

    // 2. Resoumission après correction
    const r2 = advanceMilestone(r1.context, "m1", "SUBMITTED");
    expect(r2.success).toBe(true);

    const m = r2.context.milestones[0];
    expect(m.status).toBe("SUBMITTED");
    expect(m.rejectedAt).toBeUndefined();
    expect(m.rejectionReason).toBeUndefined();
    expect(m.submittedAt).toBeTruthy(); // nouveau timestamp
  });

  it("Cycle rejet → resoumission → rejet préserve le nouveau rejectedAt", () => {
    // 1. Rejet initial
    const r1 = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
      rejectionReason: "Non conforme v1",
    });
    const m1 = r1.context.milestones[0];
    expect(m1.rejectedAt).toBeTruthy();
    expect(m1.rejectionReason).toBe("Non conforme v1");

    // 2. Resoumission (efface rejectionReason et rejectedAt)
    const r2 = advanceMilestone(r1.context, "m1", "SUBMITTED");
    expect(r2.context.milestones[0].rejectedAt).toBeUndefined();
    expect(r2.context.milestones[0].rejectionReason).toBeUndefined();

    // 3. Second rejet
    const r3 = advanceMilestone(r2.context, "m1", "IN_PROGRESS", {
      rejectionReason: "Toujours non conforme",
    });
    const m = r3.context.milestones[0];
    expect(m.rejectedAt).toBeTruthy();
    // Le rejectedAt a été regénéré fraîchement après la resoumission
    expect(m.rejectedAt).not.toBeUndefined();
    expect(m.rejectionReason).toBe("Toujours non conforme");
    // Le rejectionReason précédent a bien été remplacé
    expect(m.rejectionReason).not.toBe("Non conforme v1");
  });

  it("Deux rejets consécutifs sans resoumission intermédiaire sont bloqués", () => {
    // Après un rejet, le jalon est en IN_PROGRESS
    const r1 = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
      rejectionReason: "Rejet 1",
    });
    expect(r1.success).toBe(true);
    expect(r1.context.milestones[0].status).toBe("IN_PROGRESS");

    // Tenter un second rejet sans resoumission → transition IN_PROGRESS → IN_PROGRESS interdite
    const r2 = advanceMilestone(r1.context, "m1", "IN_PROGRESS", {
      rejectionReason: "Rejet 2",
    });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain("interdite");
  });

  it("Resoumission sans rejet préalable n'affecte pas les champs (undefined)", () => {
    // Jalon en IN_PROGRESS, jamais rejeté
    const cleanCtx = makeContext({
      contractId: "c-clean-2",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Départ propre", amount: 5000,
          executionRate: 100, status: "IN_PROGRESS",
        }),
      ],
      totalMilestones: 1,
    });

    const result = advanceMilestone(cleanCtx, "m1", "SUBMITTED");
    expect(result.success).toBe(true);
    const m = result.context.milestones[0];
    expect(m.rejectedAt).toBeUndefined();
    expect(m.rejectionReason).toBeUndefined();
    expect(m.submittedAt).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// 8 — rejectCount et contestation (isDisputeThresholdReached)
// ═══════════════════════════════════════════════════════════════

describe("Compteur de rejets et seuil de litige", () => {
  it("rejectionCount s'incrémente correctement après chaque rejet + resoumission", () => {
    let ctx = makeContext({
      contractId: "c-rej-1",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Lot 1", amount: 5000,
          executionRate: 100, status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
      ],
      totalMilestones: 1,
    });

    for (let i = 0; i < 3; i++) {
      // Rejet
      const r = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
        rejectionReason: `Rejet n°${i + 1}`,
      });
      expect(r.success).toBe(true);
      ctx = r.context;
      expect(ctx.rejectionCount).toBe(i + 1);

      // Resoumission
      const s = advanceMilestone(ctx, "m1", "SUBMITTED");
      expect(s.success).toBe(true);
      ctx = s.context;
    }

    expect(ctx.rejectionCount).toBe(3);
  });

  it("Seuil de litige à 5 rejets → phase = DISPUTE_OPENED", () => {
    let ctx = makeContext({
      contractId: "c-dispute-1",
      phase: "CONTRACT_ACTIVE",
      milestones: [
        makeMilestone({
          milestoneId: "m1", title: "Lot 1", amount: 5000,
          executionRate: 100, status: "SUBMITTED",
          submittedAt: new Date().toISOString(),
        }),
      ],
      totalMilestones: 1,
      maxRejectionsBeforeDispute: 5,
    });

    for (let i = 0; i < 5; i++) {
      const r = advanceMilestone(ctx, "m1", "IN_PROGRESS", {
        rejectionReason: `Rejet n°${i + 1}`,
      });
      ctx = r.context;
      const s = advanceMilestone(ctx, "m1", "SUBMITTED");
      ctx = s.context;
    }

    expect(ctx.phase).toBe("DISPUTE_OPENED");
    expect(ctx.disputeStep).toBe("PURGE");
    expect(ctx.contestedMilestoneIds).toContain("m1");
  });
});
