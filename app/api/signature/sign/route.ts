import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignatureService } from "@/lib/services/signature.service";

export const dynamic = "force-dynamic";

// POST /api/signature/sign
// Signe un contrat avec le certificat de l'utilisateur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { contractId, certificateId, passphrase } = body;

    if (!contractId || !certificateId || !passphrase) {
      return NextResponse.json(
        { error: "contractId, certificateId et passphrase sont requis" },
        { status: 400 }
      );
    }

    const result = await SignatureService.signContract({
      contractId,
      certificateId,
      passphrase,
      signerIp: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      signerUserAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error signing contract:", error);
    const message = error instanceof Error ? error.message : "Erreur lors de la signature";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
