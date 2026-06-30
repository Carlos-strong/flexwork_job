import Link from "next/link";
import { CandidatureList } from "@/lib/dynamic-imports";
import { updateApplicationStatus } from "@/lib/actions";

export const metadata = { title: "Détail de la mission" };

async function getMission(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/missions/${id}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? json;
  } catch { return null; }
}

async function getApplications(missionId: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/applications?missionId=${missionId}`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data ?? []);
  } catch { return []; }
}

export default async function MissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [mission, applications] = await Promise.all([
    getMission(params.id),
    getApplications(params.id),
  ]);

  if (!mission) {
    return (
      <div className="text-center py-12">
        <p className="text-[#5A5750]">Mission introuvable.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#9C9A95] mb-1.5 tracking-[0.02em] uppercase">
            Mission · {mission.location || "En ligne"}
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">
            {mission.title}
          </h1>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className={`inline-flex items-center px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold border leading-none ${
              mission.status === "OPEN" ? "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]" :
              mission.status === "IN_PROGRESS" ? "bg-[#EEF2FD] text-[#2D5BE3] border-[#C3D1F8]" :
              "bg-[#FAFAF8] text-[#5A5750] border-[#E2E0D9]"
            }`}>
              {mission.status === "OPEN" ? "Ouverte" : mission.status === "IN_PROGRESS" ? "En cours" : mission.status}
            </span>
            <span className="inline-flex items-center px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold border border-[#E2E0D9] bg-[#FAFAF8] text-[#5A5750] leading-none">
              {mission.applicationsCount || applications.length} candidature(s)
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {(mission.status === "OPEN" || mission.status === "DRAFT" || mission.status === "PUBLISHED") && (
            <Link
              href={`/dashboard/client/missions/${params.id}/edit`}
              className="inline-flex items-center gap-2 bg-white border border-[#E2E0D9] text-[#1A1916] hover:bg-[#FAFAF8] px-[16px] py-[8px] rounded-[10px] text-[13px] font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
              Modifier la mission
            </Link>
          )}
          <div className="text-right mt-1">
            <p className="text-[20px] font-bold text-[#2D5BE3]">
              {mission.budgetType === "OPEN_QUOTE"
                ? "Devis sur mesure"
                : `${mission.budget} €`}
            </p>
            <p className="text-[13px] text-[#5A5750] font-medium">{mission.duration || "Durée non spécifiée"}</p>
          </div>
        </div>
      </div>

      {/* ── Description Card ── */}
      <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D9] flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
            <span className="inline-flex items-center justify-center bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-2.5 py-1 rounded-[20px] text-[11px]">
              01
            </span>
            Détails & Compétences
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#5A5750] tracking-[0.5px] uppercase mb-3">
            Description de la mission
            <div className="flex-1 h-px bg-[#E2E0D9]"></div>
          </div>
          <p className="text-[14px] text-[#5A5750] leading-[1.6] whitespace-pre-wrap mb-6">
            {mission.description}
          </p>
          
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#5A5750] tracking-[0.5px] uppercase mb-3">
            Compétences requises
            <div className="flex-1 h-px bg-[#E2E0D9]"></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mission.skills?.length > 0 ? (
              mission.skills.map((s: string) => (
                <span key={s} className="bg-[#EEF2FD] text-[#2D5BE3] border border-[#C3D1F8] px-[12px] py-[4px] rounded-[20px] text-[12px] font-medium">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-[#9C9A95] text-[13px] italic">Aucune compétence spécifique renseignée.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Applications Card ── */}
      <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D9] flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
            <span className="inline-flex items-center justify-center bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-2.5 py-1 rounded-[20px] text-[11px]">
              02
            </span>
            Candidatures
            <span className="inline-flex items-center gap-1 bg-[#EEF2FD] text-[#2D5BE3] border border-[#C3D1F8] px-[8px] py-[2px] rounded-[20px] text-[10px] font-bold whitespace-nowrap leading-none ml-2">
              {applications.length} reçue(s)
            </span>
          </div>
        </div>
        <div className="p-0 sm:p-5">
           <CandidatureList
            candidatures={applications}
            onStatusChange={updateApplicationStatus}
          />
        </div>
      </div>
    </div>
  );
}
