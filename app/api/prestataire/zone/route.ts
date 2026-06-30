import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/prestataire/zone
 * Définit la zone d'intervention d'un prestataire pour un métier donné.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Auth: session ou userId depuis le body (flux d'inscription)
    const session = await getServerSession(authOptions);
    let userId: string | undefined = (session?.user as { id?: string })?.id;

    if (!userId && body.userId) {
      const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
      if (user) userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { prestataireMetierId, ville, arrondissement, quartier, rayonKm } = body;

    if (!prestataireMetierId || !ville) {
      return NextResponse.json(
        { error: "prestataireMetierId et ville sont requis" },
        { status: 400 }
      );
    }

    // Vérifier que le prestataireMetier appartient à l'utilisateur
    const pm = await prisma.prestataireMetier.findUnique({
      where: { id: prestataireMetierId },
    });

    if (!pm || pm.userId !== userId) {
      return NextResponse.json(
        { error: "Métier prestataire introuvable" },
        { status: 404 }
      );
    }

    const zone = await prisma.zoneIntervention.create({
      data: {
        prestataireMetierId,
        ville,
        arrondissement: arrondissement || null,
        quartier: quartier || null,
        rayonKm: rayonKm || 10,
      },
    });

    return NextResponse.json({
      message: "Zone d'intervention enregistrée",
      zone,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la zone" },
      { status: 500 }
    );
  }
}
