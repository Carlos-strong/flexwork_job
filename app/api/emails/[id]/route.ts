import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/emails/[id]
 * Détail complet d'un email (HTML inclus) + marquage automatique comme lu.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const email = session?.user?.email;
    if (!userId && !email) {
      return NextResponse.json({ data: null }, { status: 401 });
    }

    const log = await prisma.emailLog.findUnique({ where: { id: params.id } });
    if (!log) {
      return NextResponse.json({ data: null }, { status: 404 });
    }

    // Vérifie que l'email appartient bien à l'utilisateur connecté
    const owns = (userId && log.userId === userId) || (email && log.to.includes(email));
    if (!owns) {
      return NextResponse.json({ data: null }, { status: 403 });
    }

    if (!log.readAt) {
      await prisma.emailLog.update({ where: { id: log.id }, data: { readAt: new Date() } });
    }

    return NextResponse.json({ data: log });
  } catch (err) {
    console.error("[GET /api/emails/[id]] ❌", err);
    return NextResponse.json({ data: null }, { status: 500 });
  }
}
