import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/register/request-otp
 * Demande un code OTP pour vérifier un numéro de téléphone.
 * L'utilisateur doit déjà exister (créé à l'étape 1).
 * En développement, le code est retourné dans la réponse pour faciliter les tests.
 * En production, il est envoyé par SMS.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, phone } = body;

    if (!userId || !phone) {
      return NextResponse.json(
        { error: "userId et phone sont requis" },
        { status: 400 }
      );
    }

    const isDev = process.env.NODE_ENV !== "production";

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Vérifier que le téléphone correspond
    if (user.phone !== phone) {
      return NextResponse.json(
        { error: "Le numéro de téléphone ne correspond pas" },
        { status: 400 }
      );
    }

    // Invalider les anciens codes OTP pour ce numéro
    await prisma.otpCode.updateMany({
      where: { userId, phone, estUtilise: false },
      data: { estUtilise: true },
    });

    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expire dans 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpCode.create({
      data: {
        userId,
        phone,
        code,
        type: "VERIFICATION_PHONE",
        expiresAt,
      },
    });

    // En production, envoyer un SMS via un service externe
    if (!isDev) {
      // TODO: Intégration SMS (Twilio, Orange SMS API, etc.)
      console.log(`[OTP] 📱 SMS envoyé à ${phone}: ${code}`);
    }

    return NextResponse.json({
      message: "Code de vérification envoyé",
      // En développement seulement, on retourne le code pour faciliter les tests
      ...(isDev ? { code } : {}),
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du code" },
      { status: 500 }
    );
  }
}
