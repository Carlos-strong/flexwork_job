import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

export const dynamic = "force-dynamic";


/**
 * GET /api/kyc/freelances
 * Récupérer les vérifications d'identité des freelances en attente
 * Inclut aussi les freelances avec profil non validé mais sans enregistrement VerificationIdentite
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // 1. Récupérer les verifications identite avec détails utilisateur
    const verifications = await prisma.verificationIdentite.findMany({
      where: { statut: "EN_ATTENTE" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            freelancerProfile: {
              select: { id: true, isValidated: true },
            },
          },
        },
      },
      orderBy: { dateSoumission: "asc" },
    });

    // 2. Récupérer les freelances avec profil non validé mais SANS VerificationIdentite
    //    (cas : utilisateur a créé un profil freelance mais n'a pas encore uploadé ses papiers)
    const unvalidatedFreelancers = await prisma.user.findMany({
      where: {
        freelancerProfile: { isValidated: false },
        verificationsIdentite: { none: {} },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        freelancerProfile: { select: { id: true, isValidated: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Formater les freelances sans vérification comme des entrées "DOCUMENTS_MANQUANTS"
    const missingDocsEntries = unvalidatedFreelancers.map((u) => ({
      id: u.id, // userId — pour identifier l'utilisateur côté frontend
      userId: u.id,
      user: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        freelancerProfile: u.freelancerProfile,
      },
      pieceType: null,
      numeroPiece: null,
      photoRecto: null,
      photoVerso: null,
      selfieUrl: null,
      statut: "EN_ATTENTE",
      dateSoumission: null,
      dateTraitement: null,
      motifRejet: null,
      // Champ virtuel pour le frontend
      _missingDocs: true,
    }));

    // Fusionner les deux listes
    const allEntries = [...verifications, ...missingDocsEntries];

    return NextResponse.json({
      data: allEntries,
      total: allEntries.length,
      fromVerifications: verifications.length,
      fromMissingProfiles: missingDocsEntries.length,
    });
  } catch (error) {
    console.error("Erreur lecture verifications freelances:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kyc/freelances
 * Valider, rejeter ou traiter une vérification d'identité
 * Accepte verificationId (vérification existante) ou userId (profil sans docs)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { verificationId, userId, statut, motifRejet } = body;

    const targetId = verificationId || userId;

    if (!targetId || !["EN_ATTENTE", "VALIDE", "REJETE"].includes(statut)) {
      return NextResponse.json(
        { error: "Paramètres invalides" },
        { status: 400 }
      );
    }

    // Essayer de trouver par verificationId d'abord
    let verification = verificationId
      ? await prisma.verificationIdentite.findUnique({
          where: { id: verificationId },
          include: { user: { include: { freelancerProfile: { select: { id: true } } } } },
        })
      : null;

    // Si pas trouvé et userId fourni, chercher l'utilisateur directement
    let targetUser = verification?.user ?? null;
    if (!verification && userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { freelancerProfile: { select: { id: true } } },
      });
    }

    if (!verification && !targetUser) {
      return NextResponse.json(
        { error: "Vérification ou utilisateur introuvable" },
        { status: 404 }
      );
    }

    let updated: any;

    if (verification) {
      // Cas 1 : Mise à jour d'une vérification existante
      updated = await prisma.verificationIdentite.update({
        where: { id: verification.id },
        data: {
          statut,
          dateTraitement: new Date(),
          traiteParId: session.user.id,
          motifRejet: statut === "REJETE" ? motifRejet : null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              freelancerProfile: { select: { id: true } },
            },
          },
        },
      });
    } else if (targetUser && statut === "VALIDE") {
      // Cas 2 : Pas de vérification, on marque directement le profil comme validé
      if (targetUser.freelancerProfile?.id) {
        await prisma.freelancerProfile.update({
          where: { id: targetUser.freelancerProfile.id },
          data: { isValidated: true },
        });
      }
      updated = {
        user: targetUser,
        statut: "VALIDE",
        _directValidation: true,
      };
    } else {
      // Cas 3 : Pas de vérification et pas VALIDE → on ne peut que rejeter ou rien faire
      updated = {
        user: targetUser,
        statut: statut,
        _directValidation: true,
      };
    }

    // Si validation réussie, mettre à jour le profil freelance et débloquer les candidatures
    if (statut === "VALIDE") {
      if (updated.user.freelancerProfile?.id) {
        // Marquer le profil comme validé
        await prisma.freelancerProfile.update({
          where: { id: updated.user.freelancerProfile.id },
          data: { isValidated: true },
        });

        // Débloquer les candidatures IDENTITY_PENDING
        const blockedApplications = await prisma.application.findMany({
          where: {
            freelancerId: updated.user.freelancerProfile.id,
            status: "IDENTITY_PENDING" as any,
          },
          include: {
            mission: {
              include: {
                client: {
                  include: {
                    user: {
                      select: { id: true, email: true, firstName: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (blockedApplications.length > 0) {
          // Passer les candidatures à UNREAD (débloquées)
          await prisma.application.updateMany({
            where: { id: { in: blockedApplications.map(a => a.id) } },
            data: { status: "UNREAD" },
          });

          // Notifier les clients
          for (const app of blockedApplications) {
            await enqueueJob("NOTIFICATION_EMAIL", {
              to: app.mission.client.user.email,
              subject: `✅ Vérification KYC complétée - Candidature disponible`,
              template: "application_unblocked",
              data: {
                clientName: app.mission.client.user.firstName,
                freelancerName: updated.user.firstName,
                missionTitle: app.mission.title,
              },
            }).catch(() => {});
          }
        }
      }
    }

    // Envoyer email de confirmation au freelance
    const emailSubject = statut === "VALIDE"
      ? "✅ Votre identité a été vérifiée avec succès"
      : statut === "REJETE"
      ? "❌ Votre demande de vérification a été rejetée"
      : "⏳ Votre demande est en cours de traitement";

    await enqueueJob("NOTIFICATION_EMAIL", {
      to: updated.user.email,
      subject: emailSubject,
      template: "kyc_status_update",
      data: {
        name: updated.user.firstName,
        statut,
        motifRejet: motifRejet || "",
      },
    }).catch(() => {});

    return NextResponse.json({
      data: updated,
      message: `Vérification mise à jour avec le statut: ${statut}`,
    });
  } catch (error) {
    console.error("Erreur mise à jour vérification:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
