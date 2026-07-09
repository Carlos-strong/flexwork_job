import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OfferService } from "@/lib/services/offer.service";

export const dynamic = "force-dynamic";

// POST /api/offers/expire
// Expire toutes les offres SENT dont la date d'expiration est dépassée
// Accessible uniquement par les administrateurs et via cron
export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Vérifier l'authentification (admin requis ou en mode simulation)
    const isSimulation = _req.headers.get("x-simulation") === "true" && process.env.NODE_ENV !== "production";
    if (!isSimulation) {
      if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }

      const activeProfile = (session.user as { activeProfile?: string })?.activeProfile;
      if (activeProfile !== "ADMIN") {
        return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 });
      }
    }

    const result = await OfferService.expireOldOffers();

    return NextResponse.json({
      success: true,
      expiredCount: result.count,
      message: `${result.count} offre(s) expirée(s)`,
    });
  } catch (error) {
    console.error("Error expiring offers:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'expiration des offres" },
      { status: 500 }
    );
  }
}
