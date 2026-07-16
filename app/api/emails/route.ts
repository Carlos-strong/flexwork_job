import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/emails
 *
 * Historique des emails reçus par l'utilisateur connecté
 * (activation, offres, contrats, paiements…). Alimente l'onglet
 * "Emails" de la messagerie, en complément du chat temps réel.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const email = session?.user?.email;

    if (!userId && !email) {
      return NextResponse.json({ data: [] }, { status: 401 });
    }

    const logs = await prisma.emailLog.findMany({
      where: userId
        ? { userId }
        : { to: { contains: email as string } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        subject: true,
        category: true,
        preview: true,
        status: true,
        readAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error("[GET /api/emails] ❌", err);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
