import { NextRequest, NextResponse } from "next/server";
import { getRegions, getQuartiers } from "@/lib/data/cameroun";
import { getGlobalVilles } from "@/lib/data/cities";
import { paysList as pays } from "@/lib/data/countries";

/**
 * GET /api/localisation
 * Endpoint public — renvoie pays, régions, villes, quartiers selon les paramètres.
 *
 * Paramètres de requête :
 *   ?type=pays       → liste des pays
 *   ?type=regions    → liste des régions du Cameroun
 *   ?type=villes     → toutes les villes (optionnel : ?pays=FR)
 *   ?type=quartiers  → quartiers d'une ville (?ville=Douala)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "pays";

    switch (type) {
      case "pays":
        return NextResponse.json({ data: pays });

      case "regions":
        return NextResponse.json({ data: getRegions() });

      case "villes": {
        const paysCode = searchParams.get("pays") || undefined;
        return NextResponse.json({ data: getGlobalVilles(paysCode) });
      }

      case "quartiers": {
        const ville = searchParams.get("ville");
        if (!ville) {
          return NextResponse.json(
            { error: "Paramètre 'ville' requis" },
            { status: 400 }
          );
        }
        return NextResponse.json({ data: getQuartiers(ville) });
      }

      default:
        return NextResponse.json(
          { error: "Type inconnu. Valeurs: pays, regions, villes, quartiers" },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
