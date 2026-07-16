import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MissionTable } from "@/components/elements/mission-table";
import { PageHeader, SectionCard } from "@/components/dashboard/ui";

export const revalidate = 0; // Toujours frais (données utilisateur privées)

async function getClientMissions() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!clientProfile) return [];

  const dbMissions = await prisma.mission.findMany({
    where: {
      clientId: clientProfile.id,
      status: { not: "COMPLETED" }, // Les missions terminées sont archivées automatiquement
    },
    orderBy: { createdAt: "desc" },
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
    workflowStep: m.status,
    applicationsCount: m._count.applications,
    duration: m.duration ?? "",
    expiresAt: m.expiresAt?.toISOString() ?? null,
  }));
}

export default async function ClientMissionsPage() {
  const missions = await getClientMissions();

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <PageHeader
        title="Mes missions"
        subtitle="Gérez vos appels d'offres, candidatures et l'avancement des travaux réalisés."
        actions={
          <Link
            href="/dashboard/client/missions/creation"
            className="flex items-center gap-2 bg-[#2D5BE3] text-white hover:bg-[#1F4DD4] px-[18px] py-[10px] rounded-[10px] text-[13px] font-semibold transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle mission
          </Link>
        }
      />

      <SectionCard
        title="Répertoire des missions"
        count={missions.length}
        aside={
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Actualisé aujourd'hui
          </>
        }
      >
        <MissionTable missions={missions} />
      </SectionCard>
    </div>
  );
}
