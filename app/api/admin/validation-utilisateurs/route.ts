import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

export const dynamic = "force-dynamic";


/**
 * GET /api/admin/validation-utilisateurs
 * Récupérer les prestataires en attente de validation
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.user.activeProfile !== "ADMIN") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
    }

    const prestataires = await prisma.prestataireMetier.findMany({
      where: {
        statutValidation: "EN_ATTENTE",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        metier: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      data: prestataires,
      total: prestataires.length,
    });
  } catch (error) {
    console.error("Erreur lecture prestataires:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/validation-utilisateurs
 * Valider ou rejeter un prestataire
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (session.user.activeProfile !== "ADMIN") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
    }

    const body = await req.json();
    const { prestataireMetierId, statut, motifRejet } = body;

    if (!prestataireMetierId || !["VALIDE", "REJETE"].includes(statut)) {
      return NextResponse.json(
        { error: "Paramètres invalides" },
        { status: 400 }
      );
    }

    const prestataire = await prisma.prestataireMetier.findUnique({
      where: { id: prestataireMetierId },
      include: { user: true },
    });

    if (!prestataire) {
      return NextResponse.json(
        { error: "Prestataire introuvable" },
        { status: 404 }
      );
    }

    // Mettre à jour le statut
    const updated = await prisma.prestataireMetier.update({
      where: { id: prestataireMetierId },
      data: {
        statutValidation: statut,
        dateValidation: new Date(),
        valideParId: session.user.id,
        motifRejet: statut === "REJETE" ? motifRejet : null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        metier: true,
      },
    });

    // Notification email au prestataire (validation ou rejet)
    const emailSubject = statut === "VALIDE"
      ? "✅ Votre profil professionnel a été validé"
      : "❌ Votre profil professionnel a été rejeté";
    await enqueueJob("NOTIFICATION_EMAIL", {
      to: updated.user.email,
      subject: emailSubject,
      template: statut === "VALIDE" ? "welcome" : "contract",
      data: {
        name: `${updated.user.firstName} ${updated.user.lastName}`,
        metier: updated.metier?.libelle ?? "",
        motifRejet: motifRejet ?? "",
      },
    }).catch(() => {});

    // ── Point d'attention #3 corrigé ──────────────────────
    // Quand le KYC est validé, débloquer les candidatures IDENTITY_PENDING
    // du freelance et notifier les clients concernés.
    if (statut === "VALIDE") {
      try {
        // Trouver le profil freelance lié à cet utilisateur
        const freelancerProfile = await prisma.freelancerProfile.findUnique({
          where: { userId: prestataire.userId },
          select: { id: true },
        });

        if (freelancerProfile) {
          // Récupérer toutes les candidatures bloquées en IDENTITY_PENDING
          const blockedApps = await prisma.application.findMany({
            where: {
              freelancerId: freelancerProfile.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              status: "IDENTITY_PENDING" as any,
            },
            include: {
              mission: {
                include: { client: { include: { user: { select: { id: true, email: true, firstName: true } } } } },
              },
            },
          });

          if (blockedApps.length > 0) {
            // Débloquer en masse → SUBMITTED
            await prisma.application.updateMany({
              where: { id: { in: blockedApps.map((a) => a.id) } },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: { status: "SUBMITTED" as any },
            });

            // Notifier le client pour chaque candidature débloquée
            for (const app of blockedApps) {
              const clientUser = app.mission.client?.user;
              if (clientUser) {
                await enqueueJob("APPLICATION_SUBMITTED", {
                  applicationId: app.id,
                  missionId: app.missionId,
                  freelancerId: prestataire.userId,
                  freelancerName: `${updated.user.firstName} ${updated.user.lastName}`,
                  proposedBudget: app.proposedBudget ?? 0,
                }).catch(() => {});

                await enqueueJob("NOTIFICATION_EMAIL", {
                  to: clientUser.email,
                  subject: `📋 Nouvelle candidature disponible — ${app.mission.title}`,
                  template: "welcome",
                  data: {
                    name: clientUser.firstName ?? "Client",
                    message: `${updated.user.firstName} ${updated.user.lastName} a été vérifié(e) et sa candidature est maintenant disponible pour la mission "${app.mission.title}".`,
                  },
                }).catch(() => {});
              }
            }

            console.log(`[Admin KYC] ✅ ${blockedApps.length} candidature(s) débloquée(s) pour ${updated.user.firstName}`);
          }
        }
      } catch (err) {
        // Ne pas bloquer la réponse si le déblocage échoue
        console.error("[Admin KYC] Erreur déblocage candidatures:", err);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erreur validation prestataire:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
