import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignatureService } from "@/lib/services/signature.service";

export const dynamic = "force-dynamic";

// GET /api/signature/integrity/[contractId]
// Vérifie l'intégrité d'un contrat verrouillé (détection de falsification)
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

    const result = await SignatureService.checkIntegrity(contractId);

    const httpStatus = result.valid ? 200 : 409; // 409 Conflict si altération détectée

    return NextResponse.json({
      success: result.valid,
      ...result,
    }, { status: httpStatus });
  } catch (error) {
    console.error("Error checking integrity:", error);
    const message = error instanceof Error ? error.message : "Erreur lors de la vérification d'intégrité";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
