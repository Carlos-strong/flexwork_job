import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════
// MOCKS Prisma
// ═══════════════════════════════════════════════
const mockOfferFindUnique = vi.fn();
const mockOfferFindUniqueOrThrow = vi.fn();
const mockOfferFindMany = vi.fn();
const mockOfferCreate = vi.fn();
const mockOfferUpdate = vi.fn();
const mockOfferUpdateMany = vi.fn();
const mockApplicationFindUniqueOrThrow = vi.fn();
const mockApplicationFindMany = vi.fn();
const mockApplicationUpdate = vi.fn();
const mockMilestoneCreate = vi.fn();
const mockMilestoneFindMany = vi.fn();
const mockMilestoneUpdate = vi.fn();
const mockStatusHistoryCreate = vi.fn();
const mockContractCreate = vi.fn();
const mockContractUpdate = vi.fn();
const mockMissionFindMany = vi.fn();
const mockFreelancerProfileFindUnique = vi.fn();
const mockClientProfileFindUnique = vi.fn();

const mockTx = {
  offer: { update: vi.fn(), findUnique: vi.fn() },
  application: { update: vi.fn() },
  contract: { create: vi.fn() },
  milestone: { create: vi.fn(), findMany: vi.fn() },
  applicationStatusHistory: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    offer: {
      findUnique: (opts: any) => mockOfferFindUnique(opts),
      findUniqueOrThrow: (opts: any) => mockOfferFindUniqueOrThrow(opts),
      findMany: (opts: any) => mockOfferFindMany(opts),
      create: (opts: any) => mockOfferCreate(opts),
      update: (opts: any) => mockOfferUpdate(opts),
      updateMany: (opts: any) => mockOfferUpdateMany(opts),
    },
    application: {
      findUniqueOrThrow: (opts: any) => mockApplicationFindUniqueOrThrow(opts),
      findMany: (opts: any) => mockApplicationFindMany(opts),
      update: (opts: any) => mockApplicationUpdate(opts),
    },
    milestone: {
      create: (opts: any) => mockMilestoneCreate(opts),
      findMany: (opts: any) => mockMilestoneFindMany(opts),
      update: (opts: any) => mockMilestoneUpdate(opts),
    },
    applicationStatusHistory: {
      create: (opts: any) => mockStatusHistoryCreate(opts),
    },
    contract: {
      create: (opts: any) => mockContractCreate(opts),
      update: (opts: any) => mockContractUpdate(opts),
    },
    mission: {
      findMany: (opts: any) => mockMissionFindMany(opts),
    },
    freelancerProfile: {
      findUnique: (opts: any) => mockFreelancerProfileFindUnique(opts),
    },
    clientProfile: {
      findUnique: (opts: any) => mockClientProfileFindUnique(opts),
    },
    $transaction: async (fn: any) => fn(mockTx),
  },
}));

