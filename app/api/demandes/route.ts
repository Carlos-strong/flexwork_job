import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/demandes
 * Créer une nouvelle demande de service
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await req.formData();
    const categorieId = formData.get("categorieId") as string;
    const serviceId = formData.get("serviceId") as string;
    const description = formData.get("description") as string;
    const adresseId = formData.get("adresseId") as string;
    const dateSouhaitee = formData.get("dateSouhaitee") as string;
    const heureSouhaitee = formData.get("heureSouhaitee") as string;
    const budgetPropose = parseFloat(formData.get("budgetPropose") as string);

    // Validation
    if (!categorieId || !serviceId || !description || !adresseId || !dateSouhaitee) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants" },
        { status: 400 }
      );
    }

    // Vérifier que le service existe
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service introuvable" },
        { status: 404 }
      );
    }

    // Vérifier que l'adresse appartient à l'utilisateur
    const adresse = await prisma.adresse.findUnique({
      where: { id: adresseId },
    });

    if (!adresse || adresse.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Adresse invalide" },
        { status: 403 }
      );
    }

    // Upload des photos
    const photos: string[] = [];
    const filesArray = formData.getAll("photos") as File[];
    for (const file of filesArray) {
      if (file instanceof File) {
        // TODO: Implémenter l'upload des photos (AWS S3, etc.)
        // Pour l'instant, on stocke juste le nom du fichier
        photos.push(`/uploads/${Date.now()}-${file.name}`);
      }
    }

    // Créer la demande
    const demande = await prisma.demande.create({
      data: {
        clientId: session.user.id,
        categorieId,
        serviceId,
        description,
        adresseId,
        dateSouhaitee: new Date(dateSouhaitee),
        heureSouhaitee,
        budgetPropose: budgetPropose || 0,
        photos,
        statut: "EN_ATTENTE",
      },
      include: {
        client: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        service: { include: { metier: true } },
        adresse: true,
      },
    });

    // TODO: Notifier les prestataires concernés (via queue, email, etc.)

    return NextResponse.json(demande, { status: 201 });
  } catch (error) {
    console.error("Erreur création demande:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/demandes
 * Lister les demandes du client (ou toutes si admin)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ville = searchParams.get("ville");
    const metierId = searchParams.get("metierId");
    const statut = searchParams.get("statut");
    const limit = parseInt(searchParams.get("limit") as string) || 10;
    const offset = parseInt(searchParams.get("offset") as string) || 0;

    // Filtres
    const where: any = {
      clientId: session.user.id, // Pour les clients : leurs propres demandes
    };

    if (ville) where.adresse = { ville };
    if (metierId) where.service = { metierId };
    if (statut) where.statut = statut;

    const [demandes, total] = await Promise.all([
      prisma.demande.findMany({
        where,
        include: {
          client: { select: { firstName: true, lastName: true, phone: true } },
          service: { include: { metier: true } },
          adresse: true,
          prestataireMetier: {
            select: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.demande.count({ where }),
    ]);

    return NextResponse.json({
      data: demandes,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Erreur lecture demandes:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
