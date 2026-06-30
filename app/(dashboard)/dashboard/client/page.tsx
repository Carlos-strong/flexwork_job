import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 0; // Données privées utilisateur

async function getStats(userId: string) {
  const clientProfile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!clientProfile) {
    return { missions: [], byStep: { DRAFT: 0, PUBLISHED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }, totalSpent: 0, totalApps: 0, needsAction: [] };
  }

  const dbMissions = await prisma.mission.findMany({
    where: { clientId: clientProfile.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

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
  // Missions nécessitant une action (EN_ATTENTE de validation ou livraison)
  const needsAction = missions.filter(
    (m) => m.status === "IN_PROGRESS"
  );

  return { missions, byStep, totalSpent, totalApps, needsAction };
}

const WORKFLOW_LABELS: Record<string, string> = {
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
};

export default async function ClientDashboardPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const { missions, byStep, totalSpent, totalApps, needsAction } = await getStats(userId);

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Tableau de bord</h1>
          <p className="text-[14px] text-[#5A5750] mt-1">Gérez vos missions et suivez leur progression</p>
        </div>
        <Link
          href="/dashboard/client/missions/creation"
          className="flex items-center gap-2 bg-[#2D5BE3] text-white hover:bg-[#1F4DD4] px-[18px] py-[10px] rounded-[10px] text-[13px] font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Publier une mission
        </Link>
      </div>

      {/* Statistiques par étape workflow */}
      <div className="flex items-stretch bg-white border border-[#E2E0D9] rounded-[16px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] flex-col sm:flex-row">
        <StatCard label="Brouillons" value={byStep.DRAFT} icon="📝" />
        <StatCard label="Publiées" value={byStep.PUBLISHED} icon="📢" />
        <StatCard label="En cours" value={byStep.IN_PROGRESS} icon="⏳" />
        <StatCard label="Terminées" value={byStep.COMPLETED} icon="✅" />
        <StatCard label="Annulées" value={byStep.CANCELLED} icon="🚫" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-[16px] border border-[#E2E0D9] p-6 shadow-sm">
          <p className="text-[13px] text-[#9C9A95] uppercase tracking-wider font-semibold">Total dépensé</p>
          <p className="mt-2 text-3xl font-bold text-[#1A1916]">{totalSpent.toLocaleString()} €</p>
        </div>
        <div className="bg-white rounded-[16px] border border-[#E2E0D9] p-6 shadow-sm">
          <p className="text-[13px] text-[#9C9A95] uppercase tracking-wider font-semibold">Candidatures reçues</p>
          <p className="mt-2 text-3xl font-bold text-[#1A1916]">{totalApps}</p>
        </div>
        <div className="bg-[#FEF3C7] rounded-[16px] border border-[#FCD89A] p-6 shadow-sm">
          <p className="text-[13px] text-[#B45309] uppercase tracking-wider font-semibold">⚠️ Actions requises</p>
          <p className="mt-2 text-3xl font-bold text-[#B45309]">{needsAction.length}</p>
        </div>
      </div>

      {/* Missions avec suivi workflow */}
      <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D9] flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
            <span className="inline-flex items-center justify-center bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-2.5 py-1 rounded-[20px] text-[11px]">
               01
            </span>
            Vos récentes missions
          </div>
          <Link href="/dashboard/client/missions" className="text-[12px] font-semibold text-[#2D5BE3] hover:underline">
            Tout voir →
          </Link>
        </div>
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
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
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

  return (
    <span className="inline-flex items-center bg-[#F0ECFA] text-[#6B4FBB] border border-[#C9BBF0] px-[10px] py-[4px] rounded-[20px] text-[11px] font-semibold">
      {label}
    </span>
  );
}
