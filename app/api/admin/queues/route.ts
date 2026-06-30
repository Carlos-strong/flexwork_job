import { NextRequest, NextResponse } from "next/server";
import { getAllQueuesStats, getQueueJobs, retryJob, pauseQueue, resumeQueue } from "@/lib/bull-board";

/**
 * GET /api/admin/queues
 * Retourne les statistiques de toutes les queues
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queueName = searchParams.get("queue");
    const status = searchParams.get("status") as "completed" | "failed" | "waiting" | "active" | "delayed" | null;
    const action = searchParams.get("action");
    const jobId = searchParams.get("jobId");

    // Action: réessayer un job
    if (action === "retry" && queueName && jobId) {
      const ok = await retryJob(queueName, jobId);
      return NextResponse.json({ success: ok });
    }

    // Action: pause queue
    if (action === "pause" && queueName) {
      const ok = await pauseQueue(queueName);
      return NextResponse.json({ success: ok });
    }

    // Action: resume queue
    if (action === "resume" && queueName) {
      const ok = await resumeQueue(queueName);
      return NextResponse.json({ success: ok });
    }

    // Jobs d'une queue spécifique
    if (queueName && status) {
      const jobs = await getQueueJobs(queueName, status);
      return NextResponse.json({ queue: queueName, status, jobs });
    }

    // Stats globales
    const stats = await getAllQueuesStats();
    return NextResponse.json({ queues: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
