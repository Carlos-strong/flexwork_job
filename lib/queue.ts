/**
 * Configuration BullMQ + Redis pour la production
 *
 * Queues partagées :
 *   - missions     : MISSION_CREATED, MISSION_UPDATED
 *   - applications : APPLICATION_SUBMITTED, APPLICATION_ACCEPTED
 *   - contracts    : CONTRACT_CREATED, CONTRACT_COMPLETED
 *   - payments     : PAYMENT_DEPOSIT, PAYMENT_RELEASE, PAYMENT_PAYOUT
 *   - webhooks     : WEBHOOK_STRIPE, WEBHOOK_TRUSTENGINE
 *   - notifications: NOTIFICATION_EMAIL
 *
 * ⚠️ Nécessite Redis en cours d'exécution sur REDIS_URL (défaut: localhost:6379)
 */

import { Queue, Job } from "bullmq";
import Redis from "ioredis";

// ============================================================
// Types partagés
// ============================================================

export type JobType =
  | "MISSION_CREATED"
  | "MISSION_QUALIFIED"
  | "MISSION_PUBLISHED"
  | "MISSION_PROPOSALS_RECEIVED"
  | "MISSION_FREELANCER_SELECTED"
  | "MISSION_FUNDED"
  | "MISSION_DELIVERED"
  | "MISSION_APPROVED"
  | "MISSION_PAID"
  | "MISSION_UPDATED"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_ACCEPTED"
  | "APPLICATION_SHORTLISTED"
  | "APPLICATION_REJECTED"
  | "OFFER_SENT"
  | "OFFER_ACCEPTED"
  | "CONTRACT_CREATED"
  | "CONTRACT_ESCROW_CREATED"
  | "CONTRACT_COMPLETED"
  | "MILESTONE_SUBMITTED"
  | "MILESTONE_APPROVED"
  | "MILESTONE_RELEASED"
  | "PAYMENT_DEPOSIT"
  | "PAYMENT_RELEASE"
  | "PAYMENT_PAYOUT"
  | "MILESTONE_COMPLETED"
  | "WEBHOOK_STRIPE"
  | "WEBHOOK_TRUSTENGINE"
  | "NOTIFICATION_EMAIL"
  | "APPLICATION_VIEWED";

export type JobDataMap = {
  MISSION_CREATED: { missionId: string; title: string; clientId: string; skills: string[]; budget: number };
  MISSION_QUALIFIED: { missionId: string; title: string; score: number; passed: boolean; warnings: string[]; suggestedSkills: string[]; suggestedBudget: number | null };
  MISSION_PUBLISHED: { missionId: string; title: string; skills: string[]; budget: number };
  MISSION_PROPOSALS_RECEIVED: { missionId: string; title: string; count: number };
  MISSION_FREELANCER_SELECTED: { missionId: string; title: string; freelancerId: string; freelancerName: string };
  MISSION_FUNDED: { missionId: string; title: string; amount: number; paymentIntentId: string };
  MISSION_DELIVERED: { missionId: string; title: string; contractId: string };
  MISSION_APPROVED: { missionId: string; title: string; contractId: string };
  MISSION_PAID: { missionId: string; title: string; amount: number };
  MISSION_UPDATED: { missionId: string; title: string; changes: string[] };
  APPLICATION_SUBMITTED: { applicationId: string; missionId: string; freelancerId: string; freelancerName: string; proposedBudget: number };
  APPLICATION_ACCEPTED: { applicationId: string; missionId: string; missionTitle: string; freelancerId: string; freelancerName: string };
  APPLICATION_SHORTLISTED: { applicationId: string };
  APPLICATION_REJECTED: { applicationId: string; reason?: string };
  APPLICATION_VIEWED: {
    applicationId: string;
    missionId: string;
    missionTitle: string;
    freelancerId: string;
    freelancerUserId: string;
    freelancerName: string;
    freelancerEmail: string;
    clientName: string;
  };
  OFFER_SENT: { applicationId: string };
  OFFER_ACCEPTED: { applicationId: string };
  CONTRACT_CREATED: { contractId: string; missionId: string; missionTitle: string; clientId: string; freelancerId: string; escrowAmount: number };
  CONTRACT_ESCROW_CREATED: { contractId: string; escrowId: string; missionTitle: string; amount: number; clientId: string; freelancerId: string };
  CONTRACT_COMPLETED: { contractId: string; missionTitle: string; totalAmount: number };
  MILESTONE_SUBMITTED: { milestoneId: string; contractId: string; title: string; amount: number };
  MILESTONE_APPROVED: { milestoneId: string; contractId: string; title: string; amount: number };
  MILESTONE_RELEASED: { milestoneId: string; contractId: string; title: string; amount: number };
  PAYMENT_DEPOSIT: { paymentId: string; contractId: string; amount: number; stripePaymentIntentId?: string; virtualCardId?: string; virtualCardTransactionId?: string; authorizationCode?: string };
  PAYMENT_RELEASE: { paymentId: string; contractId: string; milestoneId: string; milestoneTitle: string; amount: number };
  PAYMENT_PAYOUT: { paymentId: string; freelancerId: string; amount: number; stripeAccountId: string };
  MILESTONE_COMPLETED: { milestoneId: string; contractId: string; title: string; amount: number };
  WEBHOOK_STRIPE: { eventType: string; eventId: string; data: Record<string, unknown> };
  WEBHOOK_TRUSTENGINE: { event: string; escrowId: string; data: Record<string, unknown> };
  NOTIFICATION_EMAIL: { to: string; subject: string; template: string; data: Record<string, unknown> };
};

