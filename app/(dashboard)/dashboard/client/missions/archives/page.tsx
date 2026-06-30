import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 0;

async function getArchivedMissions() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!clientProfile) return [];

  const dbMissions = await prisma.mission.findMany({
    where: {
      clientId: clientProfile.id,
      status: "COMPLETED",
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return dbMissions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    budget: m.budget ?? 0,
    budgetType: m.budgetType,
    currency: m.currency ?? "EUR",
    skills: m.skills,
    status: m.status,
    applicationsCount: m._count.applications,
    duration: m.duration ?? "",
    expiresAt: m.expiresAt,
    completedAt: m.updatedAt,
  }));
}

export default async function ArchivedMissionsPage() {
  const missions = await getArchivedMissions();

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Archives</h1>
          <p className="text-[14px] text-[#5A5750] mt-1">
            Retrouvez ici toutes vos missions terminées et archivées.
          </p>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D9] flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
            <span className="inline-flex items-center justify-center bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-2.5 py-1 rounded-[20px] text-[11px]">
              {missions.length < 10 && missions.length > 0 ? `0${missions.length}` : missions.length}
            </span>
            Missions archivées
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] text-[#9C9A95]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Archivage automatique
          </span>
        </div>

        <div className="p-5">
          {missions.length === 0 ? (
            <div className="text-center py-10 px-4 border-2 border-dashed border-[#E2E0D9] rounded-[10px] bg-[#FAFAF8]">
              <p className="text-[#5A5750] text-[14px]">Aucune mission archivée pour le moment.</p>
              <p className="text-[12px] text-[#9C9A95] mt-1">
                Les missions terminées sont automatiquement déplacées ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-[#E2E0D9] max-h-[500px]">
              <table className="w-full border-collapse text-[13px] text-left">
                <thead className="bg-[#F4F3EF] sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap w-[40px] text-center">#</th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap min-w-[250px]">Mission</th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap min-w-[120px]">Budget</th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-center">Candidatures</th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-center">Statut</th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#5A5750] uppercase tracking-[0.5px] border-b-2 border-[#E2E0D9] whitespace-nowrap text-center">Terminée le</th>
                  </tr>
                </thead>
                <tbody>
                  {missions.map((m: any, index: number) => (
                    <tr key={m.id} className="hover:bg-[#FAFAF8] group transition-colors">
                      <td className="py-3 px-4 border-b border-[#E2E0D9] text-center font-mono text-[11px] text-[#9C9A95]">
                        {index + 1 < 10 ? `0${index + 1}` : index + 1}
                      </td>
                      <td className="py-3 px-4 border-b border-[#E2E0D9]">
                        <Link href={`/dashboard/client/missions/${m.id}`} className="hover:underline">
                          <span className="font-semibold text-[#1A1916] line-clamp-1 group-hover:text-[#2D5BE3] transition-colors">
                            {m.title}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 border-b border-[#E2E0D9] font-mono text-[13px] text-[#1A1916]">
                        {m.budgetType === "OPEN_QUOTE"
                          ? <span className="text-[#5A5750] text-[12px]">Budget libre</span>
                          : formatCurrency(m.budget, m.currency)}
                      </td>
                      <td className="py-3 px-4 border-b border-[#E2E0D9] text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold bg-[#FAFAF8] text-[#9C9A95] border border-[#E2E0D9]">
                          {m.applicationsCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 border-b border-[#E2E0D9] text-center">
                        <span className="inline-flex items-center gap-1 bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold whitespace-nowrap leading-none">
                          Terminée
                        </span>
                      </td>
                      <td className="py-3 px-4 border-b border-[#E2E0D9] text-[12px] text-center text-[#5A5750]">
                        {m.completedAt
                          ? new Date(m.completedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
