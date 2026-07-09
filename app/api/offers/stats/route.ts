import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/offers/stats
// Retourne les statistiques des offres pour le client ou freelance connecté
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = session.user.id;
    const activeProfile = (session.user as { activeProfile?: string })?.activeProfile || "FREELANCER";

    let stats;

    if (activeProfile === "CLIENT") {
      // Statistiques côté client
      const clientProfile = await prisma.clientProfile.findUnique({
        where: { userId },
      });

      if (!clientProfile) {
        return NextResponse.json({
          success: true,
          data: {
            total: 0,
            sent: 0,
            accepted: 0,
            declined: 0,
            expired: 0,
            withdrawn: 0,
            pendingResponse: 0,
          },
        });
      }

      const offers = await prisma.offer.findMany({
        where: {
          application: {
            mission: {
              clientId: clientProfile.id,
            },
          },
        },
        select: { status: true },
      });

      stats = {
        total: offers.length,
        sent: offers.filter((o) => o.status === "SENT").length,
        accepted: offers.filter((o) => o.status === "ACCEPTED").length,
        declined: offers.filter((o) => o.status === "DECLINED").length,
        expired: offers.filter((o) => o.status === "EXPIRED").length,
        withdrawn: offers.filter((o) => o.status === "WITHDRAWN").length,
        pendingResponse: offers.filter((o) => o.status === "SENT").length,
      };
    } else {
      // Statistiques côté freelance
      const freelancerProfile = await prisma.freelancerProfile.findUnique({
        where: { userId },
      });

      if (!freelancerProfile) {
        return NextResponse.json({
          success: true,
          data: {
            total: 0,
            received: 0,
            accepted: 0,
            declined: 0,
            expired: 0,
            pending: 0,
          },
        });
      }

      const offers = await prisma.offer.findMany({
        where: {
          application: {
            freelancerId: freelancerProfile.id,
          },
        },
        select: { status: true },
      });

      stats = {
        total: offers.length,
        received: offers.filter((o) => o.status === "SENT").length,
        accepted: offers.filter((o) => o.status === "ACCEPTED").length,
        declined: offers.filter((o) => o.status === "DECLINED").length,
        expired: offers.filter((o) => o.status === "EXPIRED").length,
        pending: offers.filter((o) => o.status === "SENT").length,
      };
    }

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching offer stats:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}
