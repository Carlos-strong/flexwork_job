import { describe, it, expect } from "vitest";
import { registerStep1Schema } from "@/lib/validations/auth";

describe("registerStep1Schema — validations", () => {
  it("valide données complètes", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      email: "jean.dupont@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: true,
    });
    expect(r.success).toBe(true);
  });

  it("rejette CGU non acceptées", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      email: "jean.dupont@example.com",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: false,
    });
    expect(r.success).toBe(false);
  });

  it("rejette email manquant", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: true,
    });
    expect(r.success).toBe(false);
  });

  it("rejette mot de passe trop court", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      email: "a@b.com",
      password: "1234",
      confirmPassword: "1234",
      cguAccepted: true,
    });
    expect(r.success).toBe(false);
  });

  it("rejette téléphone invalide", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "123",
      email: "a@b.com",
      password: "12345678",
      confirmPassword: "12345678",
      cguAccepted: true,
    });
    expect(r.success).toBe(false);
  });
});
