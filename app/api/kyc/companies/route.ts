import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

export const dynamic = "force-dynamic";


/**
 * GET /api/kyc/companies
 * Récupérer les vérifications d'entreprise en attente
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer les profils client avec KYC en attente
    const companies = await prisma.clientProfile.findMany({
      where: {
        companyVerificationStatus: "EN_ATTENTE",
        siret: { not: null }, // Au moins SIRET fourni
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
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      data: companies,
      total: companies.length,
    });
  } catch (error) {
    console.error("Erreur lecture verifications entreprises:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kyc/companies
 * Valider, rejeter une vérification d'entreprise
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { companyProfileId, statut, motifRejet } = body;

    if (!companyProfileId || !["EN_ATTENTE", "VALIDE", "REJETE"].includes(statut)) {
      return NextResponse.json(
        { error: "Paramètres invalides" },
        { status: 400 }
      );
    }

    const company = await prisma.clientProfile.findUnique({
      where: { id: companyProfileId },
      include: { user: true },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Profil entreprise introuvable" },
        { status: 404 }
      );
    }

    // Mettre à jour le statut de la vérification
    const updated = await prisma.clientProfile.update({
      where: { id: companyProfileId },
      data: {
        companyVerificationStatus: statut as any,
        companyVerifiedAt: statut === "VALIDE" ? new Date() : company.companyVerifiedAt,
        companyVerifiedById: session.user.id,
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
      },
    });

    // Si validation réussie, débloquer les missions (optionnel selon workflow)
    if (statut === "VALIDE") {
      // Les missions du client pourraient être débloquées ici si nécessaire
      // Pour l'instant, on considère que c'est transparent
    }

    // Envoyer email de confirmation à l'entreprise
    const emailSubject = statut === "VALIDE"
      ? "✅ Votre entreprise a été vérifiée avec succès"
      : statut === "REJETE"
      ? "❌ Votre demande de vérification a été rejetée"
      : "⏳ Votre demande est en cours de traitement";

    await enqueueJob("NOTIFICATION_EMAIL", {
      to: updated.user.email,
      subject: emailSubject,
      template: "kyc_company_update",
      data: {
        companyName: updated.companyName || "Votre entreprise",
        contactName: updated.user.firstName,
        statut,
        motifRejet: motifRejet || "",
      },
    }).catch(() => {});

    return NextResponse.json({
      data: updated,
      message: `Vérification entreprise mise à jour avec le statut: ${statut}`,
    });
  } catch (error) {
    console.error("Erreur mise à jour vérification entreprise:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
