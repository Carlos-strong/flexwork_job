/**
 * Module de recrutement TrustEngine
 *
 * Pipeline complet — Workflow client :
 *   SUBMITTED → UNREAD → READ → SHORTLISTED → DISCUSSION
 *   → INTERVIEW → OFFER_SENT → OFFER_ACCEPTED → CONTRACT
 *
 *   Dérivations : REJECTED, ARCHIVED, OFFER_DECLINED
 *   KYC : IDENTITY_PENDING (bloquant jusqu'à validation admin)
 *
 *   Legacy : UNDER_REVIEW, INTERVIEW_PENDING, INTERVIEW_COMPLETED,
 *   SELECTED, CONTRACT_PENDING, CONTRACT_ACCEPTED, ESCROW_PENDING, ACTIVE
 */

import { saveToDisk, loadFromDisk } from "@/lib/persist";

const STORAGE_KEY = "recruitment";

// ── Types ──────────────────────────────────────

/** Statuts orientés workflow client */
export type ApplicationStatus =
  //── Nouveau workflow ──
  | "SUBMITTED"         // Candidature soumise (→ UNREAD en base)
  | "UNREAD"            // En attente de lecture par le client
  | "READ"              // Lue par le client
  | "SHORTLISTED"       // Présélectionnée
  | "DISCUSSION"        // En discussion
  | "INTERVIEW"         // Entretien programmé
  | "OFFER_SENT"        // Offre envoyée
  | "OFFER_ACCEPTED"    // Offre acceptée → contrat
  | "OFFER_DECLINED"    // Offre refusée → retour shortlist
  | "ARCHIVED"          // Archivée
  //── KYC ──
  | "IDENTITY_PENDING"  // KYC freelance en attente de validation admin
  //── Legacy ──
  | "UNDER_REVIEW"
  | "INTERVIEW_PENDING"
  | "INTERVIEW_COMPLETED"
  | "SELECTED"
  | "CONTRACT_PENDING"
  | "CONTRACT_DECLINED"
  | "CONTRACT_ACCEPTED"
  | "ESCROW_PENDING"
  | "ACTIVE"
  //── Terminaux ──
  | "REJECTED"
  | "WITHDRAWN";

/** Transitions autorisées entre statuts */
export const ALLOWED_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED:       ["UNREAD", "READ"],   // PENDING (deprecated) → READ ou UNREAD
  UNREAD:          ["READ"],
  READ:            ["SHORTLISTED", "REJECTED", "ARCHIVED"],
  SHORTLISTED:     ["DISCUSSION", "REJECTED"],
  DISCUSSION:      ["INTERVIEW", "REJECTED"],
  INTERVIEW:       ["OFFER_SENT", "REJECTED"],
  OFFER_SENT:      ["OFFER_ACCEPTED", "OFFER_DECLINED"],
  OFFER_DECLINED:  ["SHORTLISTED"], // Retour aux candidats
  OFFER_ACCEPTED:  [],              // Terminal → contrat créé
  ARCHIVED:        ["READ"],        // Possibilité de désarchiver
  REJECTED:        [],              // Terminal
  WITHDRAWN:       [],              // Terminal
  IDENTITY_PENDING: ["UNREAD", "READ"], // Après validation KYC (READ si déjà validé entre-temps)
  UNDER_REVIEW:    ["SHORTLISTED", "REJECTED"],
  INTERVIEW_PENDING: ["INTERVIEW_COMPLETED", "REJECTED"],
  INTERVIEW_COMPLETED: ["SELECTED", "REJECTED"],
  SELECTED:        ["CONTRACT_PENDING", "REJECTED"],
  CONTRACT_PENDING: ["CONTRACT_ACCEPTED", "CONTRACT_DECLINED"],
  CONTRACT_DECLINED: ["SHORTLISTED"],
  CONTRACT_ACCEPTED: ["ESCROW_PENDING"],
  ESCROW_PENDING:  ["ACTIVE"],
  ACTIVE:          [],
};

export interface ApplicationAudit {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  actorId: string;
  actorName: string;
  reason?: string;
  createdAt: string;
}

