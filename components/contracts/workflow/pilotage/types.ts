/**
 * Types étendus pour le pilotage par jalons avec gestion des preuves.
 * Extension de MilestoneWorkflowState pour supporter les vues prestataire et client.
 */

import type { MilestoneWorkflowState, MilestoneWorkflowStatus } from "@/lib/contract-workflow";

// ── Types de preuves ──

export interface EvidenceFile {
  name: string;     // Nom original du fichier
  url: string;      // Chemin public (/uploads/...)
  mimeType: string; // Type MIME (image/jpeg, video/mp4, etc.)
  size: number;     // Taille en octets
}

export interface GeolocEvidence {
  lat: number;
  lng: number;
  label?: string;
  simulated?: boolean;
}

export interface AutreEvidence {
  label: string;
}

export interface EvidenceSet {
  photos: EvidenceFile[];
  videos: EvidenceFile[];
  documents: EvidenceFile[];
  geoloc: GeolocEvidence | null;
  autres: AutreEvidence[];
}

// ── État étendu d'un jalon pour le pilotage ──
export interface PilotageMilestone {
  // Champs hérités de MilestoneWorkflowState
  milestoneId: string;
  title: string;
  amount: number;
  executionRate: number;
  status: MilestoneWorkflowStatus;
  submittedAt?: string;
  validatedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // Extensions pour le pilotage
  evidence: EvidenceSet;
  progressionDeclaree: number;   // 0-100, déclaré par le prestataire
  progressionConstatee: number | null; // 0-100, constaté par le client (null = pas encore évalué)
  revisionCount: number;
}

// ── Helpers ──
export function evCount(ev: EvidenceSet): number {
  return ev.photos.length + ev.videos.length + ev.documents.length + (ev.geoloc ? 1 : 0) + ev.autres.length;
}

export function emptyEvidence(): EvidenceSet {
  return { photos: [], videos: [], documents: [], geoloc: null, autres: [] };
}

/** Convertit un MilestoneWorkflowState en PilotageMilestone avec valeurs par défaut */
export function toPilotageMilestone(m: MilestoneWorkflowState): PilotageMilestone {
  return {
    ...m,
    evidence: (m.evidence as EvidenceSet) || emptyEvidence(),
    progressionDeclaree: m.executionRate,
    progressionConstatee: m.status === "VALIDATED" ? 100 : null,
    revisionCount: m.revisionCount ?? 0,
  };
}

// ── Statuts pour affichage ──
export const PILOTAGE_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  NOT_STARTED: { cls: "b-gray", label: "Non démarré" },
  IN_PROGRESS: { cls: "b-gray", label: "En cours" },
  SUBMITTED: { cls: "b-amber", label: "Soumis — en attente client" },
  VALIDATED: { cls: "b-green", label: "Validé" },
  REJECTED: { cls: "b-red", label: "Rejeté — à corriger" },
};

export const CLIENT_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  NOT_STARTED: { cls: "b-gray", label: "Non démarré" },
  IN_PROGRESS: { cls: "b-gray", label: "Non soumis" },
  SUBMITTED: { cls: "b-amber", label: "À valider" },
  VALIDATED: { cls: "b-green", label: "Validé" },
  REJECTED: { cls: "b-red", label: "Rejeté par vous" },
};
