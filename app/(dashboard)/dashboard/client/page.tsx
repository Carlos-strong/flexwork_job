import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { PHASE_LABELS } from "@/lib/contract-workflow";
import type { ContractPhase } from "@/lib/contract-workflow";
import { PageHeader, StatCard, SectionCard } from "@/components/dashboard/ui";

export const revalidate = 0; // Données privées utilisateur

interface ContractSummary {
  id: string;
  missionId: string;
  missionTitle: string;
  freelancerName: string;
  status: string;
  phase: ContractPhase;
  totalBudget: number;
  validatedCount: number;
  totalMilestones: number;
}

async function getStats(userId: string) {
  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!clientProfile) {
    return { missions: [], contracts: [], byStep: { DRAFT: 0, PUBLISHED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }, totalSpent: 0, totalApps: 0, needsAction: [] };
  }

  const [dbMissions, dbContracts] = await Promise.all([
    prisma.mission.findMany({
      where: { clientId: clientProfile.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true } } },
    }),
    prisma.contract.findMany({
      where: { mission: { clientId: clientProfile.id } },
      orderBy: { createdAt: "desc" },
      include: {
        mission: { select: { title: true, clientId: true } },
        offer: {
          include: {
            application: {
              include: {
                freelancer: {
                  include: { user: { select: { firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
        milestones: { select: { status: true } },
      },
    }),
  ]);

  const missions = dbMissions.map((m) => ({
    id: m.id,
    title: m.title,
    budget: m.budget ?? 0,
    currency: m.currency ?? "XAF",
    budgetType: m.budgetType,
    status: m.status,
    workflowStep: m.status,
    applicationsCount: m._count.applications,
    duration: m.duration ?? "",
    description: m.description,
    expiresAt: m.expiresAt,
  }));

  const byStep = {
    DRAFT: missions.filter((m) => m.status === "DRAFT").length,
    PUBLISHED: missions.filter((m) => m.status === "OPEN").length,
    IN_PROGRESS: missions.filter((m) => m.status === "IN_PROGRESS").length,
    COMPLETED: missions.filter((m) => m.status === "COMPLETED").length,
    CANCELLED: missions.filter((m) => m.status === "CANCELLED").length,
  };

  const totalSpent = missions
    .filter((m) => m.status === "IN_PROGRESS" || m.status === "COMPLETED")
    .reduce((sum, m) => sum + m.budget, 0);

  const totalApps = missions.reduce((sum, m) => sum + m.applicationsCount, 0);

  const needsAction = missions.filter((m) => m.status === "IN_PROGRESS");

  // Contrats avec mapping vers les phases du workflow
  const contracts: ContractSummary[] = dbContracts.map((c) => {
    const freelancerUser = c.offer?.application.freelancer.user;
    return {
      id: c.id,
      missionId: c.missionId,
      missionTitle: c.mission.title,
      freelancerName: `${freelancerUser?.firstName || ""} ${freelancerUser?.lastName || ""}`.trim() || "Prestataire",
      status: c.status,
      phase: mapPrismaToPhase(c.status),
      totalBudget: c.totalBudget ?? 0,
      validatedCount: c.milestones.filter((m) => m.status === "APPROVED" || m.status === "RELEASED").length,
      totalMilestones: c.milestones.length,
    };
  });

  return { missions, contracts, byStep, totalSpent, totalApps, needsAction };
}

function mapPrismaToPhase(status: string): ContractPhase {
  switch (status) {
    case "PENDING": return "CONTRACT_GENERATED";
    case "ACTIVE": return "CONTRACT_ACTIVE";
    case "COMPLETED": return "COMPLETED";
    case "DISPUTED": return "DISPUTE_OPENED";
    default: return "NEGOTIATION";
  }
}

const WORKFLOW_LABELS: Record<string, string> = {
  // Mission (legacy)
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée",
  PROPOSALS_RECEIVED: "Candidatures",
  FREELANCER_SELECTED: "Freelance choisi",
  CONTRACT_CREATED: "Contrat créé",
  FUNDED: "Financée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrable reçu",
  APPROVED: "Approuvée",
  PAID: "Payée",
  CANCELLED: "Annulée",
  // Contrat (workflow phases)
  NEGOTIATION: "Négociation",
  TERMS_LOCKED: "Termes verrouillés",
  CONTRACT_GENERATED: "Contrat généré",
  PENDING_FUNDING: "En attente de fonds",
  CONTRACT_ACTIVE: "Contrat actif",
  CLOSING: "Clôture en cours",
  COMPLETED: "Terminé",
  DISPUTE_OPENED: "Litige en cours",
  DISPUTE_RESOLVED: "Litige résolu",
};

export default async function ClientDashboardPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const { missions, contracts, byStep, totalSpent, totalApps, needsAction } = await getStats(userId);

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <PageHeader
        title="Tableau de bord"
        subtitle="Gérez vos missions et suivez leur progression."
        actions={
          <Link
            href="/dashboard/client/missions/creation"
            className="flex items-center gap-2 bg-[#2D5BE3] text-white hover:bg-[#1F4DD4] px-[18px] py-[10px] rounded-[10px] text-[13px] font-semibold transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Publier une mission
          </Link>
        }
      />

      {/* Statistiques par étape workflow */}
      <div className="flex items-stretch bg-white border border-[#E2E0D9] rounded-[16px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] flex-col sm:flex-row">
        <StepTile label="Brouillons" value={byStep.DRAFT} icon="📝" />
        <StepTile label="Publiées" value={byStep.PUBLISHED} icon="📢" />
        <StepTile label="En cours" value={byStep.IN_PROGRESS} icon="⏳" />
        <StepTile label="Terminées" value={byStep.COMPLETED} icon="✅" />
        <StepTile label="Annulées" value={byStep.CANCELLED} icon="🚫" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total dépensé" value={`${totalSpent.toLocaleString()} €`} icon="💶" tone="blue" />
        <StatCard label="Candidatures reçues" value={totalApps} icon="📩" tone="neutral" />
        <StatCard label="Actions requises" value={needsAction.length} icon="⚠️" tone="amber" />
      </div>

      {/* Missions avec suivi workflow */}
      <SectionCard
        title="Vos récentes missions"
        count={1}
        aside={
          <Link href="/dashboard/client/missions" className="text-[12px] font-semibold text-[#2D5BE3] hover:underline">
            Tout voir →
          </Link>
        }
        bodyClassName=""
      >
        <div className="p-0">
          {missions.length === 0 ? (
            <div className="text-center py-10 px-4 border-b border-[#E2E0D9] bg-[#FAFAF8]">
              <p className="text-[#5A5750] text-[14px]">Vous n'avez pas encore de missions enregistrées.</p>
              <Link
                href="/dashboard/client/missions/creation"
                className="inline-flex mt-4 items-center gap-2 bg-white border border-[#E2E0D9] text-[#1A1916] hover:bg-[#FAFAF8] px-[16px] py-[8px] rounded-[10px] text-[13px] font-medium transition-colors"
              >
                + Publier votre première mission
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] text-left">
                <tbody>
                  {missions.slice(0, 5).map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAFAF8] group transition-colors border-b border-[#E2E0D9] last:border-0">
                      <td className="py-4 px-5">
                        <Link href={`/dashboard/client/missions/${m.id}`} className="block">
                          <p className="font-semibold text-[#1A1916]">{m.title}</p>
                          <p className="text-[12px] text-[#5A5750] mt-1">
                            <span className="text-[#B45309] font-medium">
                              {m.expiresAt
                                ? (() => {
                                    const days = Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return days > 0 ? `⏰ Expire dans ${days} jour(s)` : "⏰ Expirée";
                                  })()
                                : "⏰ Ouverte en continu"}
                            </span>
                            <span className="ml-2">· {m.duration}</span>
                          </p>
                        </Link>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <span className="font-mono text-[14px] font-bold text-[#1A1916] block mb-1">
                          {m.budgetType === "OPEN_QUOTE" ? "Budget libre" : formatCurrency(m.budget, m.currency)}
                        </span>
                        <WorkflowBadge step={m.workflowStep || m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Contrats avec workflow de pilotage */}
      {contracts.length > 0 && (
        <SectionCard title="Contrats et pilotage" count={2} bodyClassName="">
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] text-left">
                <tbody>
                  {contracts.slice(0, 5).map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAFAF8] group transition-colors border-b border-[#E2E0D9] last:border-0">
                      <td className="py-4 px-5">
                        <Link href={`/dashboard/client/missions/${c.missionId}/contract`} className="block">
                          <p className="font-semibold text-[#1A1916]">{c.missionTitle}</p>
                          <p className="text-[12px] text-[#5A5750] mt-1">
                            Prestataire : {c.freelancerName}
                            {c.phase === "CONTRACT_ACTIVE" && (
                              <span className="ml-2 text-[#2D5BE3]">
                                · {c.validatedCount}/{c.totalMilestones} jalons validés
                              </span>
                            )}
                          </p>
                        </Link>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <span className="font-mono text-[14px] font-bold text-[#1A1916] block mb-1">
                          {c.totalBudget.toLocaleString()} €
                        </span>
                        <ContractBadge phase={c.phase} />
                      </td>
                      <td className="py-4 px-5 text-right">
                        <Link
                          href={`/dashboard/client/missions/${c.missionId}/contract`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2D5BE3] text-white text-[11px] font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Ouvrir
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function StepTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  const hasValue = value > 0;
  return (
    <div className={`flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] transition-colors ${hasValue ? 'bg-[#EEF2FD] text-[#2D5BE3]' : 'bg-white text-[#9C9A95]'}`}>
      <span className="text-[18px] mb-1">{icon}</span>
      <span className="text-[12px] text-center font-medium capitalize">{label}</span>
      <span className={`text-[16px] font-bold mt-1 ${hasValue ? 'text-[#1A1916]' : 'text-[#9C9A95]'}`}>{value}</span>
    </div>
  );
}

function WorkflowBadge({ step }: { step: string }) {
  const label = WORKFLOW_LABELS[step] || step;
  
  if (["DRAFT"].includes(step)) {
    return <span className="inline-flex items-center bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["PUBLISHED", "OPEN", "PROPOSALS_RECEIVED"].includes(step)) {
    return <span className="inline-flex items-center bg-[#EEF2FD] text-[#2D5BE3] border border-[#C3D1F8] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["FREELANCER_SELECTED", "CONTRACT_CREATED", "FUNDED", "IN_PROGRESS"].includes(step)) {
    return <span className="inline-flex items-center bg-[#FEF3C7] text-[#B45309] border border-[#FCD89A] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["DELIVERED", "APPROVED", "PAID", "COMPLETED"].includes(step)) {
    return <span className="inline-flex items-center bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["CANCELLED"].includes(step)) {
    return <span className="inline-flex items-center bg-[#FDECEA] text-[#C0392B] border border-[#F5BCBC] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  // Contract phases (workflow)
  if (["NEGOTIATION", "TERMS_LOCKED", "CONTRACT_GENERATED", "PENDING_FUNDING"].includes(step)) {
    return <span className="inline-flex items-center bg-[#EEF2FD] text-[#2D5BE3] border border-[#C3D1F8] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["FUNDED", "CONTRACT_ACTIVE"].includes(step)) {
    return <span className="inline-flex items-center bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["CLOSING"].includes(step)) {
    return <span className="inline-flex items-center bg-[#FEF3C7] text-[#B45309] border border-[#FCD89A] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["DISPUTE_OPENED"].includes(step)) {
    return <span className="inline-flex items-center bg-[#FDECEA] text-[#C0392B] border border-[#F5BCBC] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }
  if (["DISPUTE_RESOLVED"].includes(step)) {
    return <span className="inline-flex items-center bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">{label}</span>;
  }

  return (
    <span className="inline-flex items-center bg-[#F0ECFA] text-[#6B4FBB] border border-[#C9BBF0] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">
      {label}
    </span>
  );
}

function ContractBadge({ phase }: { phase: ContractPhase }) {
  const label = PHASE_LABELS[phase] || phase;

  const config: Record<string, string> = {
    NEGOTIATION: "bg-[#EEF2FD] text-[#2D5BE3] border-[#C3D1F8]",
    TERMS_LOCKED: "bg-[#EEF2FD] text-[#2D5BE3] border-[#C3D1F8]",
    CONTRACT_GENERATED: "bg-[#EEF2FD] text-[#2D5BE3] border-[#C3D1F8]",
    PENDING_FUNDING: "bg-[#FEF3C7] text-[#B45309] border-[#FCD89A]",
    FUNDED: "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]",
    CONTRACT_ACTIVE: "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]",
    CLOSING: "bg-[#FEF3C7] text-[#B45309] border-[#FCD89A]",
    COMPLETED: "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]",
    DISPUTE_OPENED: "bg-[#FDECEA] text-[#C0392B] border-[#F5BCBC]",
    DISPUTE_RESOLVED: "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]",
    CANCELLED: "bg-[#FDECEA] text-[#C0392B] border-[#F5BCBC]",
  };

  const cls = config[phase] || "bg-[#FAFAF8] text-[#5A5750] border-[#E2E0D9]";

  return (
    <span className={`inline-flex items-center border px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
