import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const revalidate = 0; // Données privées utilisateur

interface Contract {
  id: string; missionTitle: string; clientName: string;
  status: string; escrowAmount: number; escrowId?: string; stripePaymentIntentId?: string;
}

async function getData(userId: string) {
  const freelancerProfile = await prisma.freelancerProfile.findUnique({ where: { userId } });

  if (!freelancerProfile) {
    const openMissions = await prisma.mission.count({ where: { status: "OPEN" } });
    return { openMissions, activeContracts: 0, totalEarned: 0, needsAction: [] as Contract[], contracts: [] as Contract[], recommendations: [] };
  }

  const [dbContracts, openMissions] = await Promise.all([
    prisma.contract.findMany({
      where: { freelancerId: freelancerProfile.id },
      orderBy: { createdAt: "desc" },
      include: { mission: { include: { client: true } } },
    }),
    prisma.mission.count({ where: { status: "OPEN" } }),
  ]);

  const contracts: Contract[] = dbContracts.map((c) => ({
    id: c.id,
    missionTitle: c.mission.title,
    clientName: c.mission.client.companyName ?? "Client",
    status: c.status,
    escrowAmount: c.escrowAmount ?? 0,
    escrowId: c.escrowId ?? undefined,
  }));

  const activeContracts = contracts.filter((c) => c.status === "ACTIVE").length;
  const totalEarned = contracts
    .filter((c) => c.status === "COMPLETED" || c.status === "ACTIVE")
    .reduce((sum, c) => sum + c.escrowAmount, 0);
  const needsAction = contracts.filter((c) => c.status === "PENDING");

  return { openMissions, activeContracts, totalEarned, needsAction, contracts: contracts.slice(0, 5), recommendations: [] };
}

