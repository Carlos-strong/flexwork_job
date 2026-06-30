import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/prestataire/services
 * Récupère les services proposés par un prestataire
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const prestataireMetierId = searchParams.get("prestataireMetierId");

    const where: any = { prestataireMetier: { userId } };
    if (prestataireMetierId) {
      where.prestataireMetierId = prestataireMetierId;
    }

    const services = await prisma.prestataireService.findMany({
      where,
      include: {
        service: { include: { metier: true } },
      },
      orderBy: { service: { libelle: "asc" } },
    });

    return NextResponse.json({ data: services });
  } catch (error) {
    console.error("Erreur lecture services prestataire:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prestataire/services
 * Définit les prix des services proposés par un prestataire pour un métier donné.
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

    const { prestataireMetierId, services } = body;

    if (!prestataireMetierId || !services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json(
        { error: "prestataireMetierId et services (non vide) sont requis" },
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

    // Créer ou mettre à jour les services
    const results = [];
    for (const svc of services) {
      const { serviceId, prix, description } = svc;

      if (!serviceId) {
        continue;
      }

      const result = await prisma.prestataireService.upsert({
        where: {
          prestataireMetierId_serviceId: {
            prestataireMetierId,
            serviceId,
          },
        },
        update: { prix: prix ?? null, description: description || null },
        create: {
          prestataireMetierId,
          serviceId,
          prix: prix ?? null,
          description: description || null,
        },
      });
      results.push(result);
    }

    return NextResponse.json({
      message: `${results.length} service(s) enregistré(s)`,
      services: results,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement des services" },
      { status: 500 }
    );
  }
}
