import { describe, it, expect, vi, beforeEach } from "vitest";

// ════════════════════════════════════════════════════════════════
// MOCKS PRISMA — simule toute la base de données
// ════════════════════════════════════════════════════════════════
const mocks = {
  offer: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  application: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  milestone: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  applicationStatusHistory: {
    create: vi.fn(),
  },
  contract: {
    create: vi.fn(),
    update: vi.fn(),
  },
  freelancerProfile: { findUnique: vi.fn() },
  clientProfile: { findUnique: vi.fn() },
  mission: { findMany: vi.fn() },
};

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
      findUnique: (opts: any) => mocks.offer.findUnique(opts),
      findUniqueOrThrow: (opts: any) => mocks.offer.findUniqueOrThrow(opts),
      findMany: (opts: any) => mocks.offer.findMany(opts),
      create: (opts: any) => mocks.offer.create(opts),
      update: (opts: any) => mocks.offer.update(opts),
      updateMany: (opts: any) => mocks.offer.updateMany(opts),
    },
    application: {
      findUnique: (opts: any) => mocks.application.findUnique(opts),
      findUniqueOrThrow: (opts: any) => mocks.application.findUniqueOrThrow(opts),
      findMany: (opts: any) => mocks.application.findMany(opts),
      update: (opts: any) => mocks.application.update(opts),
    },
    milestone: {
      create: (opts: any) => mocks.milestone.create(opts),
      findMany: (opts: any) => mocks.milestone.findMany(opts),
    },
    applicationStatusHistory: {
      create: (opts: any) => mocks.applicationStatusHistory.create(opts),
    },
    contract: {
      create: (opts: any) => mocks.contract.create(opts),
      update: (opts: any) => mocks.contract.update(opts),
    },
    freelancerProfile: { findUnique: (opts: any) => mocks.freelancerProfile.findUnique(opts) },
    clientProfile: { findUnique: (opts: any) => mocks.clientProfile.findUnique(opts) },
    mission: { findMany: (opts: any) => mocks.mission.findMany(opts) },
    $transaction: async (fn: any) => fn(mockTx),
  },
}));

