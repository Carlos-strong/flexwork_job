import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPayoutBalance } from "@/lib/payouts";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/dashboard/ui";
import { WithdrawForm } from "@/components/payouts/withdraw-form";

export const metadata = { title: "Mes paiements" };
export const revalidate = 0; // Données financières privées

const PAYOUT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "En attente", cls: "bg-yellow-100 text-yellow-700" },
  PROCESSING: { label: "En cours", cls: "bg-blue-100 text-blue-700" },
  PAID: { label: "Versé", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "Refusé", cls: "bg-red-100 text-red-700" },
};

interface Payment {
  id: string;
  amount: number;
  type: string;
  status: string;
  currency: string;
  contractId: string;
  createdAt: string;
  stripePaymentId?: string;
  trustEngineId?: string;
}

async function getFreelancerPayments() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return null;

  const dbPayments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return dbPayments.map((p) => ({
    id: p.id,
    amount: p.amount,
    type: p.type,
    status: p.status,
    currency: p.currency,
    contractId: (p.metadata as { contractId?: string } | null)?.contractId ?? "",
    stripePaymentId: p.stripePaymentId ?? undefined,
    trustEngineId: p.trustEngineId ?? undefined,
    createdAt: p.createdAt.toISOString(),
  }));
}

export default async function FreelancerPayoutsPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const allPayments = await getFreelancerPayments();
  if (allPayments === null) redirect("/connexion");
  const releases = allPayments.filter((p) => p.type === "RELEASE");

  const [balance, payoutRequests] = await Promise.all([
    getPayoutBalance(userId),
    prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const totalReleased = releases
    .filter((p) => p.status === "SUCCEEDED")
    .reduce((s, p) => s + p.amount, 0);

  const holder = [
    (session?.user as { firstName?: string } | undefined)?.firstName,
    (session?.user as { lastName?: string } | undefined)?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 text-[#1A1916] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Paiements"
        subtitle="Suivez vos encaissements, votre solde et vos retraits."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Solde disponible"
          value={`${balance.available.toLocaleString()} €`}
          icon="💰"
          tone="green"
          hint="Retirable maintenant"
        />
        <StatCard
          label="Libéré (milestones)"
          value={`${totalReleased.toLocaleString()} €`}
          icon="🔓"
          tone="blue"
          hint={`${releases.filter((p) => p.status === "SUCCEEDED").length} milestone(s)`}
        />
        <StatCard
          label="Retraits demandés"
          value={`${balance.withdrawn.toLocaleString()} €`}
          icon="💸"
          tone="amber"
          hint={`${payoutRequests.length} demande(s)`}
        />
      </div>

      {/* Retrait des fonds */}
      <SectionCard title="Retrait des fonds" bodyClassName="p-5">
        <WithdrawForm available={balance.available} currency={balance.currency} defaultHolder={holder} />
        {balance.available === 0 && (
          <p className="mt-3 text-xs text-[#8a8e82]">
            Votre solde disponible sera crédité au fur et à mesure de la validation de vos jalons.
          </p>
        )}
      </SectionCard>

      {/* Historique des demandes de retrait */}
      {payoutRequests.length > 0 && (
        <SectionCard title="Mes demandes de retrait" count={payoutRequests.length} bodyClassName="">
          <div className="divide-y divide-[#E2E0D9]">
            {payoutRequests.map((p) => {
              const st = PAYOUT_STATUS_LABELS[p.status] ?? PAYOUT_STATUS_LABELS.PENDING;
              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium">
                      {p.method === "IBAN" ? "Virement bancaire" : "Payoneer"} — {p.destination}
                    </p>
                    <p className="text-xs text-[#5A5750]">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{p.amount.toLocaleString()} {p.currency}</p>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Historique des paiements" count={allPayments.length} bodyClassName="">
        {allPayments.length === 0 ? (
          <EmptyState
            icon="💳"
            title="Aucun paiement pour le moment"
            description="Les paiements apparaîtront ici une fois les milestones validés et les fonds libérés."
            dashed={false}
          />
        ) : (
          <div className="divide-y divide-[#E2E0D9]">
            {allPayments.map((p) => {
              const isPayout = p.type === "PAYOUT";
              const isRelease = p.type === "RELEASE";
              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isPayout ? "💸" : isRelease ? "🔓" : "💰"}</span>
                    <div>
                      <p className="text-sm font-medium">
                        {isPayout ? "Versement bancaire" : isRelease ? "Libération milestone" : p.type}
                      </p>
                      <p className="text-xs text-[#5A5750]">
                        {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-[#5A5750] font-mono">
                        {p.stripePaymentId || p.trustEngineId || p.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{p.amount.toLocaleString()} {p.currency || "€"}</p>
                    <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "SUCCEEDED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : p.status === "FAILED"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    }`}>
                      {p.status === "SUCCEEDED" ? "Validé" : p.status === "FAILED" ? "Échoué" : "En attente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
