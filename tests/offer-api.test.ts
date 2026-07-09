import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    freelancerProfile: { findUnique: (opts: any) => mockFindUnique(opts) },
    clientProfile: { findUnique: (opts: any) => mockFindUnique(opts) },
    application: { findMany: (opts: any) => mockFindMany(opts) },
    mission: { findMany: (opts: any) => mockFindMany(opts) },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "user_test", email: "test@test.com", name: "Test User" },
  }),
  default: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { GET as getFreelancerOffers } from "@/app/api/offers/freelancer/route";
import { GET as getClientOffers } from "@/app/api/offers/client/route";

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════
// GET /api/offers/freelancer
// ═══════════════════════════════════════════════

describe("GET /api/offers/freelancer", () => {
  it("F001 — retourne 401 si non authentifié", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await getFreelancerOffers(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Non authentifié");
  });

  it("F002 — retourne 404 si profil freelance introuvable", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await getFreelancerOffers(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Profil freelance introuvable");
  });

  it("F003 — retourne une liste d'offres pour le freelance", async () => {
    // Profil freelance trouvé
    mockFindUnique.mockResolvedValue({ id: "fl_1", userId: "user_test" });

    // Applications avec offres
    mockFindMany.mockResolvedValue([
      {
        id: "app_1",
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
        offers: [
          {
            id: "offer_1",
            applicationId: "app_1",
            title: "Développement module paiement",
            description: "Intégration Stripe complète",
            offerType: "FIXED",
            totalBudget: 5000,
            hourlyRate: null,
            weeklyHourLimit: null,
            startDate: new Date("2026-08-01"),
            endDate: null,
            status: "SENT",
            sentAt: new Date("2026-07-06"),
            expiresAt: new Date("2026-07-13"),
            acceptedAt: null,
            declinedAt: null,
            declineReason: null,
            createdAt: new Date("2026-07-06"),
            milestones: [
              {
                id: "ms_1",
                title: "Setup Stripe",
                description: "Configuration initiale",
                amount: 2000,
                executionRate: 100,
                status: "PENDING",
                dueDate: new Date("2026-08-15"),
              },
              {
                id: "ms_2",
                title: "Livraison finale",
                description: "Tests et mise en production",
                amount: 3000,
                executionRate: 100,
                status: "PENDING",
                dueDate: new Date("2026-09-01"),
              },
            ],
          },
        ],
      },
    ]);

    const res = await getFreelancerOffers(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);

    const offer = body.data[0];
    expect(offer.id).toBe("offer_1");
    expect(offer.title).toBe("Développement module paiement");
    expect(offer.offerType).toBe("FIXED");
    expect(offer.totalBudget).toBe(5000);
    expect(offer.status).toBe("SENT");
    expect(offer.client.companyName).toBe("TechCorp SAS");
    expect(offer.milestones).toHaveLength(2);
    expect(offer.mission.title).toBe("Développement module paiement");
  });

  it("F004 — retourne [] si aucune offre", async () => {
    mockFindUnique.mockResolvedValue({ id: "fl_1", userId: "user_test" });
    mockFindMany.mockResolvedValue([]);

    const res = await getFreelancerOffers(new Request("http://localhost/api/offers/freelancer"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// GET /api/offers/client
// ═══════════════════════════════════════════════

describe("GET /api/offers/client", () => {
  it("C001 — retourne 401 si non authentifié", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await getClientOffers(new Request("http://localhost/api/offers/client"));
    expect(res.status).toBe(401);
  });

  it("C002 — retourne 404 si profil client introuvable", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await getClientOffers(new Request("http://localhost/api/offers/client"));
    expect(res.status).toBe(404);
  });

  it("C003 — retourne la liste des offres envoyées par le client", async () => {
    // Profil client trouvé
    mockFindUnique.mockResolvedValue({ id: "client_1", userId: "user_test" });

    // Missions avec applications et offres
    mockFindMany.mockResolvedValue([
      {
        id: "mission_1",
        title: "Développement module paiement",
        description: "Intégration Stripe",
        budget: 5000,
        budgetType: "FIXED",
        duration: "6 semaines",
        applications: [
          {
            id: "app_1",
            status: "OFFER_SENT",
            freelancer: {
              id: "fl_1",
              title: "Développeur Fullstack",
              user: {
                id: "user_freelance",
                firstName: "Jean",
                lastName: "Martin",
                image: null,
              },
            },
            offers: [
              {
                id: "offer_1",
                applicationId: "app_1",
                title: "Développement module paiement",
                description: "Proposition pour intégration Stripe",
                offerType: "FIXED",
                totalBudget: 5000,
                hourlyRate: null,
                weeklyHourLimit: null,
                startDate: new Date("2026-08-01"),
                endDate: null,
                status: "SENT",
                sentAt: new Date("2026-07-06"),
                expiresAt: new Date("2026-07-13"),
                acceptedAt: null,
                declinedAt: null,
                declineReason: null,
                createdAt: new Date("2026-07-06"),
                milestones: [
                  {
                    id: "ms_1",
                    title: "Jalon 1",
                    description: null,
                    amount: 2500,
                    executionRate: 100,
                    status: "PENDING",
                    dueDate: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const res = await getClientOffers(new Request("http://localhost/api/offers/client"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);

    const offer = body.data[0];
    expect(offer.id).toBe("offer_1");
    expect(offer.title).toBe("Développement module paiement");
    expect(offer.freelancer.firstName).toBe("Jean");
    expect(offer.freelancer.lastName).toBe("Martin");
    expect(offer.freelancer.title).toBe("Développeur Fullstack");
    expect(offer.status).toBe("SENT");
    expect(offer.milestones).toHaveLength(1);
  });

  it("C004 — retourne [] si aucune offre envoyée", async () => {
    mockFindUnique.mockResolvedValue({ id: "client_1", userId: "user_test" });
    mockFindMany.mockResolvedValue([]);

    const res = await getClientOffers(new Request("http://localhost/api/offers/client"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("C005 — inclut les offres acceptées et déclinées", async () => {
    mockFindUnique.mockResolvedValue({ id: "client_1", userId: "user_test" });

    mockFindMany.mockResolvedValue([
      {
        id: "mission_1",
        title: "Site vitrine",
        description: null,
        budget: 3000,
        budgetType: "FIXED",
        duration: null,
        applications: [
          {
            id: "app_2",
            status: "OFFER_ACCEPTED",
            freelancer: {
              id: "fl_2",
              title: null,
              user: { id: "user_fl2", firstName: "Sarah", lastName: "Meunier", image: null },
            },
            offers: [
              {
                id: "offer_2",
                applicationId: "app_2",
                title: "Site vitrine",
                description: null,
                offerType: "FIXED",
                totalBudget: 3000,
                hourlyRate: null,
                weeklyHourLimit: null,
                startDate: new Date("2026-07-01"),
                endDate: null,
                status: "ACCEPTED",
                sentAt: new Date("2026-06-28"),
                expiresAt: null,
                acceptedAt: new Date("2026-07-02"),
                declinedAt: null,
                declineReason: null,
                createdAt: new Date("2026-06-28"),
                milestones: [],
              },
            ],
          },
          {
            id: "app_3",
            status: "OFFER_DECLINED",
            freelancer: {
              id: "fl_3",
              title: "Designer UX",
              user: { id: "user_fl3", firstName: "Lucas", lastName: "Bernard", image: null },
            },
            offers: [
              {
                id: "offer_3",
                applicationId: "app_3",
                title: "Refonte UI",
                description: null,
                offerType: "FIXED",
                totalBudget: 2500,
                hourlyRate: null,
                weeklyHourLimit: null,
                startDate: new Date("2026-07-15"),
                endDate: null,
                status: "DECLINED",
                sentAt: new Date("2026-07-01"),
                expiresAt: null,
                acceptedAt: null,
                declinedAt: new Date("2026-07-04"),
                declineReason: "Planning non compatible",
                createdAt: new Date("2026-07-01"),
                milestones: [],
              },
            ],
          },
        ],
      },
    ]);

    const res = await getClientOffers(new Request("http://localhost/api/offers/client"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);

    const accepted = body.data.find((o: any) => o.status === "ACCEPTED");
    expect(accepted).toBeDefined();
    expect(accepted.freelancer.lastName).toBe("Meunier");
    expect(accepted.acceptedAt).toBeDefined();

    const declined = body.data.find((o: any) => o.status === "DECLINED");
    expect(declined).toBeDefined();
    expect(declined.declineReason).toBe("Planning non compatible");
    expect(declined.freelancer.title).toBe("Designer UX");
  });
});
