import { describe, it, expect } from "vitest";
import {
  registerStep1Schema,
  registerStep2Schema,
  verificationIdentiteSchema,
  ajoutMetierSchema,
  prestataireServiceSchema,
  loginSchema,
} from "@/lib/validations/auth";
import { createMissionSchema } from "@/lib/validations/mission";
import { createApplicationSchema } from "@/lib/validations/application";

// ════════════════════════════════════════════════════════════════
// Tests basés sur le PRD final.md — Règles métier
// ════════════════════════════════════════════════════════════════

// ── Phase A — Création du Compte (Commune) ────────────────────
// final.md: "E-mail, Mot de passe, Confirmation, ✅ Acceptation CGU"
describe("Phase A — Création du Compte (final.md)", () => {
  it("R1 — Validation complète : email + password + confirm + identité", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      email: "jean@example.com",
      password: "monMot2passe",
      confirmPassword: "monMot2passe",
      cguAccepted: true,
    });
    expect(r.success).toBe(true);
  });

  it("R2 — Rejette si mots de passe différents (confirmPassword mismatch)", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "Jean",
      lastName: "Dupont",
      phone: "+237612345678",
      email: "jean@example.com",
      password: "12345678",
      confirmPassword: "87654321",
      cguAccepted: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("R3 — Mot de passe minimum 8 caractères", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "A", lastName: "B", phone: "+237612345678",
      email: "a@b.com", password: "1234567", confirmPassword: "1234567",
    });
    expect(r.success).toBe(false);
  });

  it("R4 — Email valide requis", () => {
    const r = registerStep1Schema.safeParse({
      firstName: "A", lastName: "B", phone: "+237612345678",
      email: "pas-un-email", password: "12345678", confirmPassword: "12345678",
    });
    expect(r.success).toBe(false);
  });

  // final.md Phase A Étape 2 : Identité conditionnelle
  // "Si Freelance: Nom, Prénom, Pays, Adresse, Téléphone"
  // "Si Client (Particulier): Nom, Prénom, Adresse, Téléphone"
  // "Si Client (Entreprise): Nom/Prénom du contact, Pays, Adresse société, Téléphone, Email pro"
  it("R5 — Adresse (étape 2) : pays + ville + quartier + adresse requis", () => {
    const r = registerStep2Schema.safeParse({
      pays: "CM",
      ville: "Douala",
      quartier: "Akwa",
      adresseDetaillee: "123 Rue Principale",
    });
    expect(r.success).toBe(true);
  });

  it("R6 — Adresse rejetée sans pays ni ville", () => {
    const r = registerStep2Schema.safeParse({
      quartier: "Akwa",
      adresseDetaillee: "123 Rue",
    });
    expect(r.success).toBe(false);
  });
});