// Mock des dépendances externes
vi.mock("@/lib/queue", () => ({
  enqueueJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/notification-helper", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/escrow", () => ({
  escrow: { create: vi.fn().mockResolvedValue({ trustEngineEscrowId: "esc_123", stripePaymentIntentId: "pi_123" }) },
}));

vi.mock("@/lib/collaboration", () => ({
  createConversation: vi.fn().mockReturnValue({ id: "conv_123" }),
  addSystemMessage: vi.fn(),
  conversations: [],
}));

import { OfferService } from "@/lib/services/offer.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — CREATE OFFER
// ═══════════════════════════════════════════════

describe("OfferService.createOffer", () => {
  const baseInput = {
    applicationId: "app_123",
    title: "Développement module paiement",
    description: "Intégration Stripe",
    offerType: "FIXED" as const,
    totalBudget: 5000,
    startDate: new Date("2026-08-01"),
    milestones: [
      { title: "Jalon 1", description: "Setup", amount: 2000, dueDate: new Date("2026-08-15") },
      { title: "Jalon 2", description: "Livraison", amount: 3000, dueDate: new Date("2026-09-01") },
    ],
  };

  beforeEach(() => {
    mockApplicationFindUniqueOrThrow.mockResolvedValue({
      id: "app_123",
      status: "INTERVIEW",
      mission: { id: "mission_1", title: "Mission test" },
      freelancer: { id: "fl_1" },
      offers: [],
    });

    mockOfferCreate.mockResolvedValue({
      id: "offer_123",
      applicationId: "app_123",
      title: "Développement module paiement",
      description: "Intégration Stripe",
      offerType: "FIXED",
      totalBudget: 5000,
      status: "DRAFT",
      startDate: new Date("2026-08-01"),
      milestones: [],
    });

    mockMilestoneCreate.mockResolvedValue({ id: "ms_1" });
  });

  it("C001 — crée une offre FIXED en DRAFT avec jalons", async () => {
    const offer = await OfferService.createOffer(baseInput);

    expect(offer).toBeDefined();
    expect(offer.id).toBe("offer_123");
    expect(mockOfferCreate).toHaveBeenCalledTimes(1);
    // Vérifie que le statut initial est DRAFT
    const createCall = mockOfferCreate.mock.calls[0][0];
    expect(createCall.data.status).toBe("DRAFT");
    expect(createCall.data.offerType).toBe("FIXED");
    expect(createCall.data.totalBudget).toBe(5000);
  });

  it("C002 — crée les jalons associés à l'offre", async () => {
    await OfferService.createOffer(baseInput);

    // 2 jalons → 2 appels à milestone.create
    expect(mockMilestoneCreate).toHaveBeenCalledTimes(2);
    expect(mockMilestoneCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Jalon 1", amount: 2000 }),
      })
    );
  });

  it("C003 — crée une offre HOURLY sans jalons", async () => {
    mockOfferCreate.mockResolvedValue({
      id: "offer_124",
      offerType: "HOURLY",
      hourlyRate: 75,
      status: "DRAFT",
    });

    const offer = await OfferService.createOffer({
      ...baseInput,
      offerType: "HOURLY",
      hourlyRate: 75,
      totalBudget: undefined,
      milestones: [],
    });

    expect(offer).toBeDefined();
    expect(mockOfferCreate.mock.calls[0][0].data.offerType).toBe("HOURLY");
    expect(mockOfferCreate.mock.calls[0][0].data.hourlyRate).toBe(75);
    expect(mockMilestoneCreate).not.toHaveBeenCalled();
  });

  it("C004 — rejette une offre FIXED sans budget", async () => {
    await expect(
      OfferService.createOffer({
        ...baseInput,
        totalBudget: undefined,
      })
    ).rejects.toThrow("Validation failed");
  });

  it("C005 — rejette une offre sans titre", async () => {
    await expect(
      OfferService.createOffer({
        ...baseInput,
        title: "",
      })
    ).rejects.toThrow("Validation failed");
  });
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — SEND OFFER
// ═══════════════════════════════════════════════

describe("OfferService.sendOffer", () => {
  const baseOffer = {
    id: "offer_123",
    applicationId: "app_123",
    title: "Développement module paiement",
    status: "DRAFT",
    offerType: "FIXED",
    totalBudget: 5000,
    startDate: new Date("2026-08-01"),
    application: {
      id: "app_123",
      status: "INTERVIEW",
      freelancer: {
        id: "fl_1",
        user: { id: "user_fl", email: "freelance@test.com", firstName: "Jean", lastName: "Martin" },
      },
      mission: { id: "mission_1", title: "Mission test" },
    },
  };

  beforeEach(() => {
    mockOfferFindUniqueOrThrow.mockResolvedValue(baseOffer);
    mockOfferUpdate.mockResolvedValue({
      ...baseOffer,
      status: "SENT",
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      application: baseOffer.application,
    });
    mockApplicationUpdate.mockResolvedValue({ id: "app_123", status: "OFFER_SENT" });
    mockStatusHistoryCreate.mockResolvedValue({});
  });

  it("S001 — envoie une offre DRAFT → SENT", async () => {
    const result = await OfferService.sendOffer("offer_123");

    expect(mockOfferUpdate).toHaveBeenCalled();
    const updateCall = mockOfferUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe("SENT");
    expect(updateCall.data.sentAt).toBeDefined();
    expect(updateCall.data.expiresAt).toBeDefined();
  });

  it("S002 — met à jour le statut de l'application à OFFER_SENT", async () => {
    await OfferService.sendOffer("offer_123");

    expect(mockApplicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app_123" },
        data: { status: "OFFER_SENT" },
      })
    );
  });

  it("S003 — crée une entrée dans l'historique des statuts", async () => {
    await OfferService.sendOffer("offer_123");

    expect(mockStatusHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app_123",
          toStatus: "OFFER_SENT",
          changedByRole: "CLIENT",
        }),
      })
    );
  });

  it("S004 — refuse d'envoyer une offre déjà SENT", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({ ...baseOffer, status: "SENT" });

    await expect(OfferService.sendOffer("offer_123")).rejects.toThrow(
      "Impossible d'envoyer une offre avec le statut SENT"
    );
  });

  it("S005 — refuse d'envoyer une offre ACCEPTED", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({ ...baseOffer, status: "ACCEPTED" });

    await expect(OfferService.sendOffer("offer_123")).rejects.toThrow(
      "Impossible d'envoyer une offre avec le statut ACCEPTED"
    );
  });
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — ACCEPT OFFER
// ═══════════════════════════════════════════════