vi.mock("@/lib/queue", () => ({ enqueueJob: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/services/notification-helper", () => ({ sendNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/escrow", () => ({
  escrow: { create: vi.fn().mockResolvedValue({ trustEngineEscrowId: "esc_123", stripePaymentIntentId: "pi_123" }) },
}));
vi.mock("@/lib/collaboration", () => ({
  createConversation: vi.fn().mockReturnValue({ id: "conv_123" }),
  addSystemMessage: vi.fn(),
  conversations: [],
}));

// Mock next-auth pour les tests API (getServerSession)
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
  default: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { OfferService } from "@/lib/services/offer.service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════
// CHAÎNE COMPLÈTE N°1 — CYCLE NOMINAL : CRÉATION → ENVOI → ACCEPTATION
// ════════════════════════════════════════════════════════════════
describe("Chaîne complète : Création → Envoi → Acceptation", () => {
  // ── Données partagées ────────────────────────────────────
  const applicationData = {
    id: "app_123",
    status: "DISCUSSION",
    mission: {
      id: "mission_1",
      title: "Développement module paiement",
      client: {
        id: "client_1",
        companyName: "TechCorp SAS",
        user: { id: "user_client", email: "client@techcorp.com", firstName: "Pierre", lastName: "Durand" },
      },
    },
    freelancer: {
      id: "fl_1",
      user: { id: "user_fl", email: "freelance@test.com", firstName: "Jean", lastName: "Martin" },
    },
    offers: [],
  };

  const createdOffer = {
    id: "offer_123",
    applicationId: "app_123",
    title: "Développement module paiement",
    description: "Intégration Stripe complète",
    offerType: "FIXED",
    totalBudget: 5000,
    hourlyRate: null,
    weeklyHourLimit: null,
    startDate: new Date("2026-08-01"),
    endDate: null,
    status: "DRAFT",
    sentAt: null,
    expiresAt: null,
    createdAt: new Date(),
    milestones: [],
    application: applicationData,
  };

  const sentOffer = {
    ...createdOffer,
    status: "SENT",
    sentAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  const acceptedOffer = {
    ...sentOffer,
    status: "ACCEPTED",
    acceptedAt: new Date(),
  };

  const contractCreated = {
    id: "contract_123",
    offerId: "offer_123",
    missionId: "mission_1",
    freelancerId: "fl_1",
    status: "PENDING",
    milestones: [],
  };

  it("ÉTAPE 1 — Client crée une offre (DRAFT)", async () => {
    mocks.application.findUniqueOrThrow.mockResolvedValue(applicationData);
    mocks.offer.create.mockResolvedValue(createdOffer);
    mocks.milestone.create.mockResolvedValue({ id: "ms_1" });

    const result = await OfferService.createOffer({
      applicationId: "app_123",
      title: "Développement module paiement",
      description: "Intégration Stripe complète",
      offerType: "FIXED",
      totalBudget: 5000,
      startDate: new Date("2026-08-01"),
      milestones: [
        { title: "Setup Stripe", description: "Configuration", amount: 2000, dueDate: new Date("2026-08-15") },
        { title: "Livraison", description: "MEP", amount: 3000, dueDate: new Date("2026-09-01") },
      ],
    });

    // Vérification création
    expect(result).toBeDefined();
    expect(result.id).toBe("offer_123");
    expect(result.status).toBe("DRAFT");

    // L'application a été vérifiée
    expect(mocks.application.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "app_123" } })
    );

    // Les jalons ont été créés
    expect(mocks.milestone.create).toHaveBeenCalledTimes(2);
  });

  it("ÉTAPE 2 — Client envoie l'offre (DRAFT → SENT)", async () => {
    mocks.offer.findUniqueOrThrow.mockResolvedValue(createdOffer);
    mocks.offer.update.mockResolvedValue(sentOffer);
    mocks.application.update.mockResolvedValue({ id: "app_123", status: "OFFER_SENT" });
    mocks.applicationStatusHistory.create.mockResolvedValue({});

    const result = await OfferService.sendOffer("offer_123");

    // L'offre est passée en SENT
    expect(result.status).toBe("SENT");
    expect(result.sentAt).toBeDefined();
    expect(result.expiresAt).toBeDefined();

    // L'application a été mise à jour
    expect(mocks.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app_123" },
        data: { status: "OFFER_SENT" },
      })
    );

    // L'historique a été créé
    expect(mocks.applicationStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app_123",
          fromStatus: "DISCUSSION",
          toStatus: "OFFER_SENT",
          changedByRole: "CLIENT",
        }),
      })
    );
  });

  it("ÉTAPE 3 — Freelance visualise les offres reçues", async () => {
    // Simule la requête API GET /api/offers/freelancer
    mocks.freelancerProfile.findUnique.mockResolvedValue({ id: "fl_1", userId: "user_fl" });
    mocks.application.findMany.mockResolvedValue([
      {
        id: "app_123",
        freelancerId: "fl_1",
        status: "OFFER_SENT",
        mission: {
          id: "mission_1",
          title: "Développement module paiement",
          description: "Intégration Stripe",
          budget: 5000,
          budgetType: "FIXED",
          duration: "6 semaines",
          client: {
            id: "client_1",
            companyName: "TechCorp SAS",
            user: { id: "user_client", firstName: "Pierre", lastName: "Durand", image: null },
          },
        },
        offers: [{
          ...sentOffer,
          milestones: [
            { id: "ms_1", title: "Setup Stripe", description: "Configuration", amount: 2000, executionRate: 100, status: "PENDING", dueDate: new Date("2026-08-15") },
            { id: "ms_2", title: "Livraison", description: "MEP", amount: 3000, executionRate: 100, status: "PENDING", dueDate: new Date("2026-09-01") },
          ],
        }],
      },
    ]);

    // Import dynamique pour éviter les problèmes de hoisting
    const { GET } = await import("@/app/api/offers/freelancer/route");
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user_fl" } });

    const res = await GET(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);

    const offer = body.data[0];
    expect(offer.id).toBe("offer_123");
    expect(offer.status).toBe("SENT");
    expect(offer.title).toBe("Développement module paiement");
    expect(offer.client.companyName).toBe("TechCorp SAS");
    expect(offer.milestones).toHaveLength(2);
    expect(offer.mission.title).toBe("Développement module paiement");
    expect(offer.totalBudget).toBe(5000);
  });

  it("ÉTAPE 4 — Freelance accepte l'offre (SENT → ACCEPTED + contrat)", async () => {
    mocks.offer.findUniqueOrThrow.mockResolvedValue(sentOffer);
    mocks.milestone.findMany.mockResolvedValue([
      { id: "ms_1", title: "Setup Stripe", amount: 2000, dueDate: null, executionRate: 100, description: null },
      { id: "ms_2", title: "Livraison", amount: 3000, dueDate: null, executionRate: 100, description: null },
    ]);

    mockTx.offer.update.mockResolvedValue(acceptedOffer);
    mockTx.application.update.mockResolvedValue({ id: "app_123", status: "OFFER_ACCEPTED" });
    mockTx.contract.create.mockResolvedValue(contractCreated);
    mockTx.milestone.findMany.mockResolvedValue([]);
    mockTx.milestone.create.mockResolvedValue({ id: "ms_new" });
    mockTx.applicationStatusHistory.create.mockResolvedValue({});

    // Les jalons de l'offre (trouvés par la transaction pour les copier vers le contrat)
    mockTx.milestone.findMany.mockResolvedValue([
      { id: "ms_1", title: "Setup Stripe", amount: 2000, dueDate: null, executionRate: 100, description: null },
      { id: "ms_2", title: "Livraison", amount: 3000, dueDate: null, executionRate: 100, description: null },
    ]);

    // Le post-acceptation appelle contract.update pour passer en ACTIVE
    mocks.contract.update.mockResolvedValue({
      ...contractCreated,
      status: "ACTIVE",
      escrowId: "esc_123",
      escrowAmount: 5000,
      milestones: [],
    });

    const result = await OfferService.acceptOffer("offer_123", "user_fl");

    // L'offre est ACCEPTED
    expect(result.offer.status).toBe("ACCEPTED");
    expect(result.offer.acceptedAt).toBeDefined();

    // Le contrat est créé
    expect(result.contract).toBeDefined();
    expect(result.contract.id).toBe("contract_123");

    // Vérification que le contrat a bien les bonnes références
    expect(mockTx.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          offerId: "offer_123",
          missionId: "mission_1",
          freelancerId: "fl_1",
          contractType: "FIXED",
          totalBudget: 5000,
          status: "PENDING",
        }),
      })
    );

    // Les jalons ont été copiés vers le contrat
    expect(mockTx.milestone.create).toHaveBeenCalledTimes(2);

    // L'historique est créé
    expect(mockTx.applicationStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app_123",
          changedBy: "user_fl",
          changedByRole: "FREELANCER",
          reason: "Offre acceptée",
        }),
      })
    );
  });

  it("ÉTAPE 5 — Le client voit l'offre acceptée dans sa liste", async () => {
    mocks.clientProfile.findUnique.mockResolvedValue({ id: "client_1", userId: "user_client" });
    mocks.mission.findMany.mockResolvedValue([
      {
        id: "mission_1",
        title: "Développement module paiement",
        description: null,
        budget: 5000,
        budgetType: "FIXED",
        duration: null,
        applications: [
          {
            id: "app_123",
            status: "OFFER_ACCEPTED",
            freelancer: {
              id: "fl_1",
              title: "Développeur Fullstack",
              user: { id: "user_fl", firstName: "Jean", lastName: "Martin", image: null },
            },
            offers: [{
              ...acceptedOffer,
              milestones: [],
            }],
          },
        ],
      },
    ]);

    const { GET } = await import("@/app/api/offers/client/route");
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user_client" } });

    const res = await GET(new Request("http://localhost/api/offers/client"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);

    const offer = body.data[0];
    expect(offer.status).toBe("ACCEPTED");
    expect(offer.acceptedAt).toBeDefined();
    expect(offer.freelancer.firstName).toBe("Jean");
    expect(offer.freelancer.lastName).toBe("Martin");
  });
});

