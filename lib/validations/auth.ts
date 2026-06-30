import { z } from "zod";

// ── Schéma existant (login) ──

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Étapes d'inscription multi-step ──

/// Étape 1 : Création du compte (commun à tous)
export const registerStep1Schema = z.object({
  firstName: z.string().min(1, "Le prénom est requis").max(100),
  lastName: z.string().min(1, "Le nom est requis").max(100),
  phone: z.string().min(8, "Le téléphone doit contenir au moins 8 chiffres")
    .regex(/^[+\d][\d\s.-]{7,}$/, "Numéro de téléphone invalide"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
  role: z.enum(["client", "prestataire"]).default("client"),
  cguAccepted: z.boolean().refine((v) => v === true, "Vous devez accepter les CGU"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export type RegisterStep1Input = z.infer<typeof registerStep1Schema>;

/// Étape 2 : Localisation (adresse principale)
export const registerStep2Schema = z.object({
  pays: z.string().min(1, "Le pays est requis"),
  ville: z.string().min(1, "La ville est requise"),
  arrondissement: z.string().optional(),
  quartier: z.string().min(1, "Le quartier est requis"),
  adresseDetaillee: z.string().min(1, "L'adresse détaillée est requise"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type RegisterStep2Input = z.infer<typeof registerStep2Schema>;

/// Étape 3 : Validation OTP
export const registerStep3Schema = z.object({
  code: z.string().length(6, "Le code OTP doit contenir 6 chiffres")
    .regex(/^\d{6}$/, "Le code OTP doit être numérique"),
  phone: z.string().min(8, "Numéro de téléphone invalide"),
});

export type RegisterStep3Input = z.infer<typeof registerStep3Schema>;

/// Demande de code OTP
export const requestOtpSchema = z.object({
  phone: z.string().min(8, "Numéro de téléphone invalide"),
  type: z.enum(["VERIFICATION_PHONE", "RESET_PASSWORD"]).default("VERIFICATION_PHONE"),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

// ── Module "Devenir prestataire" ──

/// Étape 2 : Vérification d'identité (une seule fois par utilisateur)
export const verificationIdentiteSchema = z.object({
  pieceType: z.enum(["CARTE_NATIONALE", "PASSEPORT", "PERMIS"]),
  numeroPiece: z.string().min(3, "Le numéro de pièce doit contenir au moins 3 caractères"),
  photoRecto: z.string().min(1, "La photo recto est requise"),
  photoVerso: z.string().optional(),
  selfieUrl: z.string().optional(),
});

export type VerificationIdentiteInput = z.infer<typeof verificationIdentiteSchema>;

/// Étape 5 : Ajout d'un métier
export const ajoutMetierSchema = z.object({
  metierId: z.string().min(1, "Le métier est requis"),
  experience: z.enum(["DEBUTANT", "UN_A_TROIS_ANS", "TROIS_A_CINQ_ANS", "PLUS_DE_CINQ_ANS"]).optional(),
  description: z.string().max(2000, "La description ne doit pas dépasser 2000 caractères").optional(),
  modeTarification: z.enum(["HORAIRE", "JOURNALIER", "HEBDOMADAIRE", "MENSUEL", "PAR_PRESTATION"]).default("PAR_PRESTATION"),
});

export type AjoutMetierInput = z.infer<typeof ajoutMetierSchema>;

/// Étape 6 : Tarifs par service
export const prestataireServiceSchema = z.object({
  prestataireMetierId: z.string().min(1, "Le métier prestataire est requis"),
  services: z.array(z.object({
    serviceId: z.string().min(1, "Le service est requis"),
    prix: z.number().positive("Le prix doit être positif"),
    description: z.string().optional(),
  })).min(1, "Au moins un service doit être proposé"),
});

export type PrestataireServiceInput = z.infer<typeof prestataireServiceSchema>;

/// Étape 7 : Disponibilités
export const disponibiliteSchema = z.object({
  prestataireMetierId: z.string().min(1, "Le métier prestataire est requis"),
  disponibilites: z.array(z.object({
    jourSemaine: z.enum(["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]),
    heureDebut: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format invalide (HH:mm)"),
    heureFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format invalide (HH:mm)"),
  })).min(1, "Au moins un jour de disponibilité est requis"),
});

export type DisponibiliteInput = z.infer<typeof disponibiliteSchema>;

/// Zone d'intervention
export const zoneInterventionSchema = z.object({
  prestataireMetierId: z.string().min(1, "Le métier prestataire est requis"),
  ville: z.string().min(1, "La ville est requise"),
  arrondissement: z.string().optional(),
  quartier: z.string().optional(),
  rayonKm: z.number().int().min(1).max(50).default(10),
});

export type ZoneInterventionInput = z.infer<typeof zoneInterventionSchema>;

// ── Demande de service (client) ──

export const demandeServiceSchema = z.object({
  categorieId: z.string().min(1, "La catégorie est requise"),
  serviceId: z.string().min(1, "Le service est requis"),
  description: z.string().min(10, "Décrivez votre problème (au moins 10 caractères)").max(5000),
  photos: z.array(z.string()).optional(),
  adresseId: z.string().optional(),
  // Adresse inline si pas d'adresse existante
  adresse: z.object({
    ville: z.string().min(1, "La ville est requise"),
    arrondissement: z.string().optional(),
    quartier: z.string().min(1, "Le quartier est requis"),
    adresseDetaillee: z.string().min(1, "L'adresse détaillée est requise"),
  }).optional(),
  dateSouhaitee: z.string().optional(), // ISO date string
  heureSouhaitee: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format invalide (HH:mm)").optional(),
  budgetPropose: z.number().positive("Le budget proposé doit être positif").optional(),
});

export type DemandeServiceInput = z.infer<typeof demandeServiceSchema>;

// ── Schémas dépréciés (conservés pour compatibilité) ──

/** @deprecated Utiliser registerStep1Schema */
// Compatibilité: ancien schéma utilisait `name` (min 2) et `role`.
export const registerSchema = z.object({
  name: z.string().min(2, "Le nom complet est requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  country: z.string().optional(),
  role: z.enum(["FREELANCER", "CLIENT"]).default("FREELANCER"),
});

/** @deprecated */
export const registerFreelancerSchema = registerSchema.extend({
  profileType: z.literal("FREELANCER"),
  skills: z.string().optional(),
  hourlyRate: z.number().positive("Le taux horaire doit être positif").optional(),
  experience: z.string().optional(),
});

/** @deprecated */
export const registerClientSchema = registerSchema.extend({
  profileType: z.literal("CLIENT"),
  companyName: z.string().optional(),
  companySector: z.string().optional(),
  description: z.string().optional(),
});

/** @deprecated */
export const switchProfileSchema = z.object({
  targetProfile: z.enum(["FREELANCER", "CLIENT"]),
});

// Types (dépréciés)
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFreelancerInput = z.infer<typeof registerFreelancerSchema>;
export type RegisterClientInput = z.infer<typeof registerClientSchema>;
