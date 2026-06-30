import Link from "next/link";

const modules = [
  { href: "/backoffice/catalog",   label: "Taxonomie",      icon: "🗂️",  desc: "Catégories, Métiers, Services" },
  { href: "/backoffice/locations", label: "Localisation",   icon: "🌍",  desc: "Pays, Régions, Villes" },
  { href: "/backoffice/finance",   label: "Finance",        icon: "💰",  desc: "CA, Commissions, Escrow" },
  { href: "/backoffice/settings",  label: "Paramètres",     icon: "⚙️",  desc: "Commission, TVA, Devise" },
  { href: "/backoffice/roles",     label: "Rôles & Accès",  icon: "🔐",  desc: "RBAC — Super Admin, Support…" },
  { href: "/backoffice/audit",     label: "Audit",          icon: "📋",  desc: "Journal des actions critiques" },
  { href: "/backoffice/reports",   label: "Reporting",      icon: "📈",  desc: "Exports Excel, CSV, PDF" },
];

async function getKpis() {
  try {
    const [uRes, mRes, pRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users`, { next: { revalidate: 60 } }),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/missions`, { next: { revalidate: 60 } }),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/payments`, { next: { revalidate: 60 } }),
    ]);
    const users = uRes.ok ? (await uRes.json()) : [];
    const missionsData = mRes.ok ? await mRes.json() : { data: [] };
    const paymentsData = pRes.ok ? await pRes.json() : { data: [] };

    const userList = Array.isArray(users) ? users : [];
    const missionList = Array.isArray(missionsData) ? missionsData : (missionsData.data ?? []);
    const paymentList = Array.isArray(paymentsData) ? paymentsData : (paymentsData.data ?? []);

    const totalRevenue = paymentList.reduce((s: number, p: { amount: number; status: string }) =>
      p.status === "SUCCEEDED" ? s + p.amount : s, 0);
    const commission = totalRevenue * 0.05;

    return { users: userList.length, missions: missionList.length, revenue: totalRevenue, commission };
  } catch {
    return { users: 0, missions: 0, revenue: 0, commission: 0 };
  }
}

export default async function BackOfficeDashboard() {
  const kpis = await getKpis();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Back Office</h2>
        <p className="text-sm text-[#5A5750]">
          Paramétrage et supervision de la plateforme — réservé aux équipes techniques
        </p>
      </div>

      {/* KPIs plateforme */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Utilisateurs", value: kpis.users.toLocaleString(), icon: "👥" },
          { label: "Missions",     value: kpis.missions.toLocaleString(), icon: "📋" },
          { label: "CA plateforme", value: `${kpis.revenue.toLocaleString()} €`, icon: "💶" },
          { label: "Commissions",  value: `${kpis.commission.toLocaleString()} €`, icon: "💰" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#E2E0D9] p-5">
            <p className="text-xl">{kpi.icon}</p>
            <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-[#5A5750]">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Accès rapides */}
      <div>
        <h3 className="text-base font-semibold mb-4">Modules Back Office</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="rounded-xl border border-[#E2E0D9] p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{mod.icon}</span>
                <div>
                  <p className="font-semibold">{mod.label}</p>
                  <p className="text-xs text-[#5A5750] mt-0.5">{mod.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Séparation Admin / Back Office */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
        <p className="font-semibold">⚠️ Zone réservée</p>
        <p className="mt-0.5 text-xs">
          Le Back Office donne accès aux paramètres critiques de la plateforme (commissions, RBAC, taxonomie).
          Les équipes opérationnelles doivent utiliser l&apos;
          <Link href="/admin" className="underline font-medium">Admin Métier</Link>.
        </p>
      </div>
    </div>
  );
}
