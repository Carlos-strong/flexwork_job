import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignatureService } from "@/lib/services/signature.service";

export const dynamic = "force-dynamic";

// GET /api/signature/audit/[contractId]
// Retourne le journal d'audit immuable d'un contrat
export async function GET(
  _request: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const contractId = params.contractId;

    // Vérifier que l'utilisateur a accès à ce contrat
    const userId = (session.user as any)?.id;
    const activeProfile = (session.user as any)?.activeProfile;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        mission: { select: { client: { select: { userId: true } } } },
        offer: { include: { application: { select: { freelancer: { select: { userId: true } } } } } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const isClient = contract.mission.client.userId === userId;
    const isFreelancer = contract.offer?.application.freelancer.userId === userId;
    if (!isClient && !isFreelancer && activeProfile !== "ADMIN") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const trail = await SignatureService.getAuditTrail(contractId);

    return NextResponse.json({ success: true, ...trail });
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération du journal d'audit" }, { status: 500 });
  }
}
