import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/register/address
 * Ajoute une adresse principale à l'utilisateur (étape 2 de l'inscription).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, pays, ville, arrondissement, quartier, adresseDetaillee, latitude, longitude } = body;

    if (!userId || !ville) {
      return NextResponse.json(
        { error: "userId et ville sont requis" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    const adresse = await prisma.adresse.create({
      data: {
        userId,
        intitule: "Domicile",
        pays: pays || "Cameroun",
        ville,
        arrondissement: arrondissement || null,
        quartier: quartier || null,
        adresseDetaillee,
        latitude: latitude || null,
        longitude: longitude || null,
        estPrincipale: true,
      },
    });

    return NextResponse.json({
      message: "Adresse enregistrée",
      adresse,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'adresse" },
      { status: 500 }
    );
  }
}