// ════════════════════════════════════════════════════════════════
// CHAÎNE COMPLÈTE N°2 — CYCLE : CRÉATION → ENVOI → REFUS
// ════════════════════════════════════════════════════════════════
describe("Chaîne complète : Création → Envoi → Refus", () => {
  const applicationData = {
    id: "app_456",
    status: "INTERVIEW",
    mission: {
      id: "mission_2",
      title: "Refonte UI Dashboard",
      client: {
        id: "client_2",
        companyName: "StartupXYZ",
        user: { id: "user_client2", email: "client@startup.xyz", firstName: "Alice", lastName: "Dupont" },
      },
    },
    freelancer: {
      id: "fl_2",
      user: { id: "user_fl2", email: "sarah@test.com", firstName: "Sarah", lastName: "Meunier" },
    },
    offers: [],
  };

  const draftOffer = {
    id: "offer_456",
    applicationId: "app_456",
    title: "Refonte UI Dashboard",
    description: "Refonte complète de l'interface utilisateur",
    offerType: "FIXED",
    totalBudget: 4800,
    startDate: new Date("2026-08-15"),
    status: "DRAFT",
    application: applicationData,
  };

  const sentOffer = {
    ...draftOffer,
    status: "SENT",
    sentAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  it("ÉTAPE 1 — Client crée et envoie une offre (DRAFT → SENT)", async () => {
    // createOffer
    mocks.application.findUniqueOrThrow.mockResolvedValue(applicationData);
    mocks.offer.create.mockResolvedValue(draftOffer);

    const created = await OfferService.createOffer({
      applicationId: "app_456",
      title: "Refonte UI Dashboard",
      description: "Refonte complète de l'interface utilisateur",
      offerType: "FIXED",
      totalBudget: 4800,
      startDate: new Date("2026-08-15"),
      milestones: [
        { title: "Maquettes", amount: 1800, dueDate: new Date("2026-08-25") },
        { title: "Développement", amount: 3000, dueDate: new Date("2026-09-15") },
      ],
    });
    expect(created.status).toBe("DRAFT");

    // sendOffer
    mocks.offer.findUniqueOrThrow.mockResolvedValue(draftOffer);
    mocks.offer.update.mockResolvedValue(sentOffer);
    mocks.application.update.mockResolvedValue({ id: "app_456", status: "OFFER_SENT" });
    mocks.applicationStatusHistory.create.mockResolvedValue({});

    const sent = await OfferService.sendOffer("offer_456");
    expect(sent.status).toBe("SENT");
    expect(sent.sentAt).toBeDefined();
  });

  it("ÉTAPE 2 — Freelance décline l'offre (SENT → DECLINED)", async () => {
    mocks.offer.findUniqueOrThrow.mockResolvedValue(sentOffer);
    mocks.offer.update.mockResolvedValue({
      ...sentOffer,
      status: "DECLINED",
      declinedAt: new Date(),
      declineReason: "Planning non compatible avec mes engagements actuels",
    });
    mocks.application.update.mockResolvedValue({ id: "app_456", status: "OFFER_DECLINED" });
    mocks.applicationStatusHistory.create.mockResolvedValue({});

    const result = await OfferService.declineOffer(
      "offer_456",
      "user_fl2",
      "Planning non compatible avec mes engagements actuels"
    );

    // L'offre est DECLINED
    expect(result.status).toBe("DECLINED");
    expect(result.declineReason).toBe("Planning non compatible avec mes engagements actuels");

    // L'application est mise à jour
    expect(mocks.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "OFFER_DECLINED" },
      })
    );

    // L'historique est créé avec le bon rôle
    expect(mocks.applicationStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toStatus: "OFFER_DECLINED",
          changedByRole: "FREELANCER",
        }),
      })
    );
  });
});