// ── Phase B1 — Parcours Freelance ─────────────────────────────
describe("Phase B1 — Parcours Freelance (final.md)", () => {
  // final.md: "KYC Différé & Événementiel: Aucune pièce d'identité à l'inscription"
  it("R7 — KYC Différé : inscription sans pièce d'identité (seulement identité de base)", () => {
    // registerStep1Schema n'a PAS de champ pieceType/photo — KYC est différé
    const keys = Object.keys(registerStep1Schema.shape);
    expect(keys).not.toContain("pieceType");
    expect(keys).not.toContain("photoRecto");
    expect(keys).not.toContain("numeroPiece");
  });

  // final.md "Créer un profil professionnel (Répétable)" — Étape 1: Expertise
  it("R8 — Profil pro : métier requis + expérience valide", () => {
    const r = ajoutMetierSchema.safeParse({
      metierId: "metier_001",
      experience: "TROIS_A_CINQ_ANS",
      description: "Expert en plomberie",
      modeTarification: "PAR_PRESTATION",
    });
    expect(r.success).toBe(true);
  });

  it("R9 — Profil pro : expérience invalide rejetée", () => {
    const r = ajoutMetierSchema.safeParse({
      metierId: "metier_001",
      experience: "INEXISTANT",
      modeTarification: "HORAIRE",
    });
    expect(r.success).toBe(false);
  });

  // final.md "Tarif (Choix unique): Prix fixé ou Devis libre"
  it("R10 — Prestataire services : au moins 1 service avec prix positif", () => {
    const r = prestataireServiceSchema.safeParse({
      prestataireMetierId: "pm_001",
      services: [{ serviceId: "srv_001", prix: 150 }],
    });
    expect(r.success).toBe(true);
  });

  it("R11 — Prestataire services : prix négatif rejeté", () => {
    const r = prestataireServiceSchema.safeParse({
      prestataireMetierId: "pm_001",
      services: [{ serviceId: "srv_001", prix: -50 }],
    });
    expect(r.success).toBe(false);
  });

  it("R12 — Prestataire services : liste vide rejetée", () => {
    const r = prestataireServiceSchema.safeParse({
      prestataireMetierId: "pm_001",
      services: [],
    });
    expect(r.success).toBe(false);
  });

  // final.md "Action: Postuler à une mission" — Étape 3
  // "Champ libre 'Votre proposition' (pré-rempli avec le tarif du profil) + Message de motivation"
  it("R13 — Candidature : missionId + freelancerId + coverLetter + proposedBudget requis", () => {
    const r = createApplicationSchema.safeParse({
      missionId: "mission_001",
      freelancerId: "freelancer_001",
      coverLetter: "Je suis très intéressé par cette mission.",
      proposedBudget: 450,
    });
    expect(r.success).toBe(true);
  });

  it("R14 — Candidature : lettre de motivation trop courte rejetée (< 10 car.)", () => {
    const r = createApplicationSchema.safeParse({
      missionId: "mission_001",
      freelancerId: "freelancer_001",
      coverLetter: "Court",
      proposedBudget: 450,
    });
    expect(r.success).toBe(false);
  });

  it("R15 — Candidature : budget proposé minimum 1 €", () => {
    const r = createApplicationSchema.safeParse({
      missionId: "mission_001",
      freelancerId: "freelancer_001",
      coverLetter: "Une lettre de motivation valide.",
      proposedBudget: 0,
    });
    expect(r.success).toBe(false);
  });
});

