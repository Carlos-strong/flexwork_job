"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewFormProps {
  contractId: string;
  missionTitle: string;
  targetName: string;
  /** Libellés des sous-notes adaptés au rôle de l'auteur. */
  subLabels?: { quality: string; communication: string; deadline: string };
}

const DEFAULT_SUBLABELS = {
  quality: "Qualité",
  communication: "Communication",
  deadline: "Respect des délais",
};

function Stars({
  value,
  onChange,
  size = "text-2xl",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: string;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Note">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className={`${size} leading-none transition-transform hover:scale-110`}
        >
          <span className={(hover || value) >= n ? "text-amber-400" : "text-[#D6D3CC]"}>★</span>
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ contractId, missionTitle, targetName, subLabels }: ReviewFormProps) {
  const router = useRouter();
  const labels = subLabels ?? DEFAULT_SUBLABELS;
  const [rating, setRating] = useState(0);
  const [quality, setQuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (rating < 1) {
      setError("Veuillez attribuer une note globale.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          rating,
          comment: comment.trim() || undefined,
          qualityRating: quality || undefined,
          communicationRating: communication || undefined,
          deadlineRating: deadline || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Échec de l'envoi de l'avis.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Réseau indisponible.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <span className="text-2xl">✅</span>
        <p className="mt-1 text-sm font-medium text-green-700">
          Merci — votre avis sur « {missionTitle} » a été enregistré.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E0D9] bg-white p-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#1A1916]">{missionTitle}</p>
        <p className="text-xs text-[#5A5750]">Évaluer {targetName}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#1A1916]">Note globale</span>
          <Stars value={rating} onChange={setRating} />
        </div>

        <div className="grid grid-cols-1 gap-2.5 border-t border-[#E2E0D9] pt-3 sm:grid-cols-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#5A5750]">{labels.quality}</span>
            <Stars value={quality} onChange={setQuality} size="text-base" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#5A5750]">{labels.communication}</span>
            <Stars value={communication} onChange={setCommunication} size="text-base" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[#5A5750]">{labels.deadline}</span>
            <Stars value={deadline} onChange={setDeadline} size="text-base" />
          </div>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Partagez votre expérience (facultatif)…"
          className="w-full rounded-lg border border-[#E2E0D9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5BE3]/30"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2D5BE3] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Envoi…" : "Publier l'avis"}
          </button>
        </div>
      </div>
    </div>
  );
}
