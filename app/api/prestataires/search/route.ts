import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";


/**
 * GET /api/prestataires/search
 * Rechercher les prestataires disponibles pour un service
 * Query params: serviceId, ville, quartier
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    const ville = searchParams.get("ville");
    const quartier = searchParams.get("quartier");

    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId requis" },
        { status: 400 }
      );
    }

    // Récupérer le service et son métier
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service introuvable" },
        { status: 404 }
      );
    }

    // Rechercher les prestataires validés pour ce métier
    const prestataires = await prisma.prestataireMetier.findMany({
      where: {
        metierId: service.metierId,
        statutValidation: "VALIDE",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            image: true,
          },
        },
        metier: true,
        zones: {
          where: ville ? { ville } : undefined,
        },
        servicesProposes: {
          where: { serviceId },
          include: { service: true },
        },
      },
    });

    // Filtrer par zone si nécessaire
    let filtered = prestataires;
    if (ville && quartier) {
      filtered = prestataires.filter((p) =>
        p.zones.some((z) => z.ville === ville && (!z.quartier || z.quartier === quartier))
      );
    }

    return NextResponse.json({
      data: filtered.map((p) => ({
        ...p,
        prixService: p.servicesProposes[0]?.prix || null,
      })),
      total: filtered.length,
    });
  } catch (error) {
    console.error("Erreur recherche prestataires:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
