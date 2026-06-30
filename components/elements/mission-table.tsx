"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

const WORKFLOW_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  OPEN: "Ouverte",
  PROPOSALS_RECEIVED: "Candidatures",
  FREELANCER_SELECTED: "Sélectionné",
  CONTRACT_CREATED: "Contrat",
  FUNDED: "Financée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrée",
  APPROVED: "Approuvée",
  PAID: "Payée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

interface Mission {
  id: string;
  title: string;
  description: string;
  budget: number;
  budgetType: string;
  currency: string;
  skills: string[];
  status: string;
  workflowStep: string;
  applicationsCount: number;
  duration: string;
  expiresAt: string | null;
}

export function MissionTable({ missions: initialMissions }: { missions: Mission[] }) {
  const router = useRouter();
  const [missions, setMissions] = useState(initialMissions);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Mission | null>(null);

  const handleDelete = async (mission: Mission) => {
    setDeleting(mission.id);
    try {
      const res = await fetch(`/api/missions/${mission.id}`, { method: "DELETE" });
      if (res.ok) {
        setMissions((prev) => prev.filter((m) => m.id !== mission.id));
        setConfirmDelete(null);
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  if (missions.length === 0) {
    return (
      <div className="text-center py-10 px-4 border-2 border-dashed border-[#E2E0D9] rounded-[10px] bg-[#FAFAF8]">
        <p className="text-[#5A5750] text-[14px]">Vous n'avez pas encore de missions enregistrées.</p>
        <Link
          href="/dashboard/client/missions/creation"
          className="inline-flex mt-4 items-center gap-2 bg-white border border-[#E2E0D9] text-[#1A1916] hover:bg-[#FAFAF8] px-[16px] py-[8px] rounded-[10px] text-[13px] font-medium transition-colors"
        >
          + Publier votre première mission
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-[10px] border border-[#E2E0D9] max-h-[500px]">
        <table className="w-full border-collapse text-[13px] text-left">
          <thead className="bg-[#F4F3EF] sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap w-[40px] text-center">#</th>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap min-w-[250px]">Mission & Détails</th>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap min-w-[120px]">Budget</th>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-center">Candidatures</th>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-center">Statut</th>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-center">Échéance</th>
              <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m, index) => {
              const step = m.workflowStep || m.status;
              return (
                <tr
                  key={m.id}
                  onClick={() => router.push(`/dashboard/client/missions/${m.id}`)}
                  className="hover:bg-[#FAFAF8] group transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 border-b border-[#E2E0D9] text-center font-mono text-[11px] text-[#9C9A95]">
                    {index + 1 < 10 ? `0${index + 1}` : index + 1}
                  </td>
                  <td className="py-3 px-4 border-b border-[#E2E0D9]">
                    <span className="font-semibold text-[#1A1916] line-clamp-1 group-hover:text-[#2D5BE3] transition-colors">
                      {m.title}
                    </span>
                  </td>
                  <td className="py-3 px-4 border-b border-[#E2E0D9] font-mono text-[13px] text-[#1A1916]">
                    {m.budgetType === "OPEN_QUOTE"
                      ? <span className="text-[#5A5750] text-[12px]">Budget libre</span>
                      : formatCurrency(m.budget, m.currency)}
                  </td>
                  <td className="py-3 px-4 border-b border-[#E2E0D9] text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold ${m.applicationsCount > 0 ? 'bg-[#EEF2FD] text-[#2D5BE3]' : 'bg-[#FAFAF8] text-[#9C9A95] border border-[#E2E0D9]'}`}>
                      {m.applicationsCount}
                    </span>
                  </td>
                  <td className="py-3 px-4 border-b border-[#E2E0D9] text-center" onClick={(e) => e.stopPropagation()}>
                    <WorkflowBadge step={step} />
                  </td>
                  <td className="py-3 px-4 border-b border-[#E2E0D9] text-[12px] text-center">
                    {m.expiresAt ? (
                      (() => {
                        const days = Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return days > 0 ? (
                          <span className="text-[#B45309]">{days} j. restants</span>
                        ) : (
                          <span className="text-[#C0392B]">Expirée</span>
                        );
                      })()
                    ) : (
                      <span className="text-[#5A5750]">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 border-b border-[#E2E0D9] text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashboard/client/missions/${m.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#2D5BE3] transition-colors"
                        title="Modifier"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span className="hidden sm:inline">Éditer</span>
                      </Link>
                      <button
                        onClick={() => setConfirmDelete(m)}
                        disabled={deleting === m.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#5A5750] hover:bg-[#FDECEA] hover:text-[#C0392B] transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="hidden sm:inline">Supprimer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de confirmation de suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[16px] border border-[#E2E0D9] shadow-xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-[16px] font-semibold text-[#1A1916] mb-2">Confirmer la suppression</h3>
            <p className="text-[14px] text-[#5A5750] mb-1">
              Êtes-vous sûr de vouloir supprimer la mission <strong>« {confirmDelete.title} »</strong> ?
            </p>
            <p className="text-[12px] text-[#C0392B] mb-6">Cette action est irréversible.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting === confirmDelete.id}
                className="px-4 py-2 rounded-[10px] text-[13px] font-medium text-[#5A5750] border border-[#E2E0D9] hover:bg-[#FAFAF8] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id}
                className="px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white bg-[#C0392B] hover:bg-[#A93226] transition-colors disabled:opacity-50"
              >
                {deleting === confirmDelete.id ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WorkflowBadge({ step }: { step: string }) {
  const label = WORKFLOW_LABELS[step] || step;

  if (["DRAFT"].includes(step)) {
    return <span className="inline-flex items-center gap-1 bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">{label}</span>;
  }
  if (["PUBLISHED", "OPEN", "PROPOSALS_RECEIVED"].includes(step)) {
    return <span className="inline-flex items-center gap-1 bg-[#EEF2FD] text-[#2D5BE3] border border-[#C3D1F8] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">{label}</span>;
  }
  if (["FREELANCER_SELECTED", "CONTRACT_CREATED", "FUNDED", "IN_PROGRESS"].includes(step)) {
    return <span className="inline-flex items-center gap-1 bg-[#FEF3C7] text-[#B45309] border border-[#FCD89A] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">{label}</span>;
  }
  if (["DELIVERED", "APPROVED", "PAID", "COMPLETED"].includes(step)) {
    return <span className="inline-flex items-center gap-1 bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">{label}</span>;
  }
  if (["CANCELLED"].includes(step)) {
    return <span className="inline-flex items-center gap-1 bg-[#FDECEA] text-[#C0392B] border border-[#F5BCBC] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">{label}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 bg-[#F0ECFA] text-[#6B4FBB] border border-[#C9BBF0] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">
      {label}
    </span>
  );
}
