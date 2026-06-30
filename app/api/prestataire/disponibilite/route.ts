import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/prestataire/disponibilite
 * Définit les disponibilités d'un prestataire pour un métier donné.
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

    const { prestataireMetierId, disponibilites } = body;

    if (!prestataireMetierId || !disponibilites || !Array.isArray(disponibilites) || disponibilites.length === 0) {
      return NextResponse.json(
        { error: "prestataireMetierId et disponibilites (non vide) sont requis" },
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

    // Supprimer les anciennes disponibilités et créer les nouvelles
    await prisma.disponibilite.deleteMany({
      where: { prestataireMetierId },
    });

    const results = [];
    for (const dispo of disponibilites) {
      // Accepter 'jour' (formulaire) ou 'jourSemaine' (API directe)
      const jourSemaine = dispo.jourSemaine || dispo.jour;
      const { heureDebut, heureFin } = dispo;
      const estDisponible = dispo.estDisponible !== false; // true par défaut
      if (!jourSemaine || !heureDebut || !heureFin) continue;

      const result = await prisma.disponibilite.create({
        data: {
          prestataireMetierId,
          jourSemaine,
          heureDebut,
          heureFin,
          estDisponible,
        },
      });
      results.push(result);
    }

    return NextResponse.json({
      message: `${results.length} disponibilité(s) enregistrée(s)`,
      disponibilites: results,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement des disponibilités" },
      { status: 500 }
    );
  }
}
