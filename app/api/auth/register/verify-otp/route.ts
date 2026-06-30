import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/register/verify-otp
 * Vérifie un code OTP pour valider le numéro de téléphone.
 * En cas de succès, le téléphone de l'utilisateur est marqué comme vérifié.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: "userId et code sont requis" },
        { status: 400 }
      );
    }

    // Chercher un code OTP valide pour cet utilisateur
    const otp = await prisma.otpCode.findFirst({
      where: {
        userId,
        code,
        estUtilise: false,
        expiresAt: { gte: new Date() },
        type: "VERIFICATION_PHONE",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "Code invalide ou expiré" },
        { status: 400 }
      );
    }

    // Marquer le code comme utilisé
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { estUtilise: true },
    });

    // Marquer le téléphone comme vérifié
    await prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: new Date() },
    });

    return NextResponse.json({
      message: "Téléphone vérifié avec succès",
      verified: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}
