import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 30; // ISR 30s — suffisant pour les détails de mission
export const dynamicParams = true;

export const metadata = { title: "Détail de la mission" };

async function getMission(id: string) {
  try {
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    });
    return mission;
  } catch {
    return null;
  }
}

export default async function PublicMissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [mission, session] = await Promise.all([
    getMission(params.id),
    getSession(),
  ]);

  if (!mission) {
    notFound();
  }

  const isAuthenticated = !!session?.user;
  const activeProfile = (session?.user as { activeProfile?: string } | undefined)?.activeProfile;

  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <Link
        href="/missions"
        className="inline-flex items-center text-sm text-[#5A5750] hover:text-[#1A1916] mb-8"
      >
        ← Retour aux missions
      </Link>

      <div className="max-w-3xl mx-auto">
        {/* En-tête */}
        <div className="rounded-xl border border-[#E2E0D9] p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{mission.title}</h1>
              <span
                className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  mission.status === "OPEN"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-[#F5F5F0] text-[#5A5750]"
                }`}
              >
                {mission.status === "OPEN" ? "Mission ouverte" : mission.status}
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#2D5BE3]">
                {mission.budget ? `${Number(mission.budget).toLocaleString()} €` : "Budget libre"}
              </p>
              {mission.duration && (
                <p className="text-sm text-[#5A5750]">{mission.duration}</p>
              )}
            </div>
          </div>

          <p className="mt-6 text-sm text-[#5A5750] leading-relaxed whitespace-pre-line">
            {mission.description}
          </p>

          {mission.skills.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {mission.skills.map((s: string) => (
                <span
                  key={s}
                  className="rounded-full bg-[#EEF2FD] px-3 py-1 text-xs font-medium text-[#2D5BE3]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 text-sm text-[#5A5750] space-y-1">
            {mission.location && <p>📍 {mission.location}</p>}
            <p>👥 {mission._count.applications} candidature(s)</p>
            {mission.workMode && (
              <p>
                🏢 Mode :{" "}
                {mission.workMode === "REMOTE"
                  ? "100% à distance"
                  : mission.workMode === "ON_SITE"
                  ? "Sur site"
                  : "Hybride"}
              </p>
            )}
          </div>
        </div>

        {/* CTA — adapté selon le statut de connexion */}
        <div className="text-center">
          {!isAuthenticated ? (
            <>
              <p className="text-[#5A5750] mb-4">
                Vous êtes freelance et cette mission vous intéresse ?
              </p>
              <Link
                href={`/connexion?callbackUrl=/missions/${mission.id}`}
                className="inline-block rounded-lg bg-[#2D5BE3] px-6 py-3 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Se connecter pour postuler
              </Link>
            </>
          ) : activeProfile === "FREELANCER" ? (
            <>
              <p className="text-[#5A5750] mb-4">
                Cette mission vous intéresse ? Postulez depuis votre tableau de bord.
              </p>
              <Link
                href={`/dashboard/freelancer/recherche`}
                className="inline-block rounded-lg bg-[#2D5BE3] px-6 py-3 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Voir mes missions
              </Link>
            </>
          ) : (
            <>
              <p className="text-[#5A5750] mb-4">
                Gérez vos missions depuis votre tableau de bord.
              </p>
              <Link
                href={`/dashboard/client/missions/${mission.id}`}
                className="inline-block rounded-lg bg-[#2D5BE3] px-6 py-3 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
              >
                Voir dans mon tableau de bord
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