describe("OfferService.acceptOffer", () => {
  const baseOffer = {
    id: "offer_123",
    applicationId: "app_123",
    title: "Développement module paiement",
    status: "SENT",
    offerType: "FIXED",
    totalBudget: 5000,
    startDate: new Date("2026-08-01"),
    endDate: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    application: {
      id: "app_123",
      status: "OFFER_SENT",
      mission: {
        id: "mission_1",
        title: "Mission test",
        client: {
          id: "client_1",
          user: { id: "user_client", email: "client@test.com", firstName: "Pierre", lastName: "Durand" },
        },
      },
      freelancer: {
        id: "fl_1",
        user: { id: "user_fl", email: "freelance@test.com", firstName: "Jean", lastName: "Martin" },
      },
    },
  };

  beforeEach(() => {
    mockOfferFindUniqueOrThrow.mockResolvedValue(baseOffer);
    mockMilestoneFindMany.mockResolvedValue([
      { id: "ms_1", title: "Jalon 1", amount: 2000, dueDate: null },
      { id: "ms_2", title: "Jalon 2", amount: 3000, dueDate: null },
    ]);

    mockTx.offer.update.mockResolvedValue({ ...baseOffer, status: "ACCEPTED", acceptedAt: new Date() });
    mockTx.application.update.mockResolvedValue({ id: "app_123", status: "OFFER_ACCEPTED" });
    mockTx.contract.create.mockResolvedValue({ id: "contract_123", milestones: [] });
    mockTx.milestone.create.mockResolvedValue({ id: "ms_new" });
    mockTx.milestone.findMany.mockResolvedValue([]);
    mockTx.applicationStatusHistory.create.mockResolvedValue({});

    // Le post-acceptation appelle contract.update pour passer en ACTIVE
    mockContractUpdate.mockResolvedValue({
      id: "contract_123", status: "ACTIVE", escrowId: "esc_123", milestones: [],
    });
  });

  it("A001 — accepte une offre SENT → ACCEPTED", async () => {
    const result = await OfferService.acceptOffer("offer_123", "user_fl");

    expect(result.offer.status).toBe("ACCEPTED");
    expect(result.offer.acceptedAt).toBeDefined();
  });

  it("A002 — crée un contrat lors de l'acceptation", async () => {
    const result = await OfferService.acceptOffer("offer_123", "user_fl");

    expect(result.contract).toBeDefined();
    expect(result.contract.id).toBe("contract_123");
    expect(mockTx.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          offerId: "offer_123",
          missionId: "mission_1",
          status: "PENDING",
        }),
      })
    );
  });

  it("A003 — copie les jalons de l'offre vers le contrat", async () => {
    mockTx.milestone.findMany.mockResolvedValue([
      { id: "ms_1", title: "Jalon 1", amount: 2000, dueDate: null, executionRate: 100, description: null },
      { id: "ms_2", title: "Jalon 2", amount: 3000, dueDate: null, executionRate: 100, description: null },
    ]);

    await OfferService.acceptOffer("offer_123", "user_fl");

    // 2 jalons → 2 appels à milestone.create dans la transaction
    expect(mockTx.milestone.create).toHaveBeenCalledTimes(2);
  });

  it("A004 — refuse d'accepter une offre DRAFT", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({ ...baseOffer, status: "DRAFT" });

    await expect(
      OfferService.acceptOffer("offer_123", "user_fl")
    ).rejects.toThrow("Cannot accept offer with status DRAFT");
  });

  it("A005 — refuse d'accepter une offre expirée", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({
      ...baseOffer,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // hier
    });

    await expect(
      OfferService.acceptOffer("offer_123", "user_fl")
    ).rejects.toThrow("Offer has expired");
  });
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — NEGOTIATE OFFER (contre-propositions, max 3 rounds)
// ═══════════════════════════════════════════════

