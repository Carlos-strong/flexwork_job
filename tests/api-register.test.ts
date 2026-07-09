import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma and notifications before importing the route
const mockFindUnique = vi.fn();
const mockTx = {
  user: { create: vi.fn() },
  role: { findUnique: vi.fn() },
  userRole: { create: vi.fn() },
  clientProfile: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (opts: any) => mockFindUnique(opts) },
    $transaction: async (fn: any) => fn(mockTx),
  },
}));

// Mock bcryptjs : le test vérifie la logique d'inscription, pas la vitesse de hachage
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("$2a$12$mockedhash") },
  hash: vi.fn().mockResolvedValue("$2a$12$mockedhash"),
}));

vi.mock("@/lib/notifications", () => ({
  notifications: {
    welcome: vi.fn().mockResolvedValue(undefined),
    userRegistered: vi.fn().mockResolvedValue(undefined),
  },
}));

import { POST } from "@/app/api/auth/register/route";

beforeEach(() => {
  mockFindUnique.mockReset();
  mockTx.user.create.mockReset();
  mockTx.role.findUnique.mockReset();
  mockTx.userRole.create.mockReset();
  mockTx.clientProfile.create.mockReset();
});

describe("POST /api/auth/register (intégration mock)", () => {
  it("retourne 201 et userId quand création OK", async () => {
    mockFindUnique.mockResolvedValue(null); // pas d'user existant
    mockTx.user.create.mockResolvedValue({ id: "u1", phone: "+237612345678" });

    const body = {
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237 6 12 34 56 78",
      email: "jean@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: true,
      role: "client",
    };

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.userId).toBeDefined();
  });

  it("retourne 409 si le téléphone existe déjà", async () => {
    // Simuler téléphone existant
    mockFindUnique.mockImplementation(({ where }: any) => {
      if (where && where.phone) return Promise.resolve({ id: "u-exist" });
      return Promise.resolve(null);
    });

    const body = {
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      email: "new@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: true,
      role: "client",
    };

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBeDefined();
  });

  it("retourne 409 si l'email existe déjà", async () => {
    // Simuler email existant (phone inconnu, email existant)
    mockFindUnique.mockImplementation(({ where }: any) => {
      if (where && where.email) return Promise.resolve({ id: "u-email" });
      return Promise.resolve(null);
    });

    const body = {
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345679",
      email: "exist@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: true,
      role: "client",
    };

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBeDefined();
  });
});
