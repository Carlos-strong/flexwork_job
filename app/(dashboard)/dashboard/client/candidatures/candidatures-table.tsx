"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientApplication } from "./page";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "En attente de lecture", color: "bg-amber-100 text-amber-700" },
  READ: { label: "Lue", color: "bg-slate-100 text-slate-600" },
  IDENTITY_PENDING: { label: "KYC en attente", color: "bg-purple-100 text-purple-700" },
  SHORTLISTED: { label: "Présélectionnée", color: "bg-cyan-100 text-cyan-700" },
  DISCUSSION: { label: "En discussion", color: "bg-blue-100 text-blue-700" },
  INTERVIEW: { label: "Entretien", color: "bg-indigo-100 text-indigo-700" },
  OFFER_SENT: { label: "Offre envoyée", color: "bg-orange-100 text-orange-700" },
  OFFER_ACCEPTED: { label: "Offre acceptée", color: "bg-green-100 text-green-700" },
  OFFER_DECLINED: { label: "Offre refusée", color: "bg-red-100 text-red-700" },
  ARCHIVED: { label: "Archivée", color: "bg-gray-100 text-gray-500" },
  REJECTED: { label: "Refusée", color: "bg-red-100 text-red-700" },
  WITHDRAWN: { label: "Retirée", color: "bg-gray-100 text-gray-400" },
  ACCEPTED: { label: "Acceptée", color: "bg-green-100 text-green-700" },
  UNDER_REVIEW: { label: "En cours d'examen", color: "bg-blue-100 text-blue-700" },
  PENDING: { label: "En attente de lecture", color: "bg-amber-100 text-amber-700" },
};

/** Actions disponibles selon le statut */
const STATUS_ACTIONS: Record<string, { label: string; target: string; icon: string; color: string }[]> = {
  SUBMITTED: [
    { label: "Lire", target: "READ", icon: "👁️", color: "bg-white border-slate-300 hover:bg-slate-50" },
  ],
  READ: [
    { label: "Présélectionner", target: "SHORTLISTED", icon: "⭐", color: "bg-cyan-50 border-cyan-300 hover:bg-cyan-100 text-cyan-700" },
    { label: "Refuser", target: "REJECTED", icon: "❌", color: "bg-red-50 border-red-200 hover:bg-red-100 text-red-600" },
    { label: "Archiver", target: "ARCHIVED", icon: "📦", color: "bg-gray-50 border-gray-300 hover:bg-gray-100 text-gray-600" },
  ],
  SHORTLISTED: [
    { label: "Discussion", target: "DISCUSSION", icon: "💬", color: "bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-700" },
    { label: "Refuser", target: "REJECTED", icon: "❌", color: "bg-red-50 border-red-200 hover:bg-red-100 text-red-600" },
  ],
  DISCUSSION: [
    { label: "Entretien", target: "INTERVIEW", icon: "📹", color: "bg-indigo-50 border-indigo-300 hover:bg-indigo-100 text-indigo-700" },
    { label: "Refuser", target: "REJECTED", icon: "❌", color: "bg-red-50 border-red-200 hover:bg-red-100 text-red-600" },
  ],
  INTERVIEW: [
    { label: "Envoyer une offre", target: "OFFER_SENT", icon: "📨", color: "bg-orange-50 border-orange-300 hover:bg-orange-100 text-orange-700" },
    { label: "Refuser", target: "REJECTED", icon: "❌", color: "bg-red-50 border-red-200 hover:bg-red-100 text-red-600" },
  ],
  OFFER_SENT: [],
  OFFER_ACCEPTED: [],
  OFFER_DECLINED: [
    { label: "Retour shortlist", target: "SHORTLISTED", icon: "↩️", color: "bg-cyan-50 border-cyan-300 hover:bg-cyan-100 text-cyan-700" },
  ],
  ARCHIVED: [
    { label: "Désarchiver", target: "READ", icon: "📂", color: "bg-white border-slate-300 hover:bg-slate-50" },
  ],
  REJECTED: [],
  WITHDRAWN: [],
};

