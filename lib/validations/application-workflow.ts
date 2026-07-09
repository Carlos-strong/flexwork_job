import { ApplicationStatus } from "@prisma/client";

/**
 * State Machine pour les transitions de statut des applications
 * Définit les transitions valides et les règles métier
 */

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  UNREAD: "Non lue",
  READ: "Lue",
  PENDING: "En attente",
  IDENTITY_PENDING: "KYC en attente",
  SHORTLISTED: "Présélectionnée",
  DISCUSSION: "En discussion",
  INTERVIEW: "Entretien programmé",
  OFFER_SENT: "Offre envoyée",
  OFFER_ACCEPTED: "Offre acceptée",
  OFFER_DECLINED: "Offre refusée",
  ACCEPTED: "Acceptée",
  REJECTED: "Rejetée",
  WITHDRAWN: "Retirée",
  ARCHIVED: "Archivée",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  UNREAD: "bg-blue-100 text-blue-800",
  READ: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  IDENTITY_PENDING: "bg-orange-100 text-orange-800",
  SHORTLISTED: "bg-purple-100 text-purple-800",
  DISCUSSION: "bg-cyan-100 text-cyan-800",
  INTERVIEW: "bg-indigo-100 text-indigo-800",
  OFFER_SENT: "bg-green-100 text-green-800",
  OFFER_ACCEPTED: "bg-emerald-100 text-emerald-800",
  OFFER_DECLINED: "bg-red-100 text-red-800",
  ACCEPTED: "bg-teal-100 text-teal-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-800",
  ARCHIVED: "bg-gray-200 text-gray-700",
};

export const APPLICATION_STATUS_ICONS: Record<ApplicationStatus, string> = {
  UNREAD: "📬",
  READ: "👁️",
  PENDING: "⏳",
  IDENTITY_PENDING: "🔍",
  SHORTLISTED: "⭐",
  DISCUSSION: "💬",
  INTERVIEW: "🎤",
  OFFER_SENT: "📤",
  OFFER_ACCEPTED: "✅",
  OFFER_DECLINED: "❌",
  ACCEPTED: "🎉",
  REJECTED: "🚫",
  WITHDRAWN: "🔙",
  ARCHIVED: "📦",
};

// État machine : transitions valides
export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> =
  {
    UNREAD: ["READ", "SHORTLISTED", "ARCHIVED", "REJECTED"],
    READ: ["SHORTLISTED", "ARCHIVED", "REJECTED"],
    PENDING: ["READ", "SHORTLISTED", "ARCHIVED", "REJECTED"],
    IDENTITY_PENDING: ["READ", "REJECTED"],
    SHORTLISTED: ["DISCUSSION", "ARCHIVED", "WITHDRAWN"],
    DISCUSSION: ["INTERVIEW", "OFFER_SENT", "ARCHIVED", "WITHDRAWN"],
    INTERVIEW: ["OFFER_SENT", "ARCHIVED", "WITHDRAWN"],
    OFFER_SENT: ["OFFER_ACCEPTED", "OFFER_DECLINED"],
    OFFER_ACCEPTED: ["ACCEPTED"],
    OFFER_DECLINED: ["SHORTLISTED", "ARCHIVED"],
    ACCEPTED: [],
    REJECTED: [],
    WITHDRAWN: ["SHORTLISTED"],
    ARCHIVED: ["SHORTLISTED"],
  };

/**
 * Vérifie si une transition de statut est valide
 */
export function isValidTransition(
  from: ApplicationStatus,
  to: ApplicationStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Obtient les statuts possibles suivants
 */
export function getNextStates(
  current: ApplicationStatus
): ApplicationStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

/**
 * Valide les paramètres de transition
 */
export interface TransitionValidation {
  valid: boolean;
  errors: string[];
}

export function validateTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  reason?: string
): TransitionValidation {
  const errors: string[] = [];

  if (!isValidTransition(from, to)) {
    errors.push(
      `Transition non autorisée de ${from} vers ${to}`
    );
  }

  // Règles métier spécifiques
  if (to === "REJECTED" && !reason) {
    errors.push("Un motif est requis pour rejeter une candidature");
  }

  if (to === "ARCHIVED" && !reason) {
    errors.push("Un motif est requis pour archiver une candidature");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Détermine qui peut effectuer une action
 */
export type UserRole = "CLIENT" | "FREELANCER" | "ADMIN";

export interface ActionPermission {
  allowed: boolean;
  reason?: string;
}

export function canPerformAction(
  action: "view" | "shortlist" | "archive" | "decline" | "sendOffer",
  userRole: UserRole,
  currentStatus: ApplicationStatus
): ActionPermission {
  // Only client can manage applications
  if (userRole !== "CLIENT" && action !== "view") {
    return {
      allowed: false,
      reason: "Seul le client peut gérer les candidatures",
    };
  }

  // Status-specific permissions
  const allowedActions: Record<ApplicationStatus, string[]> = {
    UNREAD: ["view", "shortlist", "archive", "decline"],
    READ: ["view", "shortlist", "archive", "decline"],
    PENDING: ["view"],
    IDENTITY_PENDING: ["view"],
    SHORTLISTED: ["view", "archive", "decline"],
    DISCUSSION: ["view", "sendOffer", "archive"],
    INTERVIEW: ["view", "sendOffer", "archive"],
    OFFER_SENT: ["view"],
    OFFER_ACCEPTED: ["view"],
    OFFER_DECLINED: ["view"],
    ACCEPTED: ["view"],
    REJECTED: ["view"],
    WITHDRAWN: ["view"],
    ARCHIVED: ["view"],
  };

  const isAllowed = allowedActions[currentStatus]?.includes(action) ?? false;

  return {
    allowed: isAllowed,
    reason: isAllowed
      ? undefined
      : `Action "${action}" non autorisée pour le statut "${currentStatus}"`,
  };
}

/**
 * Valide les champs requis pour une offre
 */
export interface OfferValidation {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateOffer(data: {
  title?: string;
  offerType?: string;
  totalBudget?: number;
  hourlyRate?: number;
  startDate?: Date;
}): OfferValidation {
  const errors: Record<string, string> = {};

  if (!data.title?.trim()) {
    errors.title = "Le titre de l'offre est requis";
  }

  if (!data.offerType) {
    errors.offerType = "Le type d'offre est requis";
  }

  if (data.offerType === "FIXED") {
    if (!data.totalBudget || data.totalBudget <= 0) {
      errors.totalBudget = "Le montant doit être supérieur à 0";
    }
  }

  if (data.offerType === "HOURLY") {
    if (!data.hourlyRate || data.hourlyRate <= 0) {
      errors.hourlyRate = "Le taux horaire doit être supérieur à 0";
    }
  }

  if (!data.startDate) {
    errors.startDate = "La date de début est requise";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
