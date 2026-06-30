"use client";

import { useEffect, useState } from "react";

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface JobSummary {
  id: string;
  name: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  timestamp: string;
  processedOn?: string;
  failedReason?: string;
  duration?: number;
}

export default function QueuesAdminPage() {
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"failed" | "completed" | "waiting">("failed");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueues = async () => {
    try {
      const res = await fetch("/api/admin/queues");
      if (!res.ok) throw new Error("Erreur chargement queues");
      const data = await res.json();
      setQueues(data.queues || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async (queue: string, status: string) => {
    const res = await fetch(`/api/admin/queues?queue=${queue}&status=${status}`);
    const data = await res.json();
    setJobs(data.jobs || []);
  };

  const retryJob = async (queue: string, jobId: string) => {
    await fetch(`/api/admin/queues?action=retry&queue=${queue}&jobId=${jobId}`);
    fetchJobs(queue, selectedStatus);
    fetchQueues();
  };

  const togglePause = async (queue: string, paused: boolean) => {
    await fetch(`/api/admin/queues?action=${paused ? "resume" : "pause"}&queue=${queue}`);
    fetchQueues();
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  useEffect(() => {
    if (selectedQueue) {
      fetchJobs(selectedQueue, selectedStatus);
    }
  }, [selectedQueue, selectedStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchQueues, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const total = queues.reduce((s, q) => s + q.waiting + q.active + q.failed, 0);

  const statusColors: Record<string, string> = {
    waiting: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    delayed: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">📊 File d&apos;attente (Queues)</h2>
          <p className="text-sm text-[#5A5750]">
            {loading ? "Chargement..." : `${queues.length} queues · ${total} jobs en attente/actifs/échoués`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={fetchQueues}
            className="rounded-lg border border-[#E2E0D9] px-3 py-1.5 text-sm hover:bg-[#EEF2FD] transition-colors"
          >
            🔄 Rafraîchir
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[#C0392B]/10 p-4 text-sm text-[#C0392B]">
          ❌ {error} — Vérifie que Redis est en cours d&apos;exécution.
        </div>
      )}

      {/* Grille des queues */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {queues.map((q) => (
          <button
            key={q.name}
            onClick={() => setSelectedQueue(q.name)}
            className={`rounded-xl border p-5 text-left transition-all hover:shadow-sm ${
              selectedQueue === q.name ? "border-primary ring-1 ring-[#2D5BE3]" : "border-[#E2E0D9]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold capitalize">{q.name}</h3>
              {q.paused && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                  ⏸ Paused
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 p-2 text-center">
                <p className="text-lg font-bold text-yellow-600">{q.waiting}</p>
                <p className="text-xs text-[#5A5750]">En attente</p>
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-2 text-center">
                <p className="text-lg font-bold text-blue-600">{q.active}</p>
                <p className="text-xs text-[#5A5750]">Actifs</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-2 text-center">
                <p className="text-lg font-bold text-green-600">{q.completed}</p>
                <p className="text-xs text-[#5A5750]">Terminés</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-2 text-center">
                <p className="text-lg font-bold text-red-600">{q.failed}</p>
                <p className="text-xs text-[#5A5750]">Échoués</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePause(q.name, q.paused);
              }}
              className="mt-3 w-full rounded-lg border border-[#E2E0D9] py-1.5 text-xs font-medium hover:bg-[#EEF2FD] transition-colors"
            >
              {q.paused ? "▶️ Reprendre" : "⏸ Pause"}
            </button>
          </button>
        ))}
      </div>

      {/* Détail d'une queue */}
      {selectedQueue && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold capitalize">
              Détails — {selectedQueue}
            </h3>
            <div className="flex gap-2">
              {(["failed", "completed", "waiting"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedStatus === s
                      ? "bg-[#2D5BE3] text-white"
                      : "border border-[#E2E0D9] hover:bg-[#FAFAF8]"
                  }`}
                >
                  {s === "failed" ? "❌ Échoués" : s === "completed" ? "✅ Terminés" : "⏳ En attente"}
                </button>
              ))}
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-xl border border-[#E2E0D9] p-8 text-center text-[#5A5750]">
              Aucun job {selectedStatus === "failed" ? "échoué" : selectedStatus === "completed" ? "terminé" : "en attente"}.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.id} className="rounded-xl border border-[#E2E0D9] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[j.status] || ""}`}>
                          {j.name}
                        </span>
                        <span className="text-xs text-[#5A5750]">#{j.id.slice(-8)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#5A5750]">
                        Tentatives: {j.attempts}/{j.maxAttempts}
                        {j.duration ? ` · Durée: ${(j.duration / 1000).toFixed(1)}s` : ""}
                      </p>
                      {j.failedReason && (
                        <p className="mt-1 text-xs text-red-600 font-mono">{j.failedReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#5A5750]">
                        {new Date(j.timestamp).toLocaleString("fr-FR")}
                      </span>
                      {j.status === "failed" && (
                        <button
                          onClick={() => retryJob(selectedQueue, j.id)}
                          className="rounded-lg bg-[#2D5BE3] px-3 py-1 text-xs font-medium text-white hover:bg-[#1F4DD4] transition-colors"
                        >
                          🔄 Réessayer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
