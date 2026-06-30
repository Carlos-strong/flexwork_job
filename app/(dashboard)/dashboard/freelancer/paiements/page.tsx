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
  const payouts = allPayments.filter((p) => p.type === "PAYOUT");
  const releases = allPayments.filter((p) => p.type === "RELEASE");

  const totalPaid = payouts
    .filter((p) => p.status === "SUCCEEDED")
    .reduce((s, p) => s + p.amount, 0);
  const totalPending = releases
    .filter((p) => p.status !== "SUCCEEDED")
    .reduce((s, p) => s + p.amount, 0);
  const totalReleased = releases
    .filter((p) => p.status === "SUCCEEDED")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">Paiements</h2>
        <p className="text-sm text-[#5A5750]">Suivez vos encaissements et votre solde.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-[#E2E0D9] p-4">
          <p className="text-xs text-[#5A5750]">Total reçu</p>
          <p className="mt-1 text-xl font-bold text-green-600">{totalPaid.toLocaleString()} €</p>
          <p className="text-xs text-[#5A5750]">{payouts.filter(p => p.status === "SUCCEEDED").length} payout(s)</p>
        </div>
        <div className="rounded-xl border border-[#E2E0D9] p-4">
          <p className="text-xs text-[#5A5750]">Libéré (milestones)</p>
          <p className="mt-1 text-xl font-bold text-blue-600">{totalReleased.toLocaleString()} €</p>
          <p className="text-xs text-[#5A5750]">{releases.filter(p => p.status === "SUCCEEDED").length} milestone(s)</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10 p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">En attente</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{totalPending.toLocaleString()} €</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E0D9]">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Historique des paiements</h3>
          <span className="text-xs text-[#5A5750]">{allPayments.length} transaction(s)</span>
        </div>
        {allPayments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#5A5750]">Aucun paiement pour le moment.</p>
            <p className="text-xs text-[#5A5750] mt-1">
              Les paiements apparaîtront ici une fois les milestones validés et les fonds libérés.
            </p>
          </div>
        ) : (
          <div className="divide-y">
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
      </div>
    </div>
  );
}
