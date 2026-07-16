import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, SectionCard, EmptyState } from "@/components/dashboard/ui";

export const metadata = { title: "Mes paiements" };
export const revalidate = 0; // Données financières privées

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

async function getClientPayments() {
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

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  DEPOSIT: { label: "Dépôt escrow", icon: "💰", color: "text-blue-600" },
  RELEASE: { label: "Libération milestone", icon: "🔓", color: "text-green-600" },
  PAYOUT: { label: "Versement freelance", icon: "💸", color: "text-purple-600" },
  REFUND: { label: "Remboursement", icon: "↩️", color: "text-red-600" },
};

export default async function ClientPaymentsPage() {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const payments = await getClientPayments();
  if (payments === null) redirect("/connexion");

  const deposits = payments.filter((p) => p.type === "DEPOSIT");
  const releases = payments.filter((p) => p.type === "RELEASE");
  const payouts = payments.filter((p) => p.type === "PAYOUT");

  const totalDeposited = deposits.reduce((s, p) => s + p.amount, 0);
  const totalReleased = releases.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 text-[#1A1916] animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        title="Paiements"
        subtitle="Historique de vos transactions escrow, libérations de jalons et versements."
        actions={
          <Link
            href="/dashboard/client/paiements/escrow"
            className="flex items-center gap-2 rounded-[10px] bg-[#2D5BE3] px-[18px] py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1F4DD4]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Déposer des fonds
          </Link>
        }
      />

      {/* Résumé */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total déposé"
          value={`${totalDeposited.toLocaleString()} €`}
          icon="💰"
          tone="blue"
          hint={`${deposits.length} transaction(s)`}
        />
        <StatCard
          label="Total libéré"
          value={`${totalReleased.toLocaleString()} €`}
          icon="🔓"
          tone="green"
          hint={`${releases.length} milestone(s)`}
        />
        <StatCard
          label="Payouts effectués"
          value={payouts.length}
          icon="💸"
          tone="purple"
        />
      </div>

      {/* Historique */}
      <SectionCard title="Historique" count={payments.length} bodyClassName="">
        {payments.length === 0 ? (
          <EmptyState
            icon="💳"
            title="Aucun paiement pour le moment"
            description="Les paiements apparaîtront ici après le dépôt des fonds en escrow."
            dashed={false}
          />
        ) : (
          <div className="divide-y divide-[#E2E0D9]">
            {payments.map((p) => {
              const typeInfo = TYPE_LABELS[p.type] || { label: p.type, icon: "💳", color: "text-[#5A5750]" };
              return (
                <div key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{typeInfo.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${typeInfo.color}`}>{typeInfo.label}</p>
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
                      {p.status === "SUCCEEDED" ? "Validé" : p.status === "FAILED" ? "Échoué" : p.status}
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
