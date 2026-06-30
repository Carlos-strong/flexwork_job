/**
 * Données centralisées (stockage en mémoire pour le développement).
 *
 * ⚠️ Initialement vides — les données sont créées via l'interface admin.
 * À remplacer par Prisma dès que la BDD est connectée.
 */

export const missions: {
  id: string; clientId: string; title: string; description: string;
  budget: number; currency: string; budgetType: string; skills: string[]; duration: string;
  location: string; workMode: string; missionCity: string | null; missionCountry: string | null;
  status: string; applicationsCount: number; expiresAt: string | null; createdAt: string;
}[] = [];

export const applications: {
  id: string; missionId: string; freelancerId: string;
  freelancerName: string; freelancerTitle: string; rate: number;
  skills: string[]; coverLetter: string; proposedBudget: number;
  status: string; createdAt: string;
}[] = [];

export const payments: {
  id: string; contractId: string; type: string; amount: number;
  currency: string; status: string; stripePaymentId?: string;
  trustEngineId?: string; stripePayoutId?: string; milestoneId?: string;
  createdAt: string;
}[] = [];

export const contracts: {
  id: string; missionId: string; missionTitle: string;
  clientName: string; clientId: string;
  freelancerId: string; freelancerName: string;
  status: string; escrowAmount: number; escrowId: string | null;
  milestones: { id: string; title: string; amount: number; status: string; dueDate: string }[];
  conversationId?: string;
  createdAt: string;
}[] = [];

export const milestones: Record<string, { id: string; title: string; description: string; amount: number; status: string; dueDate: string; completedAt?: string }[]> = {};

export const freelancers: {
  id: string; name: string; title: string; rate: string;
  skills: string[]; rating: number;
}[] = [];

export const umaRecos: {
  id: string; title: string; budget: number; score: number; skills: string[];
}[] = [];
