import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getReviewDashboardData } from "@/lib/reviews";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/dashboard/ui";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewList } from "@/components/reviews/review-list";

export const metadata = { title: "Avis" };
export const revalidate = 0;

export default async function FreelancerReviewsPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/connexion");

  const { given, received, receivedAverage, eligible } = await getReviewDashboardData(userId, "freelancer");

  const recommendRate =
    received.length > 0
      ? Math.round((received.filter((r) => r.rating >= 4).length / received.length) * 100)
      : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 text-[#1A1916] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Avis"
        subtitle="Les évaluations laissées par vos clients, et les clients qu'il vous reste à évaluer."
      />

      {/* Stats globales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Note moyenne"
          value={receivedAverage != null ? `${receivedAverage}/5` : "—"}
          icon="⭐"
          tone="blue"
        />
        <StatCard label="Avis reçus" value={String(received.length)} icon="💬" tone="neutral" />
        <StatCard label="Taux de recommandation" value={`${recommendRate}%`} icon="👍" tone="green" />
      </div>

      {/* Clients à évaluer */}
      {eligible.length > 0 && (
        <SectionCard title="Clients à évaluer" count={eligible.length} bodyClassName="p-4">
          <div className="flex flex-col gap-4">
            {eligible.map((c) => (
              <ReviewForm
                key={c.contractId}
                contractId={c.contractId}
                missionTitle={c.missionTitle}
                targetName={c.targetName}
                subLabels={{
                  quality: "Clarté du brief",
                  communication: "Communication",
                  deadline: "Paiement dans les délais",
                }}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Avis reçus */}
      <SectionCard title="Avis reçus" count={received.length} bodyClassName="">
        <ReviewList reviews={received} emptyLabel="Vous n'avez pas encore reçu d'avis." />
      </SectionCard>

      {/* Avis donnés aux clients */}
      {given.length > 0 && (
        <SectionCard title="Avis donnés" count={given.length} bodyClassName="">
          <ReviewList reviews={given} emptyLabel="Vous n'avez pas encore laissé d'avis." />
        </SectionCard>
      )}

      {given.length === 0 && received.length === 0 && eligible.length === 0 && (
        <EmptyState
          icon="⭐"
          title="Aucun avis pour l'instant"
          description="Les avis apparaîtront ici une fois que vos clients auront évalué vos missions."
        />
      )}
    </div>
  );
}
