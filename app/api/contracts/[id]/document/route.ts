import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateContractHtml,
  getContractTemplateData,
} from "@/lib/services/contract-template.service";

export const dynamic = "force-dynamic";

// GET /api/contracts/[id]/document
// Génère et retourne le contrat de prestation au format HTML (prêt à imprimer/PDF)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const contractId = params.id;
    const format = _request.nextUrl.searchParams.get("format") || "html";

    // 1. Récupérer les données du contrat
    const data = await getContractTemplateData(contractId);

    if (!data) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    // 2. Vérifier que l'utilisateur est bien partie prenante
    const userId = (session.user as { id?: string })?.id;
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        mission: { select: { client: { select: { userId: true } } } },
        offer: {
          include: {
            application: {
              select: { freelancer: { select: { userId: true } } },
            },
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const isClient = contract.mission.client.userId === userId;
    const isFreelancer = contract.offer?.application.freelancer.userId === userId;

    if (!isClient && !isFreelancer) {
      return NextResponse.json({ error: "Accès non autorisé à ce contrat" }, { status: 403 });
    }

    // 3. Générer le HTML
    const html = generateContractHtml(data);

    if (format === "json") {
      return NextResponse.json({
        success: true,
        data,
        html,
      });
    }

    // 4. Retourner le HTML
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="contrat-${data.reference}.html"`,
      },
    });
  } catch (error) {
    console.error("Error generating contract document:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du document" },
      { status: 500 }
    );
  }
}