export function CandidaturesTable({ applications }: { applications: ClientApplication[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAction = async (applicationId: string, targetStatus: string) => {
    setProcessingId(applicationId);
    setError("");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors du changement de statut");
      } else {
        router.refresh();
      }
    } catch {
      setError("Erreur réseau");
    }
    setProcessingId(null);
  };

  return (
    <div className="rounded-xl border border-[#E2E0D9] bg-white overflow-hidden">
      {error && (
        <div className="m-4 rounded-lg bg-[#C0392B]/10 p-3 text-sm text-[#C0392B] flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="ml-4 font-bold">×</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E0D9] bg-[#FAFAF8] text-left">
              <th className="px-4 py-3 font-semibold text-[#5A5750]">Freelance</th>
              <th className="px-4 py-3 font-semibold text-[#5A5750]">Mission</th>
              <th className="px-4 py-3 font-semibold text-[#5A5750]">Budget proposé</th>
              <th className="px-4 py-3 font-semibold text-[#5A5750]">Statut</th>
              <th className="px-4 py-3 font-semibold text-[#5A5750]">Date</th>
              <th className="px-4 py-3 font-semibold text-[#5A5750] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const statusInfo = STATUS_LABELS[app.status] || STATUS_LABELS.SUBMITTED;
              const isExpanded = expandedId === app.id;
              const isProcessing = processingId === app.id;

              return (
                <tr key={app.id} className="border-b border-[#F5F5F0] hover:bg-[#FAFAF8] transition-colors">
                  {/* Freelance */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/client/freelancer/${app.freelancerId}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#EEF2FD] flex items-center justify-center text-[#2D5BE3] text-xs font-bold shrink-0">
                        {app.freelancerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1916] group-hover:text-[#2D5BE3] transition-colors">
                          {app.freelancerName}
                        </p>
                        <p className="text-xs text-[#5A5750]">{app.freelancerTitle}</p>
                      </div>
                    </Link>
                  </td>

                  {/* Mission */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/client/missions/${app.missionId}`}
                      className="text-[#2D5BE3] hover:underline font-medium"
                    >
                      {app.missionTitle}
                    </Link>
                    <p className="text-xs text-[#5A5750]">
                      {app.missionBudgetType === "OPEN_QUOTE"
                        ? "Budget libre"
                        : `${app.missionBudget.toLocaleString()} ${app.missionCurrency}`}
                    </p>
                  </td>

                  {/* Budget proposé */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#1A1916]">
                      {app.proposedBudget > 0
                        ? `${app.proposedBudget.toLocaleString()} ${app.missionCurrency}`
                        : "—"}
                    </span>
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-[#5A5750] text-xs">
                    {new Date(app.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Actions rapides selon le statut */}
                      {(STATUS_ACTIONS[app.status] || []).slice(0, 2).map((action) => (
                        <button
                          key={action.target}
                          onClick={() => handleAction(app.id, action.target)}
                          disabled={isProcessing}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${action.color}`}
                          title={action.label}
                        >
                          {action.icon} {action.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        className="text-xs font-medium text-[#2D5BE3] hover:underline ml-1"
                      >
                        {isExpanded ? "−" : "..."}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panneau détail expandable */}
      {expandedId && (() => {
        const app = applications.find((a) => a.id === expandedId);
        if (!app) return null;
        const allActions = STATUS_ACTIONS[app.status] || [];
        return (
          <div className="border-t border-[#E2E0D9] bg-[#FAFAF8] p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lettre de motivation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">
                  Lettre de motivation
                </h4>
                <p className="text-sm text-[#1A1916] whitespace-pre-wrap leading-relaxed">
                  {app.coverLetter || "Aucune lettre de motivation fournie."}
                </p>
              </div>

              {/* Infos freelance */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-2">
                    Compétences
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {app.freelancerSkills.length > 0
                      ? app.freelancerSkills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-[#EEF2FD] px-2.5 py-0.5 text-xs font-medium text-[#2D5BE3]"
                          >
                            {s}
                          </span>
                        ))
                      : <span className="text-xs text-[#9C9A95]">Aucune compétence renseignée</span>}
                  </div>
                </div>

                {app.freelancerRate > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mb-1">
                      Taux horaire
                    </h4>
                    <p className="text-sm font-semibold text-[#1A1916]">
                      {app.freelancerRate.toLocaleString()} {app.missionCurrency}/h
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Toutes les actions disponibles */}
            {allActions.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-[#E2E0D9]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5A5750] mr-2">Actions :</span>
                {allActions.map((action) => (
                  <button
                    key={action.target}
                    onClick={() => handleAction(app.id, action.target)}
                    disabled={processingId === app.id}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${action.color}`}
                  >
                    {action.icon} {action.label}
                  </button>
                ))}
                <Link
                  href={`/dashboard/client/messages?freelancer=${app.freelancerId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E0D9] bg-white px-3 py-2 text-xs font-semibold text-[#5A5750] hover:bg-[#FAFAF8] transition-colors"
                >
                  💬 Contacter
                </Link>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
