import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncStore } from "@/lib/sync-store";
import { checkContractAccess } from "@/lib/contract-access";
import {
  buildWorkflowContext,
  applyWorkflowIntent,
  type WorkflowIntent,
} from "@/lib/services/contract-workflow.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/contracts/[id]/workflow
 *
 * Renvoie le contexte de workflow courant (source de vérité serveur).
 * Réservé aux parties du contrat. Sert au front pour se resynchroniser.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const access = await checkContractAccess(params.id, userId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const context = await buildWorkflowContext(params.id);
  if (!context) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }
  return NextResponse.json({ success: true, role: access.role, context });
}

/**
 * POST /api/contracts/[id]/workflow
 *
 * Applique une INTENTION de workflow (signer, financer, soumettre/valider/rejeter
 * un jalon, avancer le litige). Le serveur :
 *   - authentifie l'appelant et vérifie qu'il est partie au contrat,
 *   - vérifie que son rôle autorise l'action,
 *   - revalide la transition via la machine à états (gardes métier),
 *   - persiste le nouvel état et le diffuse en SSE.
 *
 * Le client n'écrit jamais l'état brut : il ne peut donc pas court-circuiter
 * les règles (double signature, 100 % validé, preuve d'appel, seuil d'arbitrage).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const access = await checkContractAccess(params.id, userId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: WorkflowIntent;
  try {
    body = (await req.json()) as WorkflowIntent;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Champ 'action' requis" }, { status: 400 });
  }

  try {
    const result = await applyWorkflowIntent(params.id, access.role, body);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, context: result.context },
        { status: result.status }
      );
    }

    // Diffusion SSE aux deux parties connectées.
    if (result.broadcast && Object.keys(result.broadcast).length > 0) {
      syncStore.emit(params.id, {
        type: "workflow_update",
        data: {
          contractId: params.id,
          ...result.broadcast,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, context: result.context });
  } catch (error) {
    console.error("[Workflow] Erreur:", error);
    return NextResponse.json({ error: "Erreur de traitement du workflow" }, { status: 500 });
  }
}
