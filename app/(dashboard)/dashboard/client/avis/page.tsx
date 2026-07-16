import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getReviewDashboardData } from "@/lib/reviews";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/dashboard/ui";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewList } from "@/components/reviews/review-list";

export const metadata = { title: "Avis" };
export const revalidate = 0;

export default async function ClientAvisPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/connexion");

  const { given, received, receivedAverage, eligible } = await getReviewDashboardData(userId, "client");

  const stats = [
    { label: "Avis donnés", value: String(given.length), icon: "⭐", tone: "amber" as const },
    {
      label: "Note moyenne donnée",
      value: given.length > 0 ? (given.reduce((s, r) => s + r.rating, 0) / given.length).toFixed(1) : "—",
      icon: "📊",
      tone: "blue" as const,
    },
    { label: "À évaluer", value: String(eligible.length), icon: "📝", tone: "green" as const },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 text-[#1A1916] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Avis"
        subtitle="Évaluez les prestataires à la fin de chaque mission et consultez les avis reçus."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
        ))}
      </div>

      {/* Missions terminées à évaluer */}
      {eligible.length > 0 && (
        <SectionCard title="Missions à évaluer" count={eligible.length} bodyClassName="p-4">
          <div className="flex flex-col gap-4">
            {eligible.map((c) => (
              <ReviewForm
                key={c.contractId}
                contractId={c.contractId}
                missionTitle={c.missionTitle}
                targetName={c.targetName}
                subLabels={{
                  quality: "Qualité",
                  communication: "Communication",
                  deadline: "Respect des délais",
                }}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Avis donnés */}
      <SectionCard title="Avis donnés" count={given.length} bodyClassName="">
        <ReviewList reviews={given} emptyLabel="Vous n'avez pas encore laissé d'avis." />
      </SectionCard>

      {/* Avis reçus (en tant que client) */}
      <SectionCard
        title={received.length > 0 ? `Avis reçus — note moyenne ${receivedAverage}/5` : "Avis reçus"}
        count={received.length}
        bodyClassName=""
      >
        <ReviewList reviews={received} emptyLabel="Vous n'avez pas encore reçu d'avis." />
      </SectionCard>

      {given.length === 0 && received.length === 0 && eligible.length === 0 && (
        <EmptyState
          icon="⭐"
          title="Aucun avis pour l'instant"
          description="Les avis apparaîtront ici une fois vos premières missions terminées."
        />
      )}
    </div>
  );
}