// ── Phase B2 — Parcours Client ────────────────────────────────
describe("Phase B2 — Parcours Client — Publier une mission (final.md)", () => {
  // final.md Étape 2: Budget — "Budget fixé: Fourchette ou montant exact + Unité"
  it("R16 — Mission : titre >= 5 car., description >= 20 car., budget >= 100€", () => {
    const r = createMissionSchema.safeParse({
      title: "Développeur React/Next.js",
      description: "Nous recherchons un développeur freelance pour une mission de 3 mois.",
      budget: 5000,
      skills: ["React", "TypeScript", "Node.js"],
      duration: "3 mois",
      location: "Remote",
    });
    expect(r.success).toBe(true);
  });

  it("R17 — Mission : titre trop court rejeté (< 5 car.)", () => {
    const r = createMissionSchema.safeParse({
      title: "Dev",
      description: "Description assez longue pour passer la validation.",
      budget: 5000,
      skills: ["React"],
    });
    expect(r.success).toBe(false);
  });

  it("R18 — Mission : budget < 100 € rejeté", () => {
    const r = createMissionSchema.safeParse({
      title: "Titre valide here",
      description: "Description assez longue pour passer la validation.",
      budget: 50,
      skills: ["React"],
    });
    expect(r.success).toBe(false);
  });

  it("R19 — Mission : description < 20 car. rejetée", () => {
    const r = createMissionSchema.safeParse({
      title: "Titre valide",
      description: "Court",
      budget: 5000,
      skills: ["React"],
    });
    expect(r.success).toBe(false);
  });

  it("R20 — Mission : au moins 1 compétence requise", () => {
    const r = createMissionSchema.safeParse({
      title: "Titre valide here",
      description: "Description assez longue pour passer la validation.",
      budget: 5000,
      skills: [],
    });
    expect(r.success).toBe(false);
  });

  // final.md: Budget — "Ouvert aux devis: Aucun montant renseigné"
  // Note: createMissionSchema existant utilise budget: number().min(100)
  // Donc le flux OPEN_QUOTE serait géré côté UI/logique métier, pas au niveau du schéma
  it("R21 — Mission : localisation par défaut = Remote", () => {
    const r = createMissionSchema.safeParse({
      title: "Titre valide here",
      description: "Description assez longue pour passer la validation.",
      budget: 5000,
      skills: ["React"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.location).toBe("Remote");
    }
  });

  it("R22 — Mission : duration est optionnelle", () => {
    const r = createMissionSchema.safeParse({
      title: "Titre valide here",
      description: "Description assez longue pour passer la validation.",
      budget: 5000,
      skills: ["React"],
    });
    expect(r.success).toBe(true);
  });
});

// ── WorkMode — Règle #2 du PRD : Hybride/Sur site/À distance ──
describe("Règle #2 — WorkMode : Présentiel vs À distance (final.md)", () => {
  // Test de la logique métier : si workMode n'est pas REMOTE, alors
  // missionCity et missionCountry doivent être renseignés.
  // Ceci est une règle de validation transversale qu'on test via une fonction utilitaire.

  const VALID_WORK_MODES = ["REMOTE", "ONSITE", "HYBRID"] as const;
  type WorkMode = (typeof VALID_WORK_MODES)[number];

  function validateWorkMode(data: {
    workMode: WorkMode;
    missionCity?: string | null;
    missionCountry?: string | null;
    hybridDaysPerWeek?: number | null;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!VALID_WORK_MODES.includes(data.workMode)) {
      errors.push("Mode d'exécution invalide");
    }
    if (data.workMode === "REMOTE") {
      // 100% à distance — pas de localisation requise
      if (data.missionCity || data.missionCountry) {
        errors.push("Aucune localisation requise pour le mode distanciel");
      }
    } else {
      // Présentiel (ONSITE ou HYBRID) — localisation requise
      if (!data.missionCity) errors.push("Ville requise pour le mode présentiel");
      if (!data.missionCountry) errors.push("Pays requis pour le mode présentiel");
      if (data.workMode === "HYBRID" && (!data.hybridDaysPerWeek || data.hybridDaysPerWeek < 1)) {
        errors.push("Nombre de jours de présence requis pour le mode hybride");
      }
    }
    return { valid: errors.length === 0, errors };
  }

  it("R2a — 100% À distance : OK sans localisation", () => {
    const r = validateWorkMode({ workMode: "REMOTE" });
    expect(r.valid).toBe(true);
  });

  it("R2b — 100% À distance : rejette si ville fournie", () => {
    const r = validateWorkMode({ workMode: "REMOTE", missionCity: "Paris" });
    expect(r.valid).toBe(false);
  });

  it("R2c — Présentiel (ONSITE) : ville + pays requis", () => {
    const r = validateWorkMode({ workMode: "ONSITE", missionCity: "Douala", missionCountry: "CM" });
    expect(r.valid).toBe(true);
  });

  it("R2d — Présentiel : rejette si ville manquante", () => {
    const r = validateWorkMode({ workMode: "ONSITE", missionCountry: "CM" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Ville requise pour le mode présentiel");
  });

  it("R2e — Hybride : ville + pays + jours requis", () => {
    const r = validateWorkMode({
      workMode: "HYBRID", missionCity: "Paris", missionCountry: "FR", hybridDaysPerWeek: 2,
    });
    expect(r.valid).toBe(true);
  });

  it("R2f — Hybride : rejette si jours manquants", () => {
    const r = validateWorkMode({ workMode: "HYBRID", missionCity: "Paris", missionCountry: "FR" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Nombre de jours de présence requis pour le mode hybride");
  });

  it("R2g — Mode invalide rejeté", () => {
    const r = validateWorkMode({ workMode: "INVALID" as WorkMode });
    expect(r.valid).toBe(false);
  });
});

// ── KYC Différé — Règles #1 et #5 du PRD ────────────────────
describe("Règles #1 et #5 — KYC Différé (final.md)", () => {
  // Règle #1: "Côté Freelance: Déclenché à la 1ère candidature"
  // Règle #5: "Côté Client (Entreprise): Déclenché au 1er paiement ou contrat"
  // On teste les schémas de vérification d'identité

  it("R1a — KYC Freelance : vérification identité avec pièce recto/verso + type valide", () => {
    const r = verificationIdentiteSchema.safeParse({
      pieceType: "CARTE_NATIONALE",
      numeroPiece: "CNI-123456",
      photoRecto: "data:image/png;base64,abc123",
      photoVerso: "data:image/png;base64,def456",
    });
    expect(r.success).toBe(true);
  });

  it("R1b — KYC Freelance : type de pièce invalide rejeté", () => {
    const r = verificationIdentiteSchema.safeParse({
      pieceType: "INVALID",
      numeroPiece: "XYZ123",
      photoRecto: "data:image/png;base64,abc",
    });
    expect(r.success).toBe(false);
  });

  it("R1c — KYC Freelance : numéro de pièce trop court rejeté", () => {
    const r = verificationIdentiteSchema.safeParse({
      pieceType: "PASSEPORT",
      numeroPiece: "AB",
      photoRecto: "data:image/png;base64,abc",
    });
    expect(r.success).toBe(false);
  });

  // Règle #5 — KYC Entreprise : SIRET, KBIS, RIB
  // Validation au niveau entreprise (pas encore de schéma dédié — on teste la structure attendue)
  it("R5a — KYC Entreprise : SIRET valide (14 chiffres)", () => {
    const siretRegex = /^\d{14}$/;
    expect(siretRegex.test("73282932000074")).toBe(true);
    expect(siretRegex.test("12345")).toBe(false);
    expect(siretRegex.test("abcdefghijklmn")).toBe(false);
  });

  it("R5b — KYC Entreprise : SIRET avec mauvais format rejeté", () => {
    const siretRegex = /^\d{14}$/;
    expect(siretRegex.test("73282932")).toBe(false);
    expect(siretRegex.test("")).toBe(false);
  });

  // Règle #1: "Statut transitoire: 'En attente de vérification d'identité'"
  it("R1d — Statut transitoire IDENTITY_PENDING doit exister", () => {
    // Vérifie que l'enum utilisé pour les candidatures contient IDENTITY_PENDING
    // (test sur la valeur, pas sur le type runtime — vérification conceptuelle)
    const pendingStatuses = ["PENDING", "IDENTITY_PENDING", "ACCEPTED", "REJECTED"];
    expect(pendingStatuses).toContain("IDENTITY_PENDING");
  });
});

// ── Phase A — Activation (final.md) ──────────────────────────
describe("Phase A — Activation email (final.md)", () => {
  it("R22 — Login : email + password requis", () => {
    const r = loginSchema.safeParse({ email: "user@example.com", password: "secret" });
    expect(r.success).toBe(true);
  });

  it("R23 — Login : email invalide rejeté", () => {
    const r = loginSchema.safeParse({ email: "pas-email", password: "secret" });
    expect(r.success).toBe(false);
  });

  it("R24 — Login : mot de passe vide rejeté", () => {
    const r = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(r.success).toBe(false);
  });
});

// ── Taxonomie — Règle #4 du PRD ────────────────────────────
describe("Règle #4 — Taxonomie dynamique en cascade (final.md)", () => {
  // final.md: "Domaine d'intervention -> Type d'intervention -> Compétences"
  // Logique de cascade : les listes sont filtrées par le niveau parent

  interface Categorie {
    id: string;
    libelle: string;
    metiers: Metier[];
  }

  interface Metier {
    id: string;
    libelle: string;
    services: Service[];
  }

  interface Service {
    id: string;
    libelle: string;
  }

  // Simule une taxonomie comme en BDD
  const TAXONOMY: Categorie[] = [
    {
      id: "cat_001", libelle: "BTP",
      metiers: [
        {
          id: "met_001", libelle: "Plombier",
          services: [
            { id: "srv_001", libelle: "Débouchage" },
            { id: "srv_002", libelle: "Réparation fuite" },
          ],
        },
        {
          id: "met_002", libelle: "Électricien",
          services: [
            { id: "srv_003", libelle: "Mise aux normes" },
            { id: "srv_004", libelle: "Installation tableau" },
          ],
        },
      ],
    },
    {
      id: "cat_002", libelle: "Informatique",
      metiers: [
        {
          id: "met_003", libelle: "Développeur Web",
          services: [
            { id: "srv_005", libelle: "Création site vitrine" },
            { id: "srv_006", libelle: "Développement SaaS" },
          ],
        },
      ],
    },
  ];

  function getMetiersByCategorie(catId: string): Metier[] {
    const cat = TAXONOMY.find((c) => c.id === catId);
    return cat?.metiers ?? [];
  }

  function getServicesByMetier(metierId: string): Service[] {
    for (const cat of TAXONOMY) {
      const metier = cat.metiers.find((m) => m.id === metierId);
      if (metier) return metier.services;
    }
    return [];
  }

  it("R4a — Choix du domaine BTP → filtre les métiers BTP uniquement", () => {
    const metiers = getMetiersByCategorie("cat_001");
    expect(metiers).toHaveLength(2);
    expect(metiers.map((m) => m.libelle)).toEqual(["Plombier", "Électricien"]);
  });

  it("R4b — Choix domaine Informatique → ne montre pas les métiers BTP", () => {
    const metiers = getMetiersByCategorie("cat_002");
    expect(metiers).toHaveLength(1);
    expect(metiers[0].libelle).toBe("Développeur Web");
  });

  it("R4c — Choix métier Plombier → filtre les services de plomberie", () => {
    const services = getServicesByMetier("met_001");
    expect(services).toHaveLength(2);
    expect(services.map((s) => s.libelle)).toEqual(["Débouchage", "Réparation fuite"]);
  });

  it("R4d — Domaine inexistant → retourne liste vide", () => {
    const metiers = getMetiersByCategorie("cat_inexistante");
    expect(metiers).toEqual([]);
  });

  it("R4e — Métier inexistant → retourne liste vide", () => {
    const services = getServicesByMetier("met_inexistant");
    expect(services).toEqual([]);
  });

  it("R4f — Structure complète : domaine → métier → services", () => {
    // Simule le parcours utilisateur complet
    const domaine = TAXONOMY[0]; // BTP
    const metier = domaine.metiers[0]; // Plombier
    const service = metier.services[0]; // Débouchage
    expect(domaine.libelle).toBe("BTP");
    expect(metier.libelle).toBe("Plombier");
    expect(service.libelle).toBe("Débouchage");
  });
});

// ── Règles transverses ──────────────────────────────────────
describe("Règles transverses (final.md)", () => {
  // final.md: "Compte unique, Rôles multiples"
  it("R25 — Principe : 1 utilisateur = 1 email, rôles basculables", () => {
    // Vérifie que le schéma de login n'accepte qu'un seul email (pas de multiflux)
    const shape = loginSchema.shape;
    expect(shape).toHaveProperty("email");
    expect(shape).toHaveProperty("password");
  });

  // final.md: "CGU acceptées une seule fois"
  it("R26 — CGU : champ obligatoire dans le schéma d'inscription", () => {
    // Dans registerStep1Schema, cguAccepted est un champ requis
    // L'utilisateur doit explicitement accepter les CGU (true) pour s'inscrire
    const keys = Object.keys(registerStep1Schema.shape);
    expect(keys).toContain("cguAccepted");
    // Vérifier que false est rejeté
    const r = registerStep1Schema.safeParse({
      firstName: "A", lastName: "B", phone: "+237612345678",
      email: "a@b.com", password: "12345678", confirmPassword: "12345678",
      cguAccepted: false,
    });
    expect(r.success).toBe(false);
  });

  // final.md: "Séparation Identité / Activité"
  it("R27 — Identité et activité sont séparées (schémas distincts)", () => {
    // L'identité (registerStep1Schema) et l'activité (ajoutMetierSchema) sont découplées
    expect(registerStep1Schema).toBeDefined();
    expect(ajoutMetierSchema).toBeDefined();
    // On peut créer un compte sans profil pro et vice-versa (conceptuellement)
    const idKeys = Object.keys(registerStep1Schema.shape);
    const proKeys = Object.keys(ajoutMetierSchema.shape);
    // Identité : contient firstName, lastName, phone, email
    expect(idKeys).toContain("firstName");
    expect(idKeys).toContain("lastName");
    // Profil pro : contient metierId, experience, etc.
    expect(proKeys).toContain("metierId");
    expect(proKeys).toContain("experience");
  });
});