describe("OfferService.negotiateOffer", () => {
  const milestone1 = { id: "ms_1", offerId: "offer_123", amount: 2000, dueDate: new Date("2026-08-15"), originalAmount: null, originalDueDate: null };
  const milestone2 = { id: "ms_2", offerId: "offer_123", amount: 3000, dueDate: new Date("2026-09-01"), originalAmount: null, originalDueDate: null };

  const baseOffer = {
    id: "offer_123",
    applicationId: "app_123",
    title: "Développement module paiement",
    status: "SENT",
    offerType: "FIXED",
    totalBudget: 5000,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    negotiationRounds: 0,
    lastCounterBy: null as string | null,
    milestones: [milestone1, milestone2],
    application: {
      id: "app_123",
      status: "OFFER_SENT",
      mission: {
        id: "mission_1",
        title: "Mission test",
        client: {
          id: "client_1",
          user: { id: "user_client", email: "client@test.com", firstName: "Pierre", lastName: "Durand" },
        },
      },
      freelancer: {
        id: "fl_1",
        user: { id: "user_fl", email: "freelance@test.com", firstName: "Jean", lastName: "Martin" },
      },
    },
  };

  beforeEach(() => {
    mockOfferFindUniqueOrThrow.mockResolvedValue(baseOffer);
    mockMilestoneUpdate.mockResolvedValue({});
    mockMilestoneFindMany.mockResolvedValue([
      { ...milestone1, amount: 1800 },
      { ...milestone2, amount: 3000 },
    ]);
    mockOfferUpdate.mockResolvedValue({
      ...baseOffer,
      status: "COUNTERED",
      negotiationRounds: 1,
      lastCounterBy: "FREELANCER",
      totalBudget: 4800,
    });
    mockApplicationUpdate.mockResolvedValue({ id: "app_123", status: "OFFER_DECLINED" });
    mockStatusHistoryCreate.mockResolvedValue({});
  });

  it("NG001 — le freelance contre-propose sur une offre SENT (round 1)", async () => {
    const result = await OfferService.negotiateOffer(
      "offer_123",
      "user_fl",
      [{ milestoneId: "ms_1", amount: 1800 }],
      "Un peu juste sur le budget"
    );

    expect(result.autoDeclined).toBe(false);
    expect(result.offer.status).toBe("COUNTERED");
    expect(result.remainingRounds).toBe(2);
    expect(mockOfferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COUNTERED",
          negotiationRounds: 1,
          lastCounterBy: "FREELANCER",
        }),
      })
    );
  });

  it("NG002 — le client contre-propose en retour (round 2) après la contre-proposition du freelance", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({
      ...baseOffer,
      status: "COUNTERED",
      negotiationRounds: 1,
      lastCounterBy: "FREELANCER",
    });
    mockOfferUpdate.mockResolvedValue({
      ...baseOffer,
      status: "COUNTERED",
      negotiationRounds: 2,
      lastCounterBy: "CLIENT",
    });

    const result = await OfferService.negotiateOffer(
      "offer_123",
      "user_client",
      [{ milestoneId: "ms_1", amount: 1900 }],
      "Contre-offre du client"
    );

    expect(result.autoDeclined).toBe(false);
    expect(result.remainingRounds).toBe(1);
    expect(mockOfferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastCounterBy: "CLIENT", negotiationRounds: 2 }),
      })
    );
  });

  it("NG003 — refuse si c'est au tour de l'autre partie (même auteur que le dernier counter)", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({
      ...baseOffer,
      status: "COUNTERED",
      negotiationRounds: 1,
      lastCounterBy: "FREELANCER",
    });

    await expect(
      OfferService.negotiateOffer("offer_123", "user_fl", [{ milestoneId: "ms_1", amount: 1700 }])
    ).rejects.toThrow("En attente de la réponse de l'autre partie");
  });

  it("NG004 — refuse si un utilisateur non lié à l'offre tente de négocier", async () => {
    await expect(
      OfferService.negotiateOffer("offer_123", "user_intrus", [{ milestoneId: "ms_1", amount: 1700 }])
    ).rejects.toThrow("Utilisateur non autorisé à négocier cette offre");
  });

  it("NG005 — seul le freelance peut répondre à une offre initiale SENT", async () => {
    await expect(
      OfferService.negotiateOffer("offer_123", "user_client", [{ milestoneId: "ms_1", amount: 1700 }])
    ).rejects.toThrow("Seul le freelance peut répondre à une offre initiale");
  });

  it("NG006 — refuse automatiquement l'offre après 3 tentatives de négociation (limite atteinte)", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({
      ...baseOffer,
      status: "COUNTERED",
      negotiationRounds: 3,
      lastCounterBy: "FREELANCER",
    });
    mockOfferUpdate.mockResolvedValue({
      ...baseOffer,
      status: "DECLINED",
      declinedAt: new Date(),
      declineReason: "Nombre maximum de négociations atteint (3) — offre refusée automatiquement",
    });

    const result = await OfferService.negotiateOffer(
      "offer_123",
      "user_client",
      [{ milestoneId: "ms_1", amount: 1600 }]
    );

    expect(result.autoDeclined).toBe(true);
    expect(result.remainingRounds).toBe(0);
    expect(result.offer.status).toBe("DECLINED");
    expect(mockApplicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "OFFER_DECLINED" } })
    );
  });

  it("NG007 — refuse de négocier une offre expirée", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({
      ...baseOffer,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    await expect(
      OfferService.negotiateOffer("offer_123", "user_fl", [{ milestoneId: "ms_1", amount: 1700 }])
    ).rejects.toThrow("Impossible de contre-proposer une offre expirée");
  });

  it("NG008 — rejette une modification de jalon avec un montant <= 0", async () => {
    await expect(
      OfferService.negotiateOffer("offer_123", "user_fl", [{ milestoneId: "ms_1", amount: 0 }])
    ).rejects.toThrow("Le montant d'un jalon doit être supérieur à 0");
  });
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — DECLINE OFFER
// ═══════════════════════════════════════════════

describe("OfferService.declineOffer", () => {
  const baseOffer = {
    id: "offer_123",
    applicationId: "app_123",
    title: "Développement module paiement",
    status: "SENT",
    application: { id: "app_123", status: "OFFER_SENT" },
  };

  beforeEach(() => {
    mockOfferFindUniqueOrThrow.mockResolvedValue(baseOffer);
    mockOfferUpdate.mockResolvedValue({
      ...baseOffer,
      status: "DECLINED",
      declinedAt: new Date(),
      declineReason: "Budget trop bas",
    });
    mockApplicationUpdate.mockResolvedValue({ id: "app_123", status: "OFFER_DECLINED" });
    mockStatusHistoryCreate.mockResolvedValue({});
  });

  it("D001 — décline une offre SENT → DECLINED", async () => {
    const result = await OfferService.declineOffer("offer_123", "user_fl", "Budget trop bas");

    expect(result.status).toBe("DECLINED");
    expect(result.declineReason).toBe("Budget trop bas");
    expect(mockOfferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DECLINED" }),
      })
    );
  });

  it("D002 — met à jour l'application à OFFER_DECLINED", async () => {
    await OfferService.declineOffer("offer_123", "user_fl", "Disponibilité");

    expect(mockApplicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "OFFER_DECLINED" },
      })
    );
  });

  it("D003 — refuse de décliner une offre ACCEPTED", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({ ...baseOffer, status: "ACCEPTED" });

    await expect(
      OfferService.declineOffer("offer_123", "user_fl", "Raison")
    ).rejects.toThrow("Cannot decline offer with status ACCEPTED");
  });
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — WITHDRAW OFFER
// ═══════════════════════════════════════════════

