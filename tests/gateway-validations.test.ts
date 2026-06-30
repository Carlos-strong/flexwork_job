import { describe, it, expect } from "vitest";
import {
  apiSuccess,
  apiError,
  apiPaginated,
  getPaginationParams,
} from "@/lib/api-gateway";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

// ═══════════════════════════════════════════════
// API GATEWAY
// ═══════════════════════════════════════════════

describe("lib/api-gateway.ts", () => {
  it("T036 — apiSuccess retourne { success: true, data }", async () => {
    const res = apiSuccess({ foo: "bar" });
    const json = await res.json();
    expect(json).toEqual({ success: true, data: { foo: "bar" } });
    expect(res.status).toBe(200);
  });

  it("T037 — apiError retourne { success: false, error }", async () => {
    const res = apiError("msg", 400);
    const json = await res.json();
    expect(json).toEqual({ success: false, error: "msg" });
    expect(res.status).toBe(400);
  });

  it("T037b — apiError avec statut 500", async () => {
    const res = apiError("server error", 500);
    expect(res.status).toBe(500);
  });

  it("T038 — apiPaginated pagination correcte", async () => {
    const res = apiPaginated([1, 2, 3], 1, 2, 10);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([1, 2, 3]);
    expect(json.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 10,
      totalPages: 5,
      hasMore: true,
    });
  });

  it("T044 — getPaginationParams valeurs par défaut", () => {
    const params = new URLSearchParams();
    const result = getPaginationParams(params);
    expect(result).toEqual({ page: 1, pageSize: 10, skip: 0 });
  });

  it("T044b — getPaginationParams page 3, size 5", () => {
    const params = new URLSearchParams("page=3&pageSize=5");
    const result = getPaginationParams(params);
    expect(result).toEqual({ page: 3, pageSize: 5, skip: 10 });
  });
});

// ═══════════════════════════════════════════════
// VALIDATIONS AUTH
// ═══════════════════════════════════════════════

describe("lib/validations/auth.ts", () => {
  it("T047 — loginSchema valide un bon couple email/mdp", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "123" });
    expect(result.success).toBe(true);
  });

  it("T048 — loginSchema rejette email invalide", () => {
    const result = loginSchema.safeParse({ email: "invalid", password: "" });
    expect(result.success).toBe(false);
  });

  it("T049 — registerSchema valide données complètes", () => {
    const result = registerSchema.safeParse({
      name: "Alice",
      email: "alice@test.com",
      password: "12345678",
      role: "CLIENT",
    });
    expect(result.success).toBe(true);
  });

  it("T050 — registerSchema rejette nom < 2 caractères", () => {
    const result = registerSchema.safeParse({
      name: "A",
      email: "a@b.com",
      password: "12345678",
      role: "FREELANCER",
    });
    expect(result.success).toBe(false);
  });

  it("T051 — registerSchema rejette password < 8", () => {
    const result = registerSchema.safeParse({
      name: "Bob",
      email: "bob@test.com",
      password: "123",
      role: "FREELANCER",
    });
    expect(result.success).toBe(false);
  });

  it("T052 — registerSchema rejette rôle invalide", () => {
    const result = registerSchema.safeParse({
      name: "Eve",
      email: "eve@test.com",
      password: "12345678",
      role: "HACKER",
    });
    expect(result.success).toBe(false);
  });
});
