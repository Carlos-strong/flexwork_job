/**
 * Données centralisées (stockage mémoire + fichier pour le développement).
 *
 * ⚠️ Initialement vides — les données sont créées via l'interface admin.
 * À remplacer par Prisma dès que la BDD est connectée.
 *
 * Utilise globalThis pour survivre aux hot-reloads Next.js,
 * ET un fichier JSON dans .data/ pour survivre aux redémarrages du serveur.
 */

import { saveToDisk, loadFromDisk } from "@/lib/persist";

const STORAGE_KEY = "mock-data";

type Mission = {
  id: string; clientId: string; title: string; description: string;
  budget: number; currency: string; budgetType: string; skills: string[]; duration: string;
  location: string; workMode: string; missionCity: string | null; missionCountry: string | null;
  status: string; applicationsCount: number; expiresAt: string | null; createdAt: string;
};
type Application = {
  id: string; missionId: string; freelancerId: string;
  freelancerName: string; freelancerTitle: string; rate: number;
  skills: string[]; coverLetter: string; proposedBudget: number;
  status: string; createdAt: string;
};
type Payment = {
  id: string; contractId: string; type: string; amount: number;
  currency: string; status: string; stripePaymentId?: string;
  trustEngineId?: string; stripePayoutId?: string; milestoneId?: string;
  createdAt: string;
};
type Contract = {
  id: string; missionId: string; missionTitle: string;
  clientName: string; clientId: string;
  freelancerId: string; freelancerName: string;
  status: string; escrowAmount: number; escrowId: string | null;
  stripePaymentIntentId?: string | null;
  stripeClientSecret?: string | null;
  milestones: { id: string; title: string; amount: number; status: string; dueDate: string }[];
  conversationId?: string;
  createdAt: string;
};
type Milestone = { id: string; title: string; description: string; amount: number; status: string; dueDate: string; completedAt?: string };
type Freelancer = { id: string; name: string; title: string; rate: string; skills: string[]; rating: number };
type UmaReco = { id: string; title: string; budget: number; score: number; skills: string[] };

interface MockStore {
  missions: Mission[];
  applications: Application[];
  payments: Payment[];
  contracts: Contract[];
  milestones: Record<string, Milestone[]>;
  freelancers: Freelancer[];
  umaRecos: UmaReco[];
}

declare global {
  // eslint-disable-next-line no-var
  var __mockStore: MockStore | undefined;
}

function loadMockStore(): MockStore {
  // 1. Vérifier globalThis (déjà chargé = hot-reload)
  if (globalThis.__mockStore) {
    return globalThis.__mockStore;
  }

  // 2. Tenter de charger depuis le disque (survit aux redémarrages)
  const saved = loadFromDisk<MockStore | null>(STORAGE_KEY, null);
  if (saved) {
    globalThis.__mockStore = saved;
    return saved;
  }

  // 3. Valeur par défaut (première exécution)
  const defaults: MockStore = {
    missions: [],
    applications: [],
    payments: [],
    contracts: [],
    milestones: {},
    freelancers: [],
    umaRecos: [],
  };
  globalThis.__mockStore = defaults;
  return defaults;
}

const _mock: MockStore = loadMockStore();

/** Sauvegarde immédiate du store complet sur disque */
export function persistMockStore(): void {
  saveToDisk(STORAGE_KEY, _mock);
}

export const missions      = _mock.missions;
export const applications  = _mock.applications;
export const payments      = _mock.payments;
export const contracts     = _mock.contracts;
export const milestones    = _mock.milestones;
export const freelancers   = _mock.freelancers;
export const umaRecos      = _mock.umaRecos;

