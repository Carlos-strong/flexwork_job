import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignatureService } from "@/lib/services/signature.service";

export const dynamic = "force-dynamic";

// POST /api/signature/verify
// Vérifie les signatures d'un contrat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { contractId, signatureId } = body;

    if (!contractId) {
      return NextResponse.json({ error: "contractId est requis" }, { status: 400 });
    }

    const result = await SignatureService.verifySignature({
      contractId,
      signatureId: signatureId || undefined,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error verifying signature:", error);
    const message = error instanceof Error ? error.message : "Erreur lors de la vérification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
