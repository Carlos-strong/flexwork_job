/**
 * Solde disponible et demandes de retrait (payouts) du prestataire.
 *
 * Le « portefeuille » du prestataire est crédité par les libérations de jalons
 * (Payment de type RELEASE, statut SUCCEEDED) et débité par ses demandes de
 * retrait (Payout non rejetées). Le solde disponible = crédits − retraits.
 */

import { prisma } from "@/lib/prisma";

export interface PayoutBalance {
  released: number; // total libéré vers le prestataire
  withdrawn: number; // total déjà demandé/versé (payouts non rejetés)
  available: number; // solde retirable
  currency: string;
}

export async function getPayoutBalance(userId: string): Promise<PayoutBalance> {
  const [releaseAgg, payouts] = await Promise.all([
    prisma.payment.aggregate({
      where: { userId, type: "RELEASE", status: "SUCCEEDED" },
      _sum: { amount: true },
    }),
    prisma.payout.findMany({
      where: { userId, status: { not: "REJECTED" } },
      select: { amount: true },
    }),
  ]);

  const released = releaseAgg._sum.amount ?? 0;
  const withdrawn = payouts.reduce((s, p) => s + p.amount, 0);
  const available = Math.max(0, Math.round((released - withdrawn) * 100) / 100);

  return { released, withdrawn, available, currency: "EUR" };
}
