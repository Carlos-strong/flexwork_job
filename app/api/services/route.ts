import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/services?categorieId=xxx&metierId=xxx
 * Récupérer tous les services, avec filtres optionnels
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorieId = searchParams.get("categorieId");
    const metierId = searchParams.get("metierId");

    const where: any = {};

    if (metierId) {
      where.metierId = metierId;
    } else if (categorieId) {
      // Si on filtre par catégorie, on doit d'abord récupérer les métiers
      const metiers = await prisma.metier.findMany({
        where: { categorieId },
        select: { id: true },
      });
      where.metierId = { in: metiers.map((m) => m.id) };
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        metier: {
          include: {
            categorie: true,
          },
        },
      },
      orderBy: { libelle: "asc" },
    });

    return NextResponse.json({ data: services });
  } catch (error) {
    console.error("Erreur lecture services:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/services
 * Créer un nouveau service (admin seulement)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { metierId, libelle, description, dureeEstimee } = body;

    if (!metierId || !libelle) {
      return NextResponse.json(
        { error: "metierId et libelle requis" },
        { status: 400 }
      );
    }

    // Vérifier que le métier existe
    const metier = await prisma.metier.findUnique({
      where: { id: metierId },
    });

    if (!metier) {
      return NextResponse.json(
        { error: "Métier introuvable" },
        { status: 404 }
      );
    }

    const service = await prisma.service.create({
      data: {
        metierId,
        libelle,
        description,
        dureeEstimee,
      },
      include: {
        metier: { include: { categorie: true } },
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Erreur création service:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/services
 * Met à jour un service (libelle, description, dureeEstimee)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, libelle, description, dureeEstimee } = body;
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const data: any = {};
    if (libelle?.trim()) data.libelle = libelle;
    if (description !== undefined) data.description = description;
    if (dureeEstimee !== undefined) data.dureeEstimee = dureeEstimee ? Number(dureeEstimee) : null;

    const service = await prisma.service.update({ where: { id }, data });
    return NextResponse.json({ data: service });
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    console.error("Erreur modification service:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/services
 * Supprime un service
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ message: "Service supprimé" });
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    console.error("Erreur suppression service:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