export default async function FreelancerDashboardPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const { openMissions, activeContracts, totalEarned, needsAction, contracts, recommendations } = await getData(userId);

  return (
    <div className="mx-auto flex flex-col gap-6 max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-500 text-[#1A1916]">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Tableau de bord</h1>
          <p className="text-[14px] text-[#5A5750] mt-1">Suivez vos missions et vos paiements</p>
        </div>
        <Link
          href="/dashboard/freelancer/recherche"
          className="flex items-center gap-2 bg-[#2D5BE3] text-white hover:bg-[#1F4DD4] px-[18px] py-[10px] rounded-[10px] text-[13px] font-semibold transition-colors"
        >
          🔍 Trouver des missions
        </Link>
      </div>

      {/* Stats workflow */}
      <div className="flex items-stretch bg-white border border-[#E2E0D9] rounded-[16px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] flex-col sm:flex-row">
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] bg-[#FAFAF8] text-[#5A5750]">
          <span className="text-[18px] mb-1">🔍</span>
          <span className="text-[12px] text-center font-medium">Missions dispo.</span>
          <span className="text-[14px] font-bold mt-1 text-[#1A1916]">{openMissions}</span>
        </div>
        <div className={`flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] ${activeContracts > 0 ? 'bg-[#EEF2FD] text-[#2D5BE3]' : 'bg-[#FAFAF8] text-[#5A5750]'}`}>
          <span className="text-[18px] mb-1">⏳</span>
          <span className="text-[12px] text-center font-medium">Contrats actifs</span>
          <span className="text-[14px] font-bold mt-1 text-[#1A1916]">{activeContracts}</span>
        </div>
        <div className={`flex-1 flex flex-col items-center justify-center p-4 border-b sm:border-b-0 sm:border-r border-[#E2E0D9] ${totalEarned > 0 ? 'bg-[#E6F5EE] text-[#1A7A4A]' : 'bg-[#FAFAF8] text-[#5A5750]'}`}>
          <span className="text-[18px] mb-1">💰</span>
          <span className="text-[12px] text-center font-medium">Total gagné</span>
          <span className="text-[14px] font-bold mt-1 text-[#1A1916]">{totalEarned.toLocaleString()} €</span>
        </div>
        <div className={`flex-1 flex flex-col items-center justify-center p-4 ${needsAction.length > 0 ? 'bg-[#FEF3C7] text-[#B45309]' : 'bg-[#FAFAF8] text-[#5A5750]'}`}>
          <span className="text-[18px] mb-1">⚠️</span>
          <span className="text-[12px] text-center font-medium">Action requise</span>
          <span className="text-[14px] font-bold mt-1 text-[#1A1916]">{needsAction.length}</span>
        </div>
      </div>

      {/* Mes contrats actifs */}
      {contracts.length > 0 && (
        <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D9] flex-wrap gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
              <span className="inline-flex items-center justify-center bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9] px-2.5 py-1 rounded-[20px] text-[11px]">
                01
              </span>
              Mes contrats récents
            </div>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] text-left">
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#FAFAF8] group transition-colors border-b border-[#E2E0D9] last:border-0">
                      <td className="py-4 px-5">
                        <Link href={`/dashboard/freelancer/contrat/${c.id}`} className="block">
                          <div className="font-semibold text-[#1A1916]">{c.missionTitle}</div>
                          <div className="text-[12px] text-[#5A5750] mt-1">Client: {c.clientName}</div>
                          {c.escrowId && (
                            <p className="mt-1 text-[11px] text-[#9C9A95] font-mono">
                              Escrow: {c.escrowId}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="py-4 px-5 text-right font-mono text-[14px] text-[#1A1916] font-bold">
                        {c.escrowAmount?.toLocaleString()} €
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span className={`inline-block rounded-[20px] px-[10px] py-[4px] text-[11px] font-semibold ${
                          c.status === "ACTIVE" ? "bg-[#E6F5EE] text-[#1A7A4A] border border-[#9FD4B4]" :
                          c.status === "PENDING" ? "bg-[#FEF3C7] text-[#B45309] border border-[#FCD89A]" :
                          "bg-[#FAFAF8] text-[#5A5750] border border-[#E2E0D9]"
                        }`}>
                          {c.status === "ACTIVE" ? "Actif" : c.status === "PENDING" ? "En attente" : c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🤖 Uma Recommandations */}
      {recommendations.length > 0 && (
         <div className="bg-white border border-[#E2E0D9] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E0D9]">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#1A1916]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF2FD] text-lg leading-none">🤖</span>
              Uma vous recommande
            </div>
          </div>
          <div className="p-5 grid gap-4 md:grid-cols-2">
            {recommendations.slice(0, 4).map((r: {id:string;title:string;budget:number;score:number;skills:string[]}) => (
              <Link
                key={r.id}
                href={`/dashboard/freelancer/missions/${r.id}`}
                className="block rounded-[12px] border border-[#E2E0D9] p-4 hover:border-[#C3D1F8] transition-all bg-[#FAFAF8] hover:bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-[13px] line-clamp-1">{r.title}</p>
                  <span className="text-[12px] font-bold text-[#2D5BE3] whitespace-nowrap">{r.budget.toLocaleString()} €</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1.5 flex-1 rounded-full bg-[#E2E0D9]">
                    <div className="h-1.5 rounded-full bg-[#2D5BE3]" style={{ width: `${r.score}%` }} />
                  </div>
                  <span className="text-[11px] text-[#5A5750] font-medium">{r.score}% obj</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.skills?.slice(0, 3).map((s: string) => (
                    <span key={s} className="bg-white border border-[#E2E0D9] text-[#5A5750] px-[8px] py-[2px] rounded-[10px] text-[10px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Guide Rapide */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/dashboard/freelancer/profil" className="bg-white border border-[#E2E0D9] rounded-[16px] p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all flex flex-col">
          <div className="h-10 w-10 bg-[#FAFAF8] border border-[#E2E0D9] flex items-center justify-center rounded-xl text-lg mb-3">👤</div>
          <p className="text-[14px] font-semibold text-[#1A1916]">Mon profil professionnel</p>
          <p className="mt-1 text-[12px] text-[#5A5750] flex-1">Gérez vos métiers, compétences, zones d'intervention, tarifs et disponibilités.</p>
          <span className="inline-flex mt-3 text-[11px] font-bold text-[#2D5BE3]">Mettre à jour →</span>
        </Link>
        <Link href="/dashboard/freelancer/recherche" className="bg-white border border-[#E2E0D9] rounded-[16px] p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all flex flex-col">
          <div className="h-10 w-10 bg-[#EEF2FD] border border-[#C3D1F8] flex items-center justify-center rounded-xl text-lg mb-3">🔍</div>
          <p className="text-[14px] font-semibold text-[#1A1916]">Postuler à une mission</p>
          <p className="mt-1 text-[12px] text-[#5A5750] flex-1">Trouvez des missions et postulez. La vérification se fait à la première candidature.</p>
          <span className="inline-flex mt-3 text-[11px] font-bold text-[#2D5BE3]">KYC 1ère candidature →</span>
        </Link>
        <Link href="/dashboard/freelancer/paiements" className="bg-white border border-[#E2E0D9] rounded-[16px] p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all flex flex-col">
          <div className="h-10 w-10 bg-[#E6F5EE] border border-[#9FD4B4] flex items-center justify-center rounded-xl text-lg mb-3">💰</div>
          <p className="text-[14px] font-semibold text-[#1A1916]">Mes paiements</p>
          <p className="mt-1 text-[12px] text-[#5A5750] flex-1">Consultez votre solde, l'historique des versements et l'escrow.</p>
          <span className="inline-flex mt-3 text-[11px] font-bold text-[#1A7A4A]">Solde & factures →</span>
        </Link>
      </div>
    </div>
  );
}
