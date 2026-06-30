import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CandidaturesTable } from "./candidatures-table";

export const revalidate = 0;

async function getClientApplications() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!clientProfile) return [];

  const dbApplications = await prisma.application.findMany({
    where: {
      mission: { clientId: clientProfile.id },
    },
    orderBy: { createdAt: "desc" },
    include: {
      mission: { select: { id: true, title: true, budget: true, currency: true, budgetType: true } },
      freelancer: {
        include: {
          user: { select: { firstName: true, lastName: true, phone: true, email: true, image: true } },
        },
      },
    },
  });

  return dbApplications.map((a) => ({
    id: a.id,
    missionId: a.missionId,
    missionTitle: a.mission.title,
    missionBudget: a.mission.budget ?? 0,
    missionCurrency: a.mission.currency ?? "XAF",
    missionBudgetType: a.mission.budgetType,
    freelancerId: a.freelancerId,
    freelancerName: `${a.freelancer.user.firstName ?? ""} ${a.freelancer.user.lastName ?? ""}`.trim() || "Freelance",
    freelancerTitle: a.freelancer.title ?? "Freelance",
    freelancerSkills: a.freelancer.skills ?? [],
    freelancerRate: a.freelancer.hourlyRate ?? 0,
    freelancerImage: a.freelancer.user.image,
    coverLetter: a.coverLetter ?? "",
    proposedBudget: a.proposedBudget ?? 0,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));
}

export type ClientApplication = Awaited<ReturnType<typeof getClientApplications>>[number];

export default async function ClientCandidaturesPage() {
  const applications = await getClientApplications();

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Candidatures reçues</h1>
          <p className="text-[14px] text-[#5A5750] mt-1">
            Consultez et gérez les candidatures reçues pour vos missions.
          </p>
        </div>
      </div>

      {/* ── Tableau des candidatures ── */}
      {applications.length === 0 ? (
        <div className="rounded-xl border border-[#E2E0D9] bg-white p-12 text-center">
          <div className="text-4xl mb-4">📩</div>
          <h3 className="text-lg font-semibold text-[#1A1916]">Aucune candidature reçue</h3>
          <p className="mt-2 text-sm text-[#5A5750]">
            Les candidatures à vos missions apparaîtront ici.
          </p>
          <Link
            href="/dashboard/client/missions/creation"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Créer une mission
          </Link>
        </div>
      ) : (
        <CandidaturesTable applications={applications} />
      )}
    </div>
  );
}
