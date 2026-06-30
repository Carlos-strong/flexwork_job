import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/users/adresses
 * Récupérer les adresses de l'utilisateur connecté
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const adresses = await prisma.adresse.findMany({
      where: { userId: session.user.id },
      orderBy: { estPrincipale: "desc" },
    });

    return NextResponse.json({ data: adresses });
  } catch (error) {
    console.error("Erreur lecture adresses:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/adresses
 * Créer une nouvelle adresse pour l'utilisateur
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { intitule, pays, ville, arrondissement, quartier, adresseDetaillee, latitude, longitude, estPrincipale } = body;

    if (!ville || !adresseDetaillee) {
      return NextResponse.json(
        { error: "Ville et adresse détaillée requises" },
        { status: 400 }
      );
    }

    // Si c'est la première adresse, la marquer comme principale
    const count = await prisma.adresse.count({
      where: { userId: session.user.id },
    });

    const adresse = await prisma.adresse.create({
      data: {
        userId: session.user.id,
        intitule: intitule || "Domicile",
        pays: pays || "Cameroun",
        ville,
        arrondissement,
        quartier,
        adresseDetaillee,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        estPrincipale: estPrincipale || count === 0,
      },
    });

    return NextResponse.json(adresse, { status: 201 });
  } catch (error) {
    console.error("Erreur création adresse:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
