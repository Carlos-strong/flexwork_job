import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/auth/verify-email?token=TOKEN&email=EMAIL
 *
 * Flux d'activation du compte :
 *   1. Recherche le VerificationToken correspondant (identifier=email, token=token)
 *   2. Vérifie que le token n'est pas expiré
 *   3. Marque User.emailVerified = now()
 *   4. Supprime le VerificationToken utilisé
 *   5. Redirige vers le dashboard du rôle (ou /connexion si pas de profil)
 *
 * En cas d'erreur, redirige vers /connexion?error=invalid_token ou ?error=expired_token
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  // ── Paramètres manquants ──
  if (!token || !email) {
    return NextResponse.redirect(`${APP_URL}/connexion?error=invalid_token`);
  }

  const safeEmail = decodeURIComponent(email).trim().toLowerCase();

  try {
    // ── Rechercher le token ──
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: safeEmail, token } },
    });

    if (!verificationToken) {
      console.warn(`[VerifyEmail] Token introuvable pour ${safeEmail}`);
      return NextResponse.redirect(`${APP_URL}/connexion?error=invalid_token`);
    }

    // ── Vérifier l'expiration ──
    if (verificationToken.expires < new Date()) {
      // Supprimer le token expiré pour nettoyer
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: safeEmail, token } },
      }).catch(() => {});
      console.warn(`[VerifyEmail] Token expiré pour ${safeEmail}`);
      return NextResponse.redirect(`${APP_URL}/connexion?error=expired_token`);
    }

    // ── Récupérer l'utilisateur pour connaître son rôle ──
    const user = await prisma.user.findUnique({
      where: { email: safeEmail },
      select: { activeProfile: true },
    });

    // ── Marquer l'email comme vérifié + supprimer le token en transaction ──
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { email: safeEmail, emailVerified: null },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: { identifier_token: { identifier: safeEmail, token } },
      }),
    ]);

    console.log(`[VerifyEmail] ✅ Email vérifié : ${safeEmail}`);

    // ── Rediriger vers le dashboard approprié ──
    if (user?.activeProfile === "FREELANCER") {
      return NextResponse.redirect(`${APP_URL}/dashboard/freelancer?verified=true`);
    }
    if (user?.activeProfile === "ADMIN") {
      return NextResponse.redirect(`${APP_URL}/admin?verified=true`);
    }
    // CLIENT ou fallback → dashboard client
    return NextResponse.redirect(`${APP_URL}/dashboard/client?verified=true`);
  } catch (err) {
    console.error("[VerifyEmail] ❌ Erreur:", err);
    return NextResponse.redirect(`${APP_URL}/connexion?error=server_error`);
  }
}
