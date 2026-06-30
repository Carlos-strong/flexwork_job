"use client";

import { useState, useEffect, useTransition } from "react";

// ── Types ──────────────────────────────────────
interface Candidature {
  id: string;
  freelancerName: string;
  freelancerTitle: string;
  rate: number;
  skills: string[];
  coverLetter: string;
  proposedBudget: number;
  status: string;
  createdAt: string;
}

interface CandidatureListOptimisticProps {
  candidatures: Candidature[];
  onStatusChange: (id: string, status: string) => Promise<void>;
}

// ── Composant ──────────────────────────────────
export function CandidatureListOptimistic({
  candidatures: serverCandidatures,
  onStatusChange,
}: CandidatureListOptimisticProps) {
  const [isPending, startTransition] = useTransition();
  // Copie locale pour l'optimistic UI (compatible React 18)
  const [localCandidatures, setLocalCandidatures] = useState(serverCandidatures);

  // Resynchroniser quand les données serveur changent
  useEffect(() => {
    setLocalCandidatures(serverCandidatures);
  }, [serverCandidatures]);

  const handleStatusChange = (id: string, newStatus: string) => {
    // 1. Mise à jour instantanée de l'UI (optimiste)
    const previous = [...localCandidatures];
    setLocalCandidatures((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );

    // 2. Appel serveur en arrière-plan
    startTransition(async () => {
      try {
        await onStatusChange(id, newStatus);
      } catch {
        // Rollback en cas d'erreur
        setLocalCandidatures(previous);
      }
    });
  };

  if (localCandidatures.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E0D9] p-8 text-center">
        <p className="text-[#5A5750]">Aucune candidature pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localCandidatures.map((c) => (
        <div
          key={c.id}
          className={`rounded-xl border p-6 transition-all duration-300 ${
            c.status === "ACCEPTED"
              ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10"
              : c.status === "REJECTED"
              ? "border-red-500/20 bg-red-50/20 dark:bg-red-950/10 opacity-70"
              : "border-[#E2E0D9] hover:border-[#C3D1F8]"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FD] text-sm font-semibold text-[#2D5BE3]">
                {(c.freelancerName ?? "?").charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{c.freelancerName}</p>
                <p className="text-sm text-[#5A5750]">{c.freelancerTitle}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#2D5BE3]">{c.proposedBudget} €</p>
              <StatusBadge status={c.status} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(c.skills ?? []).map((s: string) => (
              <span
                key={s}
                className="rounded-full bg-[#F5F5F0] px-2.5 py-0.5 text-xs font-medium"
              >
                {s}
              </span>
            ))}
          </div>

          <p className="mt-3 text-sm text-[#5A5750] line-clamp-2">
            {c.coverLetter}
          </p>

          {/* Actions optimistes */}
          {c.status === "PENDING" && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleStatusChange(c.id, "ACCEPTED")}
                disabled={isPending}
                className="rounded-lg bg-[#2D5BE3] px-4 py-2 text-xs font-medium text-white hover:bg-[#1F4DD4] transition-colors disabled:opacity-50"
              >
                ✓ Accepter
              </button>
              <button
                onClick={() => handleStatusChange(c.id, "REJECTED")}
                disabled={isPending}
                className="rounded-lg border border-[#E2E0D9] px-4 py-2 text-xs font-medium hover:bg-[#EEF2FD] transition-colors disabled:opacity-50"
              >
                ✕ Refuser
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Indicateur de synchronisation */}
      {isPending && (
        <div className="flex justify-center py-4">
          <span className="text-xs text-[#5A5750] animate-pulse">
            Synchronisation...
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sous-composants ────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config = {
    PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  const labels: Record<string, string> = {
    PENDING: "En attente",
    ACCEPTED: "Acceptée",
    REJECTED: "Refusée",
  };

  return (
    <span
      className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        config[status as keyof typeof config] || ""
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
