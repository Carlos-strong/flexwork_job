export default function ClientAvisPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Avis donnés</h2>
        <p className="text-sm text-[#5A5750]">Les évaluations que vous avez laissées aux freelances</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Avis donnés", value: "0", icon: "⭐" },
          { label: "Note moyenne donnée", value: "—", icon: "📊" },
          { label: "Missions évaluées", value: "0", icon: "✅" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#E2E0D9] p-5 text-center">
            <p className="text-xl">{s.icon}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-[#5A5750]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
        <p className="text-4xl mb-3">⭐</p>
        <h3 className="font-semibold text-lg">Aucun avis pour l&apos;instant</h3>
        <p className="mt-1 text-sm text-[#5A5750]">
          Les avis que vous laisserez aux freelances à la fin de chaque mission apparaîtront ici.
        </p>
      </div>
    </div>
  );
}
