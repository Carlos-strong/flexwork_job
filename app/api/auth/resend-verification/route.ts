import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { notifications } from "@/lib/notifications";

/**
 * POST /api/auth/resend-verification
 * Renvoie l'email d'activation du compte.
 * Génère un nouveau token (invalide l'ancien s'il existe) et le notifie par email.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const safeEmail = email.trim().toLowerCase();

    // Vérifier que l'utilisateur existe et n'a pas déjà vérifié son email
    const user = await prisma.user.findUnique({
      where: { email: safeEmail },
      select: { id: true, emailVerified: true, firstName: true, lastName: true },
    });

    if (!user) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return NextResponse.json({ message: "Si votre compte existe, un email de vérification va vous être envoyé." });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Votre email est déjà vérifié." });
    }

    // Invalider l'ancien token
    await prisma.verificationToken.deleteMany({
      where: { identifier: safeEmail },
    });

    // Générer un nouveau token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    await prisma.verificationToken.create({
      data: {
        identifier: safeEmail,
        token: rawToken,
        expires,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(safeEmail)}`;
    const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || safeEmail;

    // Envoyer l'email asynchrone (non bloquant)
    Promise.resolve().then(async () => {
      try {
        await notifications.sendEmailVerification({
          name: displayName,
          email: safeEmail,
          verificationUrl,
        });
      } catch (err) {
        console.error("[ResendVerification] ❌ Erreur envoi email:", err);
      }
    });

    return NextResponse.json({ message: "Email de vérification renvoyé." });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
