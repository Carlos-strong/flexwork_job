import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CandidaturesHub } from "./candidatures-hub";
import type { MissionGroup } from "./candidatures-hub";
import type { PipelineApplication } from "@/components/missions/recruitment-pipeline";

export const revalidate = 0;
export const metadata = { title: "Gestion des candidatures" };

// Re-export pour candidatures-table.tsx (legacy)
export type ClientApplication = {
  id: string;
  missionId: string;
  missionTitle: string;
  missionBudget: number;
  missionCurrency: string;
  missionBudgetType: string;
  freelancerId: string;
  freelancerUserId: string;
  freelancerName: string;
  freelancerTitle: string;
  freelancerSkills: string[];
  freelancerRate: number;
  freelancerImage?: string | null;
  coverLetter: string;
  proposedBudget: number;
  status: string;
  kycStatus: "VALIDÉ" | "EN_ATTENTE" | "REJETÉ" | "AUCUN";
  createdAt: string;
};

async function getMissionsWithApplications(): Promise<MissionGroup[]> {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!clientProfile) return [];

  // Fetch all missions with their applications
  const dbMissions = await prisma.mission.findMany({
    where: { clientId: clientProfile.id },
    orderBy: { createdAt: "desc" },
    include: {
      applications: {
        orderBy: { createdAt: "desc" },
        include: {
          freelancer: {
            include: {
              user: { select: { firstName: true, lastName: true, image: true, id: true } },
            },
          },
        },
      },
      contract: { select: { id: true } },
    },
  });

  // Keep only missions that have at least 1 application
  const missionsWithApps = dbMissions.filter((m) => m.applications.length > 0);

  return missionsWithApps.map((m): MissionGroup => ({
    missionId: m.id,
    missionTitle: m.title,
    missionDescription: m.description ?? undefined,
    missionSkills: m.skills ?? [],
    missionBudget: m.budgetType === "OPEN_QUOTE"
      ? "Devis sur mesure"
      : m.budget ? `${m.budget} €` : undefined,
    missionDuration: m.duration ?? undefined,
    missionStatus: m.status,
    contractId: m.contract?.id,
    applications: m.applications.map((a): PipelineApplication => ({
      id: a.id,
      freelancerName: `${a.freelancer.user.firstName ?? ""} ${a.freelancer.user.lastName ?? ""}`.trim() || "Freelance",
      freelancerTitle: a.freelancer.title ?? undefined,
      freelancerId: a.freelancer.user.id,
      proposedBudget: a.proposedBudget ?? undefined,
      // IDENTITY_PENDING est remplacé par le KYC gating côté pipeline
      status: a.status === "IDENTITY_PENDING" ? "PENDING" : a.status,
      coverLetter: a.coverLetter ?? undefined,
      skills: a.freelancer.skills ?? [],
      createdAt: a.createdAt.toISOString(),
      kycVerified: a.freelancer.isValidated,
    })),
  }));
}

export default async function ClientCandidaturesPage({
  searchParams,
}: {
  searchParams?: { mission?: string };
}) {
  const missions = await getMissionsWithApplications();

  // Mission sélectionnée (depuis URL ou première par défaut)
  const activeMissionId = searchParams?.mission ?? missions[0]?.missionId;
  const activeMission = missions.find((m) => m.missionId === activeMissionId);

  return (
    <div
      className="mx-auto max-w-[1280px]"
      style={{ fontFamily: "var(--font-space-grotesk, Inter, sans-serif)" }}
    >
      {/* Header */}
      <div className="mb-6">
        <p
          className="text-[11px] uppercase tracking-[0.08em] font-medium mb-1"
          style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)", color: "#1F7A5C" }}
        >
          Candidatures reçues
        </p>
        <h1
          className="text-[24px] font-medium tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-fraunces, serif)", color: "#14213D" }}
        >
          {activeMission ? activeMission.missionTitle : "Gestion des candidatures"}
        </h1>
        {activeMission && (
          <p className="text-[13.5px] text-[#6B7280] mt-1">
            {activeMission.applications.length} candidature{activeMission.applications.length !== 1 ? "s" : ""} reçue{activeMission.applications.length !== 1 ? "s" : ""}
            {missions.length > 1 && ` · ${missions.length} missions actives`}
          </p>
        )}
      </div>

      <CandidaturesHub
        missions={missions}
        defaultMissionId={activeMissionId}
      />
    </div>
  );
}

