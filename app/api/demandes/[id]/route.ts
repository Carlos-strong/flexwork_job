import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/demandes/[id]
 * Récupérer les détails d'une demande
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const demande = await prisma.demande.findUnique({
      where: { id: params.id },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        service: { include: { metier: true } },
        categorie: true,
        adresse: true,
        prestataireMetier: {
          select: {
            id: true,
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    // Vérifier les permissions (client ou prestataire assigné)
    if (
      demande.clientId !== session.user.id &&
      demande.prestataireMetier?.user.id !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    return NextResponse.json(demande);
  } catch (error) {
    console.error("Erreur lecture demande:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/demandes/[id]
 * Mettre à jour une demande (accepter, refuser, ou assigner à un prestataire)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { statut, prestataireMetierId, description } = body;

    const demande = await prisma.demande.findUnique({
      where: { id: params.id },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    // Vérification des permissions
    if (demande.clientId !== session.user.id) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    // Mise à jour
    const updatedData: any = {};

    if (statut) {
      if (
        !["EN_ATTENTE", "EN_COURS", "COMPLETEE", "ANNULEE"].includes(statut)
      ) {
        return NextResponse.json(
          { error: "Statut invalide" },
          { status: 400 }
        );
      }
      updatedData.statut = statut;
    }

    if (prestataireMetierId) {
      // Vérifier que le prestataire existe et est validé
      const prestataireMetier = await prisma.prestataireMetier.findUnique({
        where: { id: prestataireMetierId },
      });

      if (!prestataireMetier) {
        return NextResponse.json(
          { error: "Prestataire introuvable" },
          { status: 404 }
        );
      }

      if (prestataireMetier.statutValidation !== "VALIDE") {
        return NextResponse.json(
          { error: "Prestataire non validé" },
          { status: 403 }
        );
      }

      updatedData.prestataireMetierId = prestataireMetierId;
      updatedData.statut = "EN_COURS";
    }

    if (description) {
      updatedData.description = description;
    }

    const updated = await prisma.demande.update({
      where: { id: params.id },
      data: updatedData,
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        service: { include: { metier: true } },
        prestataireMetier: {
          select: { user: { select: { firstName: true, lastName: true, phone: true } } },
        },
      },
    });

    // TODO: Notifier le client et/ou le prestataire

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erreur mise à jour demande:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/demandes/[id]
 * Supprimer une demande (avant qu'elle soit acceptée)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const demande = await prisma.demande.findUnique({
      where: { id: params.id },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }

    // Vérification des permissions
    if (demande.clientId !== session.user.id) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      );
    }

    // Vérifier qu'elle n'est pas en cours
    if (demande.statut !== "EN_ATTENTE") {
      return NextResponse.json(
        { error: "Impossible de supprimer une demande en cours" },
        { status: 400 }
      );
    }

    await prisma.demande.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur suppression demande:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
