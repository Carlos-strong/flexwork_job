import { prisma } from "@/lib/prisma";
import { MissionCard } from "@/components/elements/mission-card";

// ISR : revalide toutes les 60 secondes — pas de force-dynamic, la page est mise en cache
export const revalidate = 60;

export const metadata = { title: "Missions disponibles" };

async function getMissions() {
  try {
    const dbMissions = await prisma.mission.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true } } },
    });
    return dbMissions.map((m) => ({
      id: m.id,
      title: m.title,
        budget: m.budget ?? 0,
        budgetType: m.budgetType,
        currency: m.currency ?? "XAF",
        duration: m.duration || "",
        skills: m.skills,
        applicationsCount: m._count.applications,
        expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      }));
    } catch (error) {
      console.error("Error fetching missions:", error);
      return [];
    }
  }

  export default async function MissionsPage() {
    const missions = await getMissions();

    return (
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Missions disponibles
            </h1>
            <p className="mt-2 text-[#5A5750]">
              Trouvez la mission qui correspond à vos compétences.
            </p>
          </div>
        </div>
        <div className="mt-12 grid gap-6">
          {missions.length === 0 ? (
            <p className="text-center text-[#5A5750] py-12">
              Aucune mission disponible pour le moment.
            </p>
          ) : (
            missions.map((mission) => (
                <MissionCard key={mission.id} {...mission} />
              ))
            )}
          </div>
        </div>
      );
    }
