import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const revalidate = 0; // Toujours frais (données utilisateur privées)

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:          { label: "Envoyée",         color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  SUBMITTED:        { label: "Envoyée",         color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  IDENTITY_PENDING: { label: "Vérification ID", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  ACCEPTED:         { label: "Acceptée",         color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  REJECTED:         { label: "Refusée",          color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  WITHDRAWN:        { label: "Retirée",          color: "bg-[#F5F5F0] text-[#5A5750]" },
};

interface Application {
  id: string;
  missionId: string;
  missionTitle: string;
  clientName: string;
  proposedBudget: number;
  status: string;
  createdAt: string;
  coverLetter?: string;
}

async function getApplications(): Promise<Application[]> {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const freelancerProfile = await prisma.freelancerProfile.findUnique({ where: { userId } });
  if (!freelancerProfile) return [];

  const dbApps = await prisma.application.findMany({
    where: { freelancerId: freelancerProfile.id },
    orderBy: { createdAt: "desc" },
    include: { mission: { include: { client: true } } },
  });

  return dbApps.map((a) => ({
    id: a.id,
    missionId: a.missionId,
    missionTitle: a.mission.title,
    clientName: a.mission.client.companyName ?? "Client",
    proposedBudget: a.proposedBudget ?? 0,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    coverLetter: a.coverLetter ?? undefined,
  }));
}

export default async function CandidaturesPage() {
  const applications = await getApplications();

  const byStatus: Record<string, Application[]> = {};
  for (const app of applications) {
    if (!byStatus[app.status]) byStatus[app.status] = [];
    byStatus[app.status].push(app);
  }

  const counts = {
    total: applications.length,
    pending: (byStatus["PENDING"]?.length || 0) + (byStatus["IDENTITY_PENDING"]?.length || 0),
    accepted: byStatus["ACCEPTED"]?.length || 0,
    rejected: byStatus["REJECTED"]?.length || 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Mes candidatures</h2>
          <p className="text-sm text-[#5A5750]">Suivez l&apos;avancement de toutes vos candidatures</p>
        </div>
        <Link
          href="/dashboard/freelancer/recherche"
          className="inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
        >
          🔍 Trouver des missions
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total envoyées", value: counts.total, icon: "📩" },
          { label: "En attente", value: counts.pending, icon: "⏳" },
          { label: "Acceptées", value: counts.accepted, icon: "✅" },
          { label: "Refusées", value: counts.rejected, icon: "❌" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#E2E0D9] p-5">
            <p className="text-lg">{s.icon}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-[#5A5750]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      {applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
          <p className="text-3xl mb-3">📩</p>
          <h3 className="font-semibold text-lg">Aucune candidature</h3>
          <p className="mt-1 text-sm text-[#5A5750]">
            Parcourez les missions disponibles et postulez pour apparaître ici.
          </p>
          <Link
            href="/dashboard/freelancer/recherche"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            Voir les missions
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
            return (
              <div
                key={app.id}
                className="rounded-xl border border-[#E2E0D9] p-5 hover:border-[#C3D1F8] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/freelancer/missions/${app.missionId}`}
                      className="font-semibold hover:text-[#2D5BE3] transition-colors line-clamp-1"
                    >
                      {app.missionTitle}
                    </Link>
                    <p className="text-sm text-[#5A5750] mt-0.5">
                      Client : {app.clientName}
                    </p>
                    {app.coverLetter && (
                      <p className="text-sm text-[#5A5750] mt-2 line-clamp-2 italic">
                        &ldquo;{app.coverLetter}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {app.proposedBudget > 0 && (
                      <span className="text-sm font-semibold text-[#2D5BE3]">
                        {app.proposedBudget.toLocaleString()} €
                      </span>
                    )}
                    <span className="text-xs text-[#5A5750]">
                      {new Date(app.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>

                {app.status === "IDENTITY_PENDING" && (
                  <div className="mt-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
                    ⏳ Votre vérification d&apos;identité est en cours. Le client ne peut pas encore accepter votre candidature.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
