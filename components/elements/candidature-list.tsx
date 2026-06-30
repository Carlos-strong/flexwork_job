"use client";

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

interface CandidatureListProps {
  candidatures: Candidature[];
  onStatusChange: (id: string, status: string) => void;
}

export function CandidatureList({ candidatures, onStatusChange }: CandidatureListProps) {
  if (candidatures.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E0D9] p-8 text-center">
        <p className="text-[#5A5750]">Aucune candidature pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {candidatures.map((c) => (
        <div key={c.id} className="rounded-xl border border-[#E2E0D9] p-6 hover:border-[#C3D1F8] transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FD] text-sm font-semibold text-[#2D5BE3]">
                {c.freelancerName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{c.freelancerName}</p>
                <p className="text-sm text-[#5A5750]">{c.freelancerTitle}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[#2D5BE3]">{c.proposedBudget.toLocaleString()} XAF</p>
              <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                c.status === "ACCEPTED"          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                c.status === "REJECTED"          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                c.status === "IDENTITY_PENDING"  ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                                                   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
              }`}>
                {c.status === "PENDING"           ? "En attente"
                 : c.status === "IDENTITY_PENDING" ? "⏳ Vérification ID en cours"
                 : c.status === "ACCEPTED"         ? "Acceptée"
                 : c.status === "REJECTED"         ? "Refusée"
                 : c.status}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.skills.map((s: string) => (
              <span key={s} className="rounded-full bg-[#F5F5F0] px-2.5 py-0.5 text-xs font-medium">{s}</span>
            ))}
          </div>

          <p className="mt-3 text-sm text-[#5A5750] line-clamp-2">{c.coverLetter}</p>

          {c.status === "PENDING" && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onStatusChange(c.id, "ACCEPTED")}
                className="rounded-lg bg-[#2D5BE3] px-4 py-2 text-xs font-medium text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Accepter
              </button>
              <button
                onClick={() => onStatusChange(c.id, "REJECTED")}
                className="rounded-lg border border-[#E2E0D9] px-4 py-2 text-xs font-medium hover:bg-[#EEF2FD] transition-colors"
              >
                Refuser
              </button>
            </div>
          )}

          {/* Règle métier #1 (PRD) : blocage visuel si KYC freelance en attente */}
          {c.status === "IDENTITY_PENDING" && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Acceptation bloquée</strong> — La vérification d'identité de ce freelance est en cours de traitement par l'équipe. Elle sera débloquée automatiquement après validation.
              </p>
              <button
                onClick={() => onStatusChange(c.id, "REJECTED")}
                className="mt-2 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors dark:border-amber-700 dark:text-amber-300"
              >
                Refuser quand même
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
