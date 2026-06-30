"use client";

import { useState } from "react";

interface GoogleMeetButtonProps {
  /** Titre de la réunion */
  meetingTitle?: string;
  /** Durée estimée (minutes) */
  duration?: number;
}

/**
 * Bouton pour créer/rejoindre un appel Google Meet.
 *
 * En production : utiliser l'API Google Calendar pour créer un event
 * avec conferencing. Ici, on génère un lien Meet simplifié.
 */
export function GoogleMeetButton({
  meetingTitle = "Réunion Flexwork",
  duration = 30,
}: GoogleMeetButtonProps) {
  const [loading, setLoading] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);

  const handleCreateMeet = async () => {
    setLoading(true);
    // Simule un appel API (en prod : Google Calendar API)
    await new Promise((r) => setTimeout(r, 800));

    // Lien Meet simplifié (en prod : généré par l'API Google)
    const link = `https://meet.google.com/${generateMeetCode()}`;
    setMeetLink(link);
    setLoading(false);
  };

  const copyToClipboard = async () => {
    if (meetLink) {
      await navigator.clipboard.writeText(meetLink);
    }
  };

  if (meetLink) {
    return (
      <div className="rounded-xl border border-[#E2E0D9] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📹</span>
          <div>
            <p className="text-sm font-semibold">Appel Google Meet prêt</p>
            <p className="text-xs text-[#5A5750]">{meetingTitle} · {duration} min</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center rounded-lg bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            Rejoindre l&apos;appel
          </a>
          <button
            onClick={copyToClipboard}
            className="rounded-lg border border-[#E2E0D9] px-4 py-2.5 text-sm font-medium hover:bg-[#EEF2FD] transition-colors"
            title="Copier le lien"
          >
            📋
          </button>
        </div>
        <p className="text-[10px] text-[#5A5750] text-center">
          {meetLink}
        </p>
        <button
          onClick={() => setMeetLink(null)}
          className="w-full text-xs text-[#5A5750] hover:text-[#1A1916] transition-colors"
        >
          Annuler et créer un nouveau lien
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleCreateMeet}
      disabled={loading}
      className="w-full rounded-xl border border-[#E2E0D9] p-5 hover:border-[#C3D1F8] transition-all disabled:opacity-50"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-lg">
          📹
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold">
            {loading ? "Création du lien..." : "Démarrer un appel Google Meet"}
          </p>
          <p className="text-xs text-[#5A5750]">
            {meetingTitle} · ~{duration} min
          </p>
        </div>
      </div>
    </button>
  );
}

/** Génère un code Meet aléatoire (simulé) */
function generateMeetCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const segments = [3, 4, 3];
  return segments
    .map((len) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    )
    .join("-");
}