export interface CandidateInterview {
  id: string;
  applicationId: string;
  meetingUrl: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
  createdAt: string;
}

export interface ContractOffer {
  id: string;
  applicationId: string;
  contractId: string;
  amount: number;
  deadline: string;
  version: number;
  proposedBy: "CLIENT" | "FREELANCER";
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

// ── Transitions valides ────────────────────────

export const VALID_APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  //── Nouveau workflow ──
  SUBMITTED:            ["UNREAD", "UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  UNREAD:               ["READ"],
  READ:                 ["SHORTLISTED", "REJECTED", "ARCHIVED"],
  SHORTLISTED:          ["DISCUSSION", "INTERVIEW_PENDING", "SELECTED", "REJECTED", "WITHDRAWN"],
  DISCUSSION:           ["INTERVIEW", "REJECTED"],
  INTERVIEW:            ["OFFER_SENT", "REJECTED"],
  OFFER_SENT:           ["OFFER_ACCEPTED", "OFFER_DECLINED"],
  OFFER_ACCEPTED:       [],
  OFFER_DECLINED:       ["SHORTLISTED"],
  ARCHIVED:             ["READ"],
  //── KYC ──
  IDENTITY_PENDING:     ["SUBMITTED", "UNREAD", "REJECTED", "WITHDRAWN"],
  //── Legacy ──
  UNDER_REVIEW:         ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW_PENDING:    ["INTERVIEW_COMPLETED", "REJECTED", "WITHDRAWN"],
  INTERVIEW_COMPLETED:  ["SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED:             ["CONTRACT_PENDING", "REJECTED", "WITHDRAWN"],
  CONTRACT_PENDING:     ["CONTRACT_ACCEPTED", "CONTRACT_DECLINED", "REJECTED", "WITHDRAWN"],
  CONTRACT_DECLINED:    ["SELECTED", "REJECTED", "WITHDRAWN"],
  CONTRACT_ACCEPTED:    ["ESCROW_PENDING", "WITHDRAWN"],
  ESCROW_PENDING:       ["ACTIVE", "WITHDRAWN"],
  ACTIVE:               [],
  REJECTED:             [],
  WITHDRAWN:            [],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return VALID_APPLICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isInterviewStep(status: ApplicationStatus): boolean {
  return status === "INTERVIEW_PENDING" || status === "INTERVIEW_COMPLETED";
}

export function isNegotiationStep(status: ApplicationStatus): boolean {
  return status === "CONTRACT_PENDING";
}

// ── Labels ─────────────────────────────────────

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  //── Nouveau workflow ──
  SUBMITTED:            "En attente de lecture",
  UNREAD:               "En attente de lecture",
  READ:                 "Lue",
  SHORTLISTED:          "Présélectionnée",
  DISCUSSION:           "En discussion",
  INTERVIEW:            "Entretien",
  OFFER_SENT:           "Offre envoyée",
  OFFER_ACCEPTED:       "Offre acceptée",
  OFFER_DECLINED:       "Offre refusée",
  ARCHIVED:             "Archivée",
  //── KYC ──
  IDENTITY_PENDING:     "Vérification d'identité en cours",
  //── Legacy ──
  UNDER_REVIEW:         "En revue",
  INTERVIEW_PENDING:    "Entretien planifié",
  INTERVIEW_COMPLETED:  "Entretien terminé",
  SELECTED:             "Sélectionnée",
  CONTRACT_PENDING:     "Contrat en attente",
  CONTRACT_DECLINED:    "Contrat refusé",
  CONTRACT_ACCEPTED:    "Contrat accepté",
  ESCROW_PENDING:       "Escrow en attente",
  ACTIVE:               "Active",
  REJECTED:             "Refusée",
  WITHDRAWN:            "Retirée",
};

export const REJECTION_REASONS = [
  "Budget trop élevé",
  "Compétences insuffisantes",
  "Disponibilité incompatible",
  "Expérience insuffisante",
  "Profil ne correspond pas",
  "Autre",
] as const;

// ── Stores persistants (mémoire + fichier) ─────

interface RecruitmentStore {
  applicationAudits: ApplicationAudit[];
  candidateInterviews: CandidateInterview[];
  contractOffers: ContractOffer[];
  auditCounter: number;
  interviewCounter: number;
  offerCounter: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __recruitmentStore: RecruitmentStore | undefined;
}

function loadStore(): RecruitmentStore {
  if (globalThis.__recruitmentStore) return globalThis.__recruitmentStore;

  const saved = loadFromDisk<RecruitmentStore | null>(STORAGE_KEY, null);
  if (saved) {
    globalThis.__recruitmentStore = saved;
    return saved;
  }

  const defaults: RecruitmentStore = {
    applicationAudits: [],
    candidateInterviews: [],
    contractOffers: [],
    auditCounter: 1,
    interviewCounter: 1,
    offerCounter: 1,
  };
  globalThis.__recruitmentStore = defaults;
  return defaults;
}

const _rStore = loadStore();

export const applicationAudits  = _rStore.applicationAudits;
export const candidateInterviews = _rStore.candidateInterviews;
export const contractOffers      = _rStore.contractOffers;

function persistRecruitment(): void {
  saveToDisk(STORAGE_KEY, _rStore);
}

function aid(): string {
  return `audit-${Date.now()}-${_rStore.auditCounter++}`;
}
function iid(): string {
  return `int-${Date.now()}-${_rStore.interviewCounter++}`;
}
function oid(): string {
  return `offer-${Date.now()}-${_rStore.offerCounter++}`;
}

// ── Helpers ────────────────────────────────────

/** Enregistre une transition de statut dans l'audit */
export function logApplicationAudit(params: {
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  actorId: string;
  actorName: string;
  reason?: string;
}): ApplicationAudit {
  const entry: ApplicationAudit = {
    id: aid(),
    applicationId: params.applicationId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actorId: params.actorId,
    actorName: params.actorName,
    reason: params.reason,
    createdAt: new Date().toISOString(),
  };
  applicationAudits.push(entry);
  persistRecruitment();
  return entry;
}

/** Crée un entretien */
export function scheduleInterview(params: {
  applicationId: string;
  meetingUrl: string;
  scheduledAt: string;
  duration?: number;
}): CandidateInterview {
  const interview: CandidateInterview = {
    id: iid(),
    applicationId: params.applicationId,
    meetingUrl: params.meetingUrl,
    scheduledAt: params.scheduledAt,
    duration: params.duration || 30,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
  candidateInterviews.push(interview);
  persistRecruitment();
  return interview;
}

/** Marque un entretien comme terminé */
export function completeInterview(interviewId: string, notes?: string): void {
  const interview = candidateInterviews.find((i) => i.id === interviewId);
  if (interview) {
    interview.status = "completed";
    if (notes) interview.notes = notes;
    persistRecruitment();
  }
}

/** Crée une offre de contrat (négociation) */
export function createOffer(params: {
  applicationId: string;
  contractId: string;
  amount: number;
  deadline: string;
  proposedBy: "CLIENT" | "FREELANCER";
}): ContractOffer {
  const existingOffers = contractOffers.filter((o) => o.applicationId === params.applicationId);
  const version = existingOffers.length + 1;

  // Rejeter les offres précédentes
  existingOffers.forEach((o) => { if (o.status === "pending") o.status = "rejected"; });

  const offer: ContractOffer = {
    id: oid(),
    applicationId: params.applicationId,
    contractId: params.contractId,
    amount: params.amount,
    deadline: params.deadline,
    version,
    proposedBy: params.proposedBy,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  contractOffers.push(offer);
  persistRecruitment();
  return offer;
}

/** Accepte une offre */
export function acceptOffer(offerId: string): void {
  const offer = contractOffers.find((o) => o.id === offerId);
  if (offer) {
    offer.status = "accepted";
    // Rejeter toutes les autres
    contractOffers
      .filter((o) => o.applicationId === offer.applicationId && o.id !== offerId)
      .forEach((o) => { o.status = "rejected"; });
    persistRecruitment();
  }
}