export type QueueName = "missions" | "applications" | "contracts" | "payments" | "webhooks" | "notifications";

// ============================================================
// Connexion Redis singleton
// ============================================================

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      // BullMQ (Worker) exige maxRetriesPerRequest: null sur la connexion partagée
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });
    redisClient.on("connect", () => console.log("[Redis] 🔗 Connecté"));
    redisClient.on("error", (err) => console.error("[Redis] ❌ Erreur:", err.message));
  }
  return redisClient;
}

/**
 * Retourne les options de connexion Redis pour BullMQ
 */
export function getConnection(): { connection: Redis } {
  return { connection: getRedisClient() };
}

// ============================================================
// Mapping : JobType → QueueName
// ============================================================

const jobQueueMap: Record<JobType, QueueName> = {
  MISSION_CREATED: "missions",
  MISSION_QUALIFIED: "missions",
  MISSION_PUBLISHED: "missions",
  MISSION_PROPOSALS_RECEIVED: "missions",
  MISSION_FREELANCER_SELECTED: "missions",
  MISSION_FUNDED: "missions",
  MISSION_DELIVERED: "missions",
  MISSION_APPROVED: "missions",
  MISSION_PAID: "missions",
  MISSION_UPDATED: "missions",
  APPLICATION_SUBMITTED: "applications",
  APPLICATION_ACCEPTED: "applications",
  APPLICATION_SHORTLISTED: "applications",
  APPLICATION_REJECTED: "applications",
  APPLICATION_VIEWED: "applications",
  OFFER_SENT: "applications",
  OFFER_ACCEPTED: "applications",
  CONTRACT_CREATED: "contracts",
  CONTRACT_ESCROW_CREATED: "contracts",
  CONTRACT_COMPLETED: "contracts",
  MILESTONE_SUBMITTED: "contracts",
  MILESTONE_APPROVED: "contracts",
  MILESTONE_RELEASED: "contracts",
  MILESTONE_COMPLETED: "contracts",
  PAYMENT_DEPOSIT: "payments",
  PAYMENT_RELEASE: "payments",
  PAYMENT_PAYOUT: "payments",
  WEBHOOK_STRIPE: "webhooks",
  WEBHOOK_TRUSTENGINE: "webhooks",
  NOTIFICATION_EMAIL: "notifications",
};

// ============================================================
// Cache des queues BullMQ (singleton par nom)
// ============================================================

const queueInstances = new Map<QueueName, Queue>();

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600 * 24 * 7 }, // 7 jours
  removeOnFail: { age: 3600 * 24 * 14 },    // 14 jours
};

/**
 * Récupère ou crée une queue BullMQ par nom
 */
export function getQueue(name: QueueName): Queue {
  let q = queueInstances.get(name);
  if (!q) {
    q = new Queue(name, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: getRedisClient() as any,
      defaultJobOptions,
    });
    queueInstances.set(name, q);
    console.log(`[Queue] 📦 Queue "${name}" initialisée`);
  }
  return q;
}

/**
 * Retourne toutes les queues (pour Bull Board / monitoring)
 */
export function getAllQueues(): Queue[] {
  const names: QueueName[] = ["missions", "applications", "contracts", "payments", "webhooks", "notifications"];
  return names.map((n) => getQueue(n));
}

// ============================================================
// Helper : Ajouter un job dans la bonne queue
// ============================================================

export async function enqueueJob<T extends JobType>(
  type: T,
  data: JobDataMap[T],
  opts?: { delay?: number; jobId?: string },
): Promise<Job<JobDataMap[T]> | null> {
  const queueName = jobQueueMap[type];
  if (!queueName) {
    console.warn(`[Queue] ⚠️ Type de job inconnu: ${type}`);
    return null;
  }
  
  // Validate job data
  if (!data || typeof data !== 'object') {
    console.warn(`[Queue] ⚠️ Données de job invalides pour le type: ${type}`);
    return null;
  }
  
  try {
    const queue = getQueue(queueName);
    const job = await queue.add(type, data, {
      ...opts,
      deduplication: opts?.jobId ? { id: opts.jobId } : undefined,
    });
    console.log(`[Queue] 📥 Job "${type}" ajouté dans "${queueName}" (${job.id})`);
    return job as Job<JobDataMap[T]>;
  } catch (err) {
    console.warn(`[Queue] ⚠️ Redis indisponible — job "${type}" ignoré`);
    return null;
  }
}

// ============================================================
// Nettoyage à l'arrêt
// ============================================================

export async function closeAllQueues(): Promise<void> {
  for (const [name, q] of Array.from(queueInstances)) {
    await q.close();
    console.log(`[Queue] 🔒 Queue "${name}" fermée`);
  }
  if (redisClient) {
    await redisClient.quit();
    console.log("[Redis] 🔒 Déconnecté");
  }
}

// Gestion de l'arrêt propre
process.on("SIGTERM", async () => {
  console.log("[Queue] 🛑 Arrêt demandé...");
  await closeAllQueues();
});
process.on("SIGINT", async () => {
  console.log("[Queue] 🛑 Arrêt demandé...");
  await closeAllQueues();
});
