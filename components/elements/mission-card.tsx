"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ApplyModal } from "./apply-modal";

import { formatCurrency } from "@/lib/utils";

interface MissionCardProps {
  id: string;
  title: string;
  client?: string;
  budget: number | string; // Gère les cas numériques ou strings
  budgetType?: string;
  currency?: string;
  duration: string;
  skills: string[];
  applicationsCount?: number;
  expiresAt?: string | null;
  /** Affiche le bouton "Postuler" (uniquement pour les freelances connectés) */
  showApply?: boolean;
}

export function MissionCard({
  id,
  title,
  client = "Client Confidentiel",
  budget,
  budgetType = "FIXED",
  currency = "EUR",
  duration,
  skills,
  applicationsCount,
  expiresAt,
  showApply = false,
}: MissionCardProps) {
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  // Calcul du texte d'expiration
  let expirationText = "";
  if (expiresAt) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    if (days > 0) {
      expirationText = `⏰ Expire dans ${days} jour(s)`;
    } else {
      expirationText = `⛔ Expirée`;
    }
  }

  // Formatage du budget
  const formattedBudget =
    budgetType === "OPEN_QUOTE"
      ? "Budget libre"
      : typeof budget === "number"
      ? formatCurrency(budget, currency)
      : budget; // Fallback pour les strings existantes

  // Afficher le bouton seulement si showApply est demandé ou si l'utilisateur est connecté
  const canApply = showApply || !!session?.user;

  return (
    <>
      <div className="rounded-xl border border-[#E2E0D9] p-6 hover:border-primary/50 transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-sm text-[#5A5750]">{client}</p>
              {expirationText ? (
                 <span className="rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-2 py-0.5 text-xs font-medium">
                   {expirationText}
                 </span>
              ) : applicationsCount !== undefined ? (
                 <span className="rounded-md bg-[#F5F5F0] px-2 py-0.5 text-xs font-medium text-[#5A5750]">
                   {applicationsCount} candidatures
                 </span>
              ) : null}
            </div>
          </div>
          <span className="text-lg font-bold text-[#2D5BE3]">{formattedBudget}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-[#F5F5F0] px-3 py-1 text-xs font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#5A5750]">
            Durée : {duration}
          </span>
          <div className="flex items-center gap-3">
            <Link
              href={`/missions/${id}`}
              className="text-sm font-medium text-[#2D5BE3] hover:underline"
            >
              Voir plus
            </Link>
            {canApply && (
              <button
                onClick={() => setModalOpen(true)}
                className="rounded-lg bg-[#2D5BE3] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Postuler
              </button>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ApplyModal
          missionId={id}
          missionTitle={title}
          missionBudget={budget}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

