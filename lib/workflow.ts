/**
 * Pipeline mission — machine à états
 *
 *   DRAFT → PUBLISHED → PROPOSALS_RECEIVED → FREELANCER_SELECTED
 *        → CONTRACT_CREATED → FUNDED → IN_PROGRESS
 *        → DELIVERED → APPROVED → PAID
 *   Tout état → CANCELLED
 */

export type MissionStep =
  | "DRAFT"
  | "PUBLISHED"
  | "PROPOSALS_RECEIVED"
  | "FREELANCER_SELECTED"
  | "CONTRACT_CREATED"
  | "FUNDED"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "APPROVED"
  | "PAID"
  | "CANCELLED";

// Transitions valides — seules les transitions listées sont autorisées
const VALID_TRANSITIONS: Record<MissionStep, MissionStep[]> = {
  DRAFT:                ["PUBLISHED", "CANCELLED"],
  PUBLISHED:            ["PROPOSALS_RECEIVED", "CANCELLED"],
  PROPOSALS_RECEIVED:   ["FREELANCER_SELECTED", "CANCELLED"],
  FREELANCER_SELECTED:  ["CONTRACT_CREATED", "PUBLISHED", "CANCELLED"],
  CONTRACT_CREATED:     ["FUNDED", "CANCELLED"],
  FUNDED:               ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS:          ["DELIVERED", "CANCELLED"],
  DELIVERED:            ["APPROVED", "IN_PROGRESS", "CANCELLED"],
  APPROVED:             ["PAID", "IN_PROGRESS", "CANCELLED"],
  PAID:                 [],
  CANCELLED:            [],
};

// Mappage vers les statuts Prisma pour la BDD
export const MISSION_STATUS_MAP: Record<MissionStep, string> = {
  DRAFT:                "DRAFT",
  PUBLISHED:            "OPEN",
  PROPOSALS_RECEIVED:   "OPEN",
  FREELANCER_SELECTED:  "OPEN",
  CONTRACT_CREATED:     "IN_PROGRESS",
  FUNDED:               "IN_PROGRESS",
  IN_PROGRESS:          "IN_PROGRESS",
  DELIVERED:            "IN_PROGRESS",
  APPROVED:             "COMPLETED",
  PAID:                 "COMPLETED",
  CANCELLED:            "CANCELLED",
};

/** Étapes visibles côté client (filtre les étapes internes) */
export const CLIENT_VISIBLE_STEPS: MissionStep[] = [
  "DRAFT", "PUBLISHED", "IN_PROGRESS", "DELIVERED", "APPROVED", "PAID", "CANCELLED",
];

export function canTransition(from: MissionStep, to: MissionStep): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStep(current: MissionStep): MissionStep | null {
  const transitions = VALID_TRANSITIONS[current];
  if (!transitions || transitions.length === 0) return null;
  return transitions[0]; // Chemin heureux par défaut
}

/** Vérifie si une transition doit être automatique (pas d'action utilisateur requise) */
export function isAutoTransition(from: MissionStep, to: MissionStep): boolean {
  const autoTransitions: [MissionStep, MissionStep][] = [
    ["PUBLISHED", "PROPOSALS_RECEIVED"],
    ["FREELANCER_SELECTED", "CONTRACT_CREATED"],
  ];
  return autoTransitions.some(([f, t]) => f === from && t === to);
}

// ── Résultat qualification IA ─────────────────

export interface QualificationResult {
  passed: boolean;
  score: number;       // 0-100
  feedback: string;
  warnings: string[];
  suggestedSkills: string[];
  suggestedBudget: number | null;
}

/**
 * Simule la qualification IA d'une mission.
 * En production : appel à OpenAI / LLM pour analyser titre + description + compétences.
 */
export function qualifyMission(mission: {
  title: string;
  description: string;
  budget: number;
  skills: string[];
}): QualificationResult {
  const warnings: string[] = [];
  let score = 100;

  // Sanitize input
  const sanitizedTitle = mission.title.trim();
  const sanitizedDescription = mission.description.trim();

  // Règles de qualification
  if (sanitizedTitle.length < 10) {
    warnings.push("Titre trop court (< 10 caractères)");
    score -= 20;
  }
  if (sanitizedDescription.length < 50) {
    warnings.push("Description trop courte (< 50 caractères)");
    score -= 25;
  }
  if (mission.budget < 100) {
    warnings.push("Budget minimum non atteint (< 100€)");
    score -= 30;
  }
  if (mission.skills.length === 0) {
    warnings.push("Aucune compétence requise spécifiée");
    score -= 15;
  }
  if (mission.skills.length > 15) {
    warnings.push("Trop de compétences requises (> 15)");
    score -= 5;
  }

  // Suggestions
  const suggestedSkills = detectMissingSkills(sanitizedDescription, mission.skills);
  const suggestedBudget = detectBudgetAnomaly(mission.budget, sanitizedTitle);

  return {
    passed: score >= 50,
    score: Math.max(0, score),
    feedback: score >= 80
      ? "Mission bien structurée, prête à être publiée."
      : score >= 50
      ? "Mission acceptable, quelques améliorations suggérées."
      : "Mission nécessite des améliorations avant publication.",
    warnings,
    suggestedSkills,
    suggestedBudget,
  };
}

// ── Helpers IA (simulés) ──────────────────────

function detectMissingSkills(description: string, existing: string[]): string[] {
  const keywordMap: Record<string, string[]> = {
    react: ["React", "TypeScript", "Next.js"],
    frontend: ["CSS", "HTML", "JavaScript"],
    backend: ["Node.js", "API REST", "PostgreSQL"],
    mobile: ["React Native", "Flutter", "iOS", "Android"],
    devops: ["Docker", "CI/CD", "AWS"],
    data: ["Python", "SQL", "BigQuery"],
    design: ["Figma", "UI/UX", "Design System"],
    seo: ["SEO", "Google Analytics", "SEM"],
  };

  const lower = description.toLowerCase();
  const suggestions: string[] = [];

  for (const [keyword, skills] of Object.entries(keywordMap)) {
    if (lower.includes(keyword)) {
      for (const skill of skills) {
        if (!existing.includes(skill) && !suggestions.includes(skill)) {
          suggestions.push(skill);
        }
      }
    }
  }

  return suggestions.slice(0, 5);
}

function detectBudgetAnomaly(budget: number, title: string): number | null {
  const lower = title.toLowerCase();
  if (lower.includes("senior") || lower.includes("lead") || lower.includes("architecte")) {
    if (budget < 5000) return 5000;
  }
  if (lower.includes("junior") || lower.includes("stage")) {
    if (budget > 3000) return 2000;
  }
  return null;
}
