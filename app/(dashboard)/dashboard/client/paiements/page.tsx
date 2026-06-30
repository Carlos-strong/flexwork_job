import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold">Paiements</h2>
          <p className="text-sm text-[#5A5750]">Historique de vos transactions.</p>
        </div>
        <Link
          href="/dashboard/client/paiements/escrow"
          className="rounded-lg bg-[#2D5BE3] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
        >
          + Déposer des fonds
        </Link>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-[#E2E0D9] p-4">
          <p className="text-xs text-[#5A5750]">Total déposé</p>
          <p className="mt-1 text-xl font-bold text-blue-600">{totalDeposited.toLocaleString()} €</p>
          <p className="text-xs text-[#5A5750]">{deposits.length} transaction(s)</p>
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-4">
          <p className="text-xs text-[#5A5750]">Total libéré</p>
          <p className="mt-1 text-xl font-bold text-green-600">{totalReleased.toLocaleString()} €</p>
          <p className="text-xs text-[#5A5750]">{releases.length} milestone(s)</p>
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-4">
          <p className="text-xs text-[#5A5750]">Payouts effectués</p>
          <p className="mt-1 text-xl font-bold text-purple-600">{payouts.length}</p>
        </div>
      </div>

      {/* Historique */}
      <div className="rounded-xl border border-[#E2E0D9]">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Historique</h3>
          <span className="text-xs text-[#5A5750]">{payments.length} transaction(s)</span>
        </div>
        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#5A5750]">Aucun paiement pour le moment.</p>
            <p className="text-xs text-[#5A5750] mt-1">
              Les paiements apparaîtront ici après le dépôt des fonds en escrow.
            </p>
          </div>
        ) : (
          <div className="divide-y">
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
      </div>
    </div>
  );
}
