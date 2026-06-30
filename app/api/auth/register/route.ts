import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registerStep1Schema } from "@/lib/validations/auth";
import { notifications } from "@/lib/notifications";

/**
 * POST /api/auth/register
 * Étape 1 de l'inscription multi-step : création du compte utilisateur.
 * Crée l'utilisateur avec ses infos personnelles.
 * Le rôle (client/prestataire) détermine le profil initial et les accès.
 * Retourne l'ID utilisateur pour les étapes suivantes.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validation avec le nouveau schéma multi-step
    const parsed = registerStep1Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { firstName, lastName, phone, email, password, role } = parsed.data;
    // Extraire les champs optionnels (non validés par le schéma) pour le profil client
    const { companyName, secteur, emailPro, clientType } = body as Record<string, unknown> & {
      companyName?: string; secteur?: string; emailPro?: string; clientType?: string;
    };
    const safeFirstName = firstName.trim().slice(0, 100);
    const safeLastName = lastName.trim().slice(0, 100);
    const safeEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim().replace(/[\s.-]/g, "");

    const isDev = process.env.NODE_ENV !== "production";

    const isPrestataire = role === "prestataire";
    const activeProfile = isPrestataire ? "FREELANCER" : "CLIENT";

    try {
      // Vérifier unicité du téléphone
      const existingPhone = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
      if (existingPhone) {
        return NextResponse.json(
          { error: "Ce numéro de téléphone est déjà utilisé" },
          { status: 409 }
        );
      }

      // Vérifier unicité de l'email
      if (safeEmail) {
        const existingEmail = await prisma.user.findUnique({ where: { email: safeEmail } });
        if (existingEmail) {
          return NextResponse.json(
            { error: "Cette adresse email est déjà utilisée" },
            { status: 409 }
          );
        }
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Créer l'utilisateur + rôles + profils en une transaction
      const user = await prisma.$transaction(async (tx) => {
        // 1. Créer l'utilisateur
        const newUser = await tx.user.create({
          data: {
            firstName: safeFirstName,
            lastName: safeLastName,
            phone: normalizedPhone,
            email: safeEmail,
            passwordHash,
            activeProfile,
          },
        });

        if (isPrestataire) {
          // ── Rôle PRESTATAIRE ──
          const rolePresta = await tx.role.findUnique({ where: { libelle: "PRESTATAIRE" } });
          if (rolePresta) {
            await tx.userRole.create({
              data: { userId: newUser.id, roleId: rolePresta.id },
            });
          }

          // ── Profil freelancer (legacy / rétrocompatibilité) ──
          await tx.freelancerProfile.create({
            data: { userId: newUser.id },
          });

          // ── Rôle CLIENT (pour basculer plus tard si besoin) ──
          const roleClient = await tx.role.findUnique({ where: { libelle: "CLIENT" } });
          if (roleClient) {
            await tx.userRole.create({
              data: { userId: newUser.id, roleId: roleClient.id },
            });
          }
        } else {
          // ── Rôle CLIENT (par défaut) ──
          const roleClient = await tx.role.findUnique({ where: { libelle: "CLIENT" } });
          if (roleClient) {
            await tx.userRole.create({
              data: { userId: newUser.id, roleId: roleClient.id },
            });
          }

          // ── Profil client legacy ──
          const clientProfileData: Record<string, unknown> = { userId: newUser.id };
          if (companyName?.trim()) clientProfileData.companyName = companyName.trim().slice(0, 200);
          if (secteur?.trim()) clientProfileData.companySector = secteur.trim().slice(0, 200);
          await tx.clientProfile.create({
            data: clientProfileData as { userId: string },
          });
        }

        return newUser;
      });

      // Notifications & email d'activation (non bloquant)
      const displayName = `${safeFirstName} ${safeLastName}`;
      if (safeEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        Promise.resolve().then(async () => {
          try {
            // Générer un token d'activation sécurisé (32 octets hex)
            const rawToken = crypto.randomBytes(32).toString("hex");
            const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

            // Stocker dans VerificationToken (modèle NextAuth)
            await prisma.verificationToken.create({
              data: {
                identifier: safeEmail,
                token: rawToken,
                expires,
              },
            });

            const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(safeEmail)}`;

            // Envoyer l'email d'activation (remplace le welcome simple)
            await notifications.sendEmailVerification({
              name: displayName,
              email: safeEmail,
              verificationUrl,
            });

            // Notifier l'admin séparément
            await notifications.userRegistered({
              name: displayName,
              email: safeEmail,
              role: isPrestataire ? "PRESTATAIRE" : "CLIENT",
            });
          } catch (emailErr) {
            console.error("[Register] ❌ Erreur envoi email activation:", emailErr);
          }
        });
      }

      return NextResponse.json(
        {
          message: "Compte créé avec succès",
          userId: user.id,
          phone: user.phone,
          role: isPrestataire ? "prestataire" : "client",
          nextStep: "otp",
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      // Gestion des erreurs de contrainte unique Prisma
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta && (err.meta as Record<string, unknown>).target) || [];
        const field = Array.isArray(target) ? target.join(",") : String(target);
        return NextResponse.json({ error: `Contrainte unique violée: ${field}` }, { status: 409 });
      }

      if (!isDev) {
        return NextResponse.json(
          { error: "Service temporairement indisponible" },
          { status: 503 }
        );
      }
      // Fallback mock en dev
      console.log(`[Register] 📝 Compte mock: ${safeFirstName} ${safeLastName} (${phone})`);
      return NextResponse.json(
        {
          message: "Compte créé avec succès (mode dev)",
          userId: `dev-${Date.now()}`,
          phone,
          nextStep: "otp",
        },
        { status: 201 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
}
