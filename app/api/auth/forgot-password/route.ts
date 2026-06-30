import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { EmailTemplates } from "@/lib/email";

/**
 * POST /api/auth/forgot-password
 * Génère un token de réinitialisation et l'envoie par email.
 * Ne révèle pas si l'email existe ou non (sécurité).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      );
    }

    const safeEmail = email.trim().toLowerCase();

    // Vérifier que l'utilisateur existe (en silence)
    const user = await prisma.user.findUnique({
      where: { email: safeEmail },
      select: { id: true, firstName: true, lastName: true },
    });

    // Toujours répondre OK pour ne pas révéler si l'email existe
    if (!user) {
      return NextResponse.json({
        message: "Si cette adresse correspond à un compte, un email a été envoyé.",
      });
    }

    // Invalider les anciens tokens pour cet email
    await prisma.verificationToken.deleteMany({
      where: { identifier: safeEmail },
    });

    // Générer un token sécurisé
    const rawToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // +1h

    await prisma.verificationToken.create({
      data: {
        identifier: safeEmail,
        token: rawToken,
        expires,
      },
    });

    // Construire le lien de réinitialisation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reinitialiser-mot-de-passe?token=${rawToken}&email=${encodeURIComponent(safeEmail)}`;

    const firstName = user.firstName || "";

    // Envoyer l'email de réinitialisation
    const tpl = EmailTemplates.passwordReset({
      name: firstName,
      resetUrl,
    });

    const result = await sendEmail({
      to: safeEmail,
      ...tpl,
    });

    if (!result.success) {
      console.error("[ForgotPassword] ❌ Échec envoi email:", result.error);
    }

    return NextResponse.json({
      message: "Si cette adresse correspond à un compte, un email a été envoyé.",
    });
  } catch (err) {
    console.error("[ForgotPassword] ❌ Erreur:", err);
    return NextResponse.json(
      { error: "Service temporairement indisponible" },
      { status: 503 }
    );
  }
}
