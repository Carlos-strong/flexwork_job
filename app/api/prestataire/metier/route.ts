import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


/**
 * POST /api/prestataire/metier
 * Ajoute un métier exercé par le prestataire (PrestataireMetier).
 * Étape 5 de l'inscription prestataire.
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

    const { metierId, experience, description, modeTarification, taux } = body;

    if (!metierId) {
      return NextResponse.json({ error: "Le métier est requis" }, { status: 400 });
    }

    // Vérifier que le métier existe
    const metier = await prisma.metier.findUnique({ where: { id: metierId } });
    if (!metier) {
      return NextResponse.json({ error: "Métier introuvable" }, { status: 404 });
    }

    // Vérifier si l'utilisateur exerce déjà ce métier
    const existing = await prisma.prestataireMetier.findUnique({
      where: { userId_metierId: { userId, metierId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Vous exercez déjà ce métier" },
        { status: 409 }
      );
    }

    // Vérifier si l'utilisateur a une vérification d'identité validée
    const verification = await prisma.verificationIdentite.findFirst({
      where: { userId, statut: "VALIDE" },
    });

    const prestataire = await prisma.prestataireMetier.create({
      data: {
        userId,
        metierId,
        experience: experience || null,
        description: description || null,
        modeTarification: modeTarification || "PAR_PRESTATION",
        taux: taux || null,
        statutValidation: verification ? "EN_ATTENTE" : "EN_ATTENTE",
      },
      include: {
        metier: {
          include: { categorie: true },
        },
      },
    });

    return NextResponse.json({
      message: "Métier ajouté avec succès. En attente de validation administrative.",
      prestataireMetier: prestataire,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de l'ajout du métier" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prestataire/metier
 * Liste les métiers exercés par l'utilisateur connecté.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    const metiers = await prisma.prestataireMetier.findMany({
      where: { userId },
      include: {
        metier: {
          include: { categorie: true },
        },
        servicesProposes: {
          include: { service: true },
        },
        zones: true,
        disponibilites: true,
      },
    });

    return NextResponse.json({ metiers });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des métiers" },
      { status: 500 }
    );
  }
}
