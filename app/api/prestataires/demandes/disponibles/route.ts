import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";


/**
 * GET /api/prestataires/demandes/disponibles
 * Récupérer les demandes disponibles pour le prestataire
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer les métiers du prestataire
    const prestataireMetiers = await prisma.prestataireMetier.findMany({
      where: {
        userId: session.user.id,
        statutValidation: "VALIDE",
      },
      select: { id: true, metierId: true },
    });

    if (prestataireMetiers.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
      });
    }

    const metiersIds = prestataireMetiers.map((m) => m.metierId);

    // Récupérer les demandes disponibles dans ses métiers
    const demandes = await prisma.demande.findMany({
      where: {
        statut: "EN_ATTENTE",
        prestataireMetierId: null, // Pas encore assignée
        service: {
          metierId: { in: metiersIds },
        },
      },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        service: { include: { metier: true } },
        categorie: true,
        adresse: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: demandes,
      total: demandes.length,
    });
  } catch (error) {
    console.error("Erreur lecture demandes disponibles:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
