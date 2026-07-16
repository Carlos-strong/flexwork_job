import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPayoutBalance } from "@/lib/payouts";
import { enqueueJob } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** Masque un IBAN pour l'affichage/journalisation. */
function maskDestination(method: string, destination: string): string {
  if (method === "IBAN") {
    const clean = destination.replace(/\s+/g, "");
    if (clean.length <= 8) return clean;
    return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
  }
  return destination; // Payoneer : email, laissé tel quel
}

/**
 * GET /api/payouts — liste les demandes de retrait de l'utilisateur + solde.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [payouts, balance] = await Promise.all([
    prisma.payout.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getPayoutBalance(userId),
  ]);

  return NextResponse.json({ success: true, payouts, balance });
}

/**
 * POST /api/payouts — crée une demande de retrait.
 * Body: { amount, method: "IBAN"|"PAYONEER", destination, accountHolder? }
 *
 * Le montant est revalidé contre le solde disponible côté serveur.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: {
    amount?: number;
    method?: string;
    destination?: string;
    accountHolder?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const method = body.method === "PAYONEER" ? "PAYONEER" : body.method === "IBAN" ? "IBAN" : null;
  if (!method) {
    return NextResponse.json({ error: "Méthode invalide (IBAN ou PAYONEER)" }, { status: 400 });
  }
  if (!body.destination?.trim()) {
    return NextResponse.json(
      { error: method === "IBAN" ? "IBAN requis" : "Email Payoneer requis" },
      { status: 400 }
    );
  }
  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  // Revalidation serveur : le montant ne peut dépasser le solde disponible.
  const balance = await getPayoutBalance(userId);
  if (body.amount > balance.available) {
    return NextResponse.json(
      { error: `Solde insuffisant — disponible : ${balance.available} ${balance.currency}` },
      { status: 409 }
    );
  }

  const payout = await prisma.payout.create({
    data: {
      userId,
      amount: Math.round(body.amount * 100) / 100,
      currency: balance.currency,
      method,
      destination: maskDestination(method, body.destination.trim()),
      accountHolder: body.accountHolder?.trim() || null,
      status: "PENDING",
    },
  });

  await enqueueJob("PAYOUT_REQUESTED", {
    payoutId: payout.id,
    userId,
    amount: payout.amount,
    method,
  }).catch(() => {});

  return NextResponse.json({ success: true, payout }, { status: 201 });
}
