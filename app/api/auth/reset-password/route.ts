import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/reset-password
 * Réinitialise le mot de passe d'un utilisateur avec un token valide.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, email, password, confirmPassword } = body;

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: "Token, email et mot de passe sont requis" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Les mots de passe ne correspondent pas" },
        { status: 400 }
      );
    }

    const safeEmail = email.trim().toLowerCase();

    // Vérifier le token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: safeEmail,
          token,
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Lien de réinitialisation invalide" },
        { status: 400 }
      );
    }

    if (verificationToken.expires < new Date()) {
      // Nettoyer le token expiré
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: safeEmail, token } },
      });
      return NextResponse.json(
        { error: "Le lien de réinitialisation a expiré (valable 1 heure)" },
        { status: 400 }
      );
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: safeEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    // Mettre à jour le mot de passe et supprimer le token en transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.verificationToken.delete({
        where: { identifier_token: { identifier: safeEmail, token } },
      }),
    ]);

    return NextResponse.json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (err) {
    console.error("[ResetPassword] ❌ Erreur:", err);
    return NextResponse.json(
      { error: "Service temporairement indisponible" },
      { status: 503 }
    );
  }
}