describe("OfferService.withdrawOffer", () => {
  beforeEach(() => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({
      id: "offer_123",
      status: "SENT",
    });
    mockOfferUpdate.mockResolvedValue({
      id: "offer_123",
      status: "WITHDRAWN",
      declineReason: "Changement de périmètre",
    });
  });

  it("W001 — retire une offre SENT → WITHDRAWN", async () => {
    const result = await OfferService.withdrawOffer("offer_123", "Changement de périmètre");

    expect(result.status).toBe("WITHDRAWN");
    expect(mockOfferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "WITHDRAWN" }),
      })
    );
  });

  it("W002 — refuse de retirer une offre ACCEPTED", async () => {
    mockOfferFindUniqueOrThrow.mockResolvedValue({ id: "offer_123", status: "ACCEPTED" });

    await expect(
      OfferService.withdrawOffer("offer_123", "Raison")
    ).rejects.toThrow("Cannot withdraw offer with status ACCEPTED");
  });
});

// ═══════════════════════════════════════════════
// OFFER SERVICE — EXPIRE OLD OFFERS
// ═══════════════════════════════════════════════

describe("OfferService.expireOldOffers", () => {
  it("E001 — expire les offres SENT avec expiresAt dépassé", async () => {
    mockOfferUpdateMany.mockResolvedValue({ count: 3 });

    const result = await OfferService.expireOldOffers();

    expect(mockOfferUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "SENT",
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: "EXPIRED" },
      })
    );
  });
});
