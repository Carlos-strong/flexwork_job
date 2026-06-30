export default function FreelancerReviewsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Avis reçus</h2>
        <p className="text-sm text-[#5A5750]">Les évaluations laissées par vos clients après chaque mission</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E2E0D9] p-6 text-center">
          <p className="text-4xl font-bold text-[#2D5BE3]">—</p>
          <p className="mt-1 text-sm text-[#5A5750]">Note moyenne</p>
          <div className="mt-2 flex justify-center gap-0.5 text-amber-400">
            {[1,2,3,4,5].map((s) => <span key={s}>☆</span>)}
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-6 text-center">
          <p className="text-4xl font-bold">0</p>
          <p className="mt-1 text-sm text-[#5A5750]">Avis reçus</p>
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-6 text-center">
          <p className="text-4xl font-bold">0%</p>
          <p className="mt-1 text-sm text-[#5A5750]">Taux de recommandation</p>
        </div>
      </div>

      {/* Liste vide */}
      <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
        <p className="text-4xl mb-3">⭐</p>
        <h3 className="font-semibold text-lg">Aucun avis pour l&apos;instant</h3>
        <p className="mt-1 text-sm text-[#5A5750]">
          Les avis apparaîtront ici une fois que vos clients auront évalué vos missions.
        </p>
      </div>
    </div>
  );
}
