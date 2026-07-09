import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";


/**
 * POST /api/auth/switch-profile
 * Permet à un utilisateur de basculer entre ses profils (freelance ↔ client)
 * sans avoir à créer un nouveau compte.
 *
 * Body: { targetProfile: "FREELANCER" | "CLIENT" }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { targetProfile } = body;

    if (targetProfile !== "FREELANCER" && targetProfile !== "CLIENT") {
      return NextResponse.json(
        { error: "Profil cible invalide. Utilisez 'FREELANCER' ou 'CLIENT'." },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur a bien le profil demandé
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        freelancerProfile: true,
        clientProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    if (targetProfile === "FREELANCER" && !user.freelancerProfile) {
      // Créer automatiquement le profil freelance s'il n'existe pas
      await prisma.freelancerProfile.create({
        data: { userId },
      });
    }

    if (targetProfile === "CLIENT" && !user.clientProfile) {
      // Créer automatiquement le profil client s'il n'existe pas
      await prisma.clientProfile.create({
        data: { userId },
      });
    }

    // Mettre à jour le profil actif
    await prisma.user.update({
      where: { id: userId },
      data: { activeProfile: targetProfile },
    });

    return NextResponse.json({
      message: `Profil basculé vers ${targetProfile === "FREELANCER" ? "freelance" : "client"}`,
      activeProfile: targetProfile,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors du changement de profil" },
      { status: 500 }
    );
  }
}
