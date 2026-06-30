import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/categories
 */
export async function GET() {
  try {
    const categories = await prisma.categorie.findMany({
      orderBy: { ordre: "asc" },
      include: {
        metiers: {
          include: { _count: { select: { services: true } } },
        },
        _count: { select: { metiers: true } },
      },
    });
    return NextResponse.json({ data: categories });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la récupération des catégories" }, { status: 500 });
  }
}

/**
 * POST /api/categories
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.categorieId && body.metierLibelle) {
      const metier = await prisma.metier.create({
        data: { categorieId: body.categorieId, libelle: body.metierLibelle, description: body.description },
      });
      return NextResponse.json({ data: metier }, { status: 201 });
    }

    const { libelle, description, icon } = body;
    if (!libelle) return NextResponse.json({ error: "libelle requis" }, { status: 400 });

    const cat = await prisma.categorie.create({ data: { libelle, description, icon } });
    return NextResponse.json({ data: cat }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "Ce libellé existe déjà" }, { status: 409 });
    console.error("Erreur création catégorie:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/categories
 * - { id, libelle?, icon?, type:"category" } → modifie une catégorie
 * - { id, libelle, type:"metier" } → modifie un métier
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, type } = body;

    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    if (type === "metier") {
      if (!body.libelle?.trim()) return NextResponse.json({ error: "libelle requis" }, { status: 400 });
      const metier = await prisma.metier.update({
        where: { id },
        data: { libelle: body.libelle },
      });
      return NextResponse.json({ data: metier });
    }

    // Par défaut : mise à jour d'une catégorie
    const data: any = {};
    if (body.libelle?.trim()) data.libelle = body.libelle;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.description !== undefined) data.description = body.description;

    const cat = await prisma.categorie.update({ where: { id }, data });
    return NextResponse.json({ data: cat });
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Ce libellé existe déjà" }, { status: 409 });
    console.error("Erreur modification:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/categories
 * - { id, type:"category" } → supprime une catégorie + ses métiers/services
 * - { id, type:"metier" } → supprime un métier + ses services
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, type } = body;

    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    if (type === "metier") {
      await prisma.service.deleteMany({ where: { metierId: id } });
      await prisma.metier.delete({ where: { id } });
      return NextResponse.json({ message: "Métier supprimé" });
    }

    // Par défaut : suppression d'une catégorie
    await prisma.service.deleteMany({ where: { metier: { categorieId: id } } });
    await prisma.metier.deleteMany({ where: { categorieId: id } });
    await prisma.categorie.delete({ where: { id } });
    return NextResponse.json({ message: "Catégorie supprimée" });
  } catch (error: any) {
    if (error?.code === "P2025") return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    console.error("Erreur suppression:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
