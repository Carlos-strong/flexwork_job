import Link from "next/link";

interface Contract {
  id: string;
  missionTitle: string;
  freelancerName: string;
  status: string;
  escrowAmount: number;
  createdAt: string;
  missionId: string;
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "En attente",  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
  ACTIVE:    { label: "Actif",        color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  COMPLETED: { label: "Terminé",      color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  DISPUTED:  { label: "Litige",       color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

async function getContracts(): Promise<Contract[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/contracts`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data ?? []);
  } catch { return []; }
}

export default async function ClientContratsPage() {
  const contracts = await getContracts();

  const active = contracts.filter((c) => c.status === "ACTIVE");
  const totalEscrow = active.reduce((sum, c) => sum + (c.escrowAmount || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Mes contrats</h2>
          <p className="text-sm text-[#5A5750]">Suivez vos contrats en cours et les milestones</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Contrats actifs", value: active.length, icon: "✅" },
          { label: "Total séquestré", value: `${totalEscrow.toLocaleString()} €`, icon: "🔐" },
          { label: "Terminés", value: contracts.filter((c) => c.status === "COMPLETED").length, icon: "🏁" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#E2E0D9] p-5">
            <p className="text-xl">{s.icon}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-[#5A5750]">{s.label}</p>
          </div>
        ))}
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E0D9] p-16 text-center">
          <p className="text-3xl mb-3">📝</p>
          <h3 className="font-semibold text-lg">Aucun contrat</h3>
          <p className="mt-1 text-sm text-[#5A5750]">
            Un contrat est créé automatiquement lorsque vous acceptez la candidature d&apos;un freelance.
          </p>
          <Link
            href="/dashboard/client/missions"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
          >
            Mes missions
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => {
            const cfg = STATUS[c.status] || STATUS.PENDING;
            return (
              <Link
                key={c.id}
                href={`/dashboard/client/missions/${c.missionId}/contract`}
                className="block rounded-xl border border-[#E2E0D9] p-5 hover:border-[#C3D1F8] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.missionTitle}</p>
                    <p className="text-sm text-[#5A5750] mt-0.5">Freelance : {c.freelancerName}</p>
                    <p className="text-xs text-[#5A5750] mt-1">
                      {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <p className="text-sm font-bold text-[#2D5BE3]">
                      {c.escrowAmount?.toLocaleString()} € 🔐
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
