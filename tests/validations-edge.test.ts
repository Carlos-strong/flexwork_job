import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("lib/validations/auth.ts — cas limites", () => {
  it("email avec espaces → rejeté", () => {
    const r = loginSchema.safeParse({ email: " a@b.com ", password: "123456" });
    expect(r.success).toBe(false); // Zod n'auto-trim pas
  });

  it("nom avec uniquement des espaces → accepté (Zod compte les caractères)", () => {
    const r = registerSchema.safeParse({ name: "   ", email: "a@b.com", password: "12345678", role: "FREELANCER" });
    // "   " a 3 caractères donc passe min(2)
    expect(r.success).toBe(true);
  });

  it("email de 250 caractères → accepté", () => {
    const longEmail = "a".repeat(240) + "@b.com";
    const r = registerSchema.safeParse({ name: "OK", email: longEmail, password: "12345678", role: "CLIENT" });
    expect(r.success).toBe(true);
  });

  it("password exactement 8 caractères → OK", () => {
    const r = registerSchema.safeParse({ name: "Bob", email: "b@b.com", password: "12345678", role: "FREELANCER" });
    expect(r.success).toBe(true);
  });

  it("rôle CLIENT → OK", () => {
    const r = registerSchema.safeParse({ name: "Alice", email: "a@b.com", password: "12345678", role: "CLIENT" });
    expect(r.success).toBe(true);
  });

  it("rôle FREELANCER → OK", () => {
    const r = registerSchema.safeParse({ name: "Bob", email: "b@b.com", password: "12345678", role: "FREELANCER" });
    expect(r.success).toBe(true);
  });
});
