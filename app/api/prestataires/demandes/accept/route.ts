import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/prestataires/demandes/accept
 * Accepter une demande de service (prestataire)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { demandeId, prestataireMetierId } = body;

    if (!demandeId || !prestataireMetierId) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 }
      );
    }

    // Vérifier que le prestataire existe et appartient à l'utilisateur
    const prestataireMetier = await prisma.prestataireMetier.findUnique({
      where: { id: prestataireMetierId },
    });

    if (!prestataireMetier || prestataireMetier.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    // Vérifier que la demande existe
    const demande = await prisma.demande.findUnique({
      where: { id: demandeId },
    });

    if (!demande) {
      return NextResponse.json(
        { error: "Demande introuvable" },
        { status: 404 }
      );
    }

    // Mettre à jour la demande
    const updated = await prisma.demande.update({
      where: { id: demandeId },
      data: {
        prestataireMetierId,
        statut: "EN_COURS",
      },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        service: { include: { metier: true } },
        prestataireMetier: {
          select: {
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });

    // TODO: Notifier le client et les autres prestataires

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erreur acceptation demande:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