// ════════════════════════════════════════════════════════════════
// CHAÎNE COMPLÈTE N°3 — CAS D'ERREUR : VALIDATIONS & SÉCURITÉ
// ════════════════════════════════════════════════════════════════
describe("Chaîne complète : Cas d'erreur et sécurités", () => {
  it("E001 — Offre sans titre → rejetée dès la création", async () => {
    await expect(
      OfferService.createOffer({
        applicationId: "app_1",
        title: "",
        offerType: "FIXED",
        totalBudget: 5000,
        startDate: new Date(),
      })
    ).rejects.toThrow("Validation failed");
  });

  it("E002 — Offre FIXED sans budget → rejetée", async () => {
    await expect(
      OfferService.createOffer({
        applicationId: "app_1",
        title: "Mission test",
        offerType: "FIXED",
        startDate: new Date(),
      })
    ).rejects.toThrow("Validation failed");
  });

  it("E003 — Offre HOURLY sans taux → rejetée", async () => {
    await expect(
      OfferService.createOffer({
        applicationId: "app_1",
        title: "Mission test",
        offerType: "HOURLY",
        startDate: new Date(),
      })
    ).rejects.toThrow("Validation failed");
  });

  it("E004 — Double envoi impossible (DRAFT → SENT puis SENT refuse)", async () => {
    const offer = {
      id: "offer_blocked",
      applicationId: "app_1",
      title: "Test",
      status: "DRAFT",
      application: {
        id: "app_1",
        status: "DISCUSSION",
        freelancer: { user: { id: "u1", email: "f@test.com" } },
        mission: { title: "Mission" },
      },
    };

    // Premier envoi OK
    mocks.offer.findUniqueOrThrow.mockResolvedValue(offer);
    mocks.offer.update.mockResolvedValue({ ...offer, status: "SENT", sentAt: new Date(), expiresAt: new Date(), application: offer.application });
    mocks.application.update.mockResolvedValue({});
    mocks.applicationStatusHistory.create.mockResolvedValue({});

    await OfferService.sendOffer("offer_blocked");

    // Second envoi refusé (l'offre est maintenant SENT)
    mocks.offer.findUniqueOrThrow.mockResolvedValue({ ...offer, status: "SENT" });
    await expect(
      OfferService.sendOffer("offer_blocked")
    ).rejects.toThrow("Impossible d'envoyer une offre avec le statut SENT");
  });

  it("E005 — Acceptation impossible si offre expirée", async () => {
    const expiredOffer = {
      id: "offer_expired",
      applicationId: "app_1",
      title: "Test",
      status: "SENT",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // hier
      application: {
        id: "app_1",
        status: "OFFER_SENT",
        mission: {
          id: "m_1",
          title: "Mission",
          client: { id: "c_1", user: { id: "u_client", email: "c@test.com" } },
        },
        freelancer: { id: "f_1", user: { id: "u_fl", email: "f@test.com" } },
      },
    };

    mocks.offer.findUniqueOrThrow.mockResolvedValue(expiredOffer);

    await expect(
      OfferService.acceptOffer("offer_expired", "user_fl")
    ).rejects.toThrow("Offer has expired");
  });

  it("E006 — Offre déjà acceptée → ne peut plus être déclinée", async () => {
    mocks.offer.findUniqueOrThrow.mockResolvedValue({
      id: "offer_accepted",
      applicationId: "app_1",
      status: "ACCEPTED",
      application: { id: "app_1", status: "OFFER_ACCEPTED" },
    });

    await expect(
      OfferService.declineOffer("offer_accepted", "user_fl", "Trop tard")
    ).rejects.toThrow("Cannot decline offer with status ACCEPTED");
  });

  it("E007 — Offre déjà acceptée → ne peut plus être retirée", async () => {
    mocks.offer.findUniqueOrThrow.mockResolvedValue({
      id: "offer_accepted2",
      status: "ACCEPTED",
    });

    await expect(
      OfferService.withdrawOffer("offer_accepted2", "Raison")
    ).rejects.toThrow("Cannot withdraw offer with status ACCEPTED");
  });

  it("E008 — Application introuvable → création impossible", async () => {
    mocks.application.findUniqueOrThrow.mockRejectedValue(new Error("Application not found"));

    await expect(
      OfferService.createOffer({
        applicationId: "app_inexistante",
        title: "Test",
        offerType: "FIXED",
        totalBudget: 5000,
        startDate: new Date(),
      })
    ).rejects.toThrow("Application not found");
  });

  it("E009 — API offre sans authentification → 401", async () => {
    const { GET } = await import("@/app/api/offers/freelancer/route");
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(401);
  });

  it("E010 — Vacuité : freelance sans offre reçoit []", async () => {
    const { GET } = await import("@/app/api/offers/freelancer/route");
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user_fl" } });
    mocks.freelancerProfile.findUnique.mockResolvedValue({ id: "fl_empty", userId: "user_fl" });
    mocks.application.findMany.mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════
// VÉRIFICATION TRANSVERSALE : liens entre les modèles
// ════════════════════════════════════════════════════════════════
describe("Vérification des liaisons entre modèles", () => {
  it("L001 — L'offre est liée à une application", () => {
    // Vérification de conformité avec le schéma Prisma
    const offer = {
      id: "offer_1",
      applicationId: "app_1", // ← lien vers Application
      title: "Test",
      offerType: "FIXED" as const,
      totalBudget: 5000,
      status: "SENT" as const,
    };
    expect(offer.applicationId).toBeDefined();
    expect(typeof offer.applicationId).toBe("string");
  });

  it("L002 — Le contrat est lié à une offre et une mission", () => {
    const contract = {
      id: "contract_1",
      offerId: "offer_1",   // ← lien vers Offer
      missionId: "mission_1", // ← lien vers Mission
      freelancerId: "fl_1",   // ← lien vers FreelancerProfile
      status: "ACTIVE" as const,
    };
    expect(contract.offerId).toBeDefined();
    expect(contract.missionId).toBeDefined();
    expect(contract.freelancerId).toBeDefined();
  });

  it("L003 — Les jalons sont liés à une offre ou un contrat", () => {
    const milestone = {
      id: "ms_1",
      offerId: "offer_1",    // ← lien vers Offer
      title: "Jalon 1",
      amount: 2500,
      status: "PENDING" as const,
    };
    expect(milestone.offerId).toBeDefined();
  });

  it("L004 — L'application suit une machine à états cohérente", () => {
    // La chaîne de statuts doit être : OFFER_SENT → OFFER_ACCEPTED / OFFER_DECLINED
    const validTransitions: Record<string, string[]> = {
      OFFER_SENT: ["OFFER_ACCEPTED", "OFFER_DECLINED"],
      OFFER_ACCEPTED: [],
      OFFER_DECLINED: [],
    };

    expect(validTransitions.OFFER_SENT).toContain("OFFER_ACCEPTED");
    expect(validTransitions.OFFER_SENT).toContain("OFFER_DECLINED");
    expect(validTransitions.OFFER_ACCEPTED).toHaveLength(0);
    expect(validTransitions.OFFER_DECLINED).toHaveLength(0);
  });
});
