/**
 * Configuration Bull Board pour le monitoring des queues
 *
 * Utilise @bull-board/api + un adaptateur personnalisé pour Next.js App Router.
 *
 * Architecture :
 *   @bull-board/api  →   createBullBoard() avec BullMQAdapter
 *   API Route        →   /api/admin/queues/stats  (données JSON)
 *   Page Admin       →   /admin/queues             (interface UI)
 */

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { getAllQueues } from "./queue";

// ============================================================
// Création du tableau de bord Bull Board (singleton)
// ============================================================

let board: ReturnType<typeof createBullBoard> | null = null;

export function getBullBoard() {
  if (!board) {
    board = createBullBoard({
      queues: getAllQueues().map((q) => new BullMQAdapter(q)),
      serverAdapter: undefined!, // Pas d'adapter serveur — on utilise notre propre API
    });
    console.log("[Bull Board] 📊 Tableau de bord initialisé");
  }
  return board;
}

// ============================================================
// Récupération des statistiques de toutes les queues
// ============================================================

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobSummary {
  id: string;
  name: string;
  data: Record<string, unknown>;
  status: "completed" | "failed" | "active" | "waiting" | "delayed";
  attempts: number;
  maxAttempts: number;
  timestamp: string;
  processedOn?: string;
  failedReason?: string;
  duration?: number;
}

export async function getAllQueuesStats(): Promise<QueueStats[]> {
  const queues = getAllQueues();
  const stats: QueueStats[] = [];

  for (const q of queues) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
      q.getDelayedCount(),
    ]);

    const isPaused = await q.isPaused();

    stats.push({
      name: q.name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    });
  }

  return stats;
}

export async function getQueueJobs(
  queueName: string,
  status: "completed" | "failed" | "waiting" | "active" | "delayed" = "failed",
  limit = 20,
): Promise<JobSummary[]> {
  const queues = getAllQueues();
  const q = queues.find((q) => q.name === queueName);
  if (!q) return [];

  const jobs = await q.getJobs([status], 0, limit);

  return jobs.map((j) => ({
    id: j.id!,
    name: j.name,
    data: j.data as Record<string, unknown>,
    status: status,
    attempts: j.attemptsMade,
    maxAttempts: j.opts?.attempts || 3,
    timestamp: new Date(j.timestamp).toISOString(),
    processedOn: j.processedOn ? new Date(j.processedOn).toISOString() : undefined,
    failedReason: j.failedReason || undefined,
    duration: j.finishedOn && j.processedOn ? j.finishedOn - j.processedOn : undefined,
  }));
}

export async function retryJob(queueName: string, jobId: string): Promise<boolean> {
  const queues = getAllQueues();
  const q = queues.find((q) => q.name === queueName);
  if (!q) return false;

  const job = await q.getJob(jobId);
  if (!job) return false;

  await job.retry();
  return true;
}

export async function pauseQueue(queueName: string): Promise<boolean> {
  const queues = getAllQueues();
  const q = queues.find((q) => q.name === queueName);
  if (!q) return false;

  await q.pause();
  return true;
}

export async function resumeQueue(queueName: string): Promise<boolean> {
  const queues = getAllQueues();
  const q = queues.find((q) => q.name === queueName);
  if (!q) return false;

  await q.resume();
  return true;
}
