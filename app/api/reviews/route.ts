import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkContractAccess } from "@/lib/contract-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/reviews?role=author|target[&contractId=...]
 *
 * - role=author  → avis rédigés par l'utilisateur courant
 * - role=target  → avis reçus par l'utilisateur courant (défaut)
 * - contractId   → filtre sur un contrat précis
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") === "author" ? "author" : "target";
  const contractId = searchParams.get("contractId") ?? undefined;

  const where =
    role === "author"
      ? { authorId: userId, ...(contractId ? { contractId } : {}) }
      : { targetId: userId, ...(contractId ? { contractId } : {}) };

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, image: true } },
      target: { select: { id: true, firstName: true, lastName: true, image: true } },
      contract: { select: { id: true, mission: { select: { title: true } } } },
    },
  });

  const count = reviews.length;
  const average =
    count > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;

  return NextResponse.json({ success: true, reviews, count, average });
}

/**
 * POST /api/reviews
 * Body: { contractId, rating, comment?, qualityRating?, communicationRating?, deadlineRating? }
 *
 * Conditions :
 *   - l'auteur est partie au contrat,
 *   - le contrat est terminé (COMPLETED),
 *   - un seul avis par auteur et par contrat.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: {
    contractId?: string;
    rating?: number;
    comment?: string;
    qualityRating?: number;
    communicationRating?: number;
    deadlineRating?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (!body.contractId) {
    return NextResponse.json({ error: "contractId requis" }, { status: 400 });
  }
  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: "Note globale (1 à 5) requise" }, { status: 400 });
  }

  // L'auteur doit être partie au contrat.
  const access = await checkContractAccess(body.contractId, userId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: body.contractId },
    select: { status: true, workflowPhase: true },
  });
  const isClosed =
    contract?.status === "COMPLETED" ||
    contract?.workflowPhase === "COMPLETED" ||
    contract?.workflowPhase === "DISPUTE_RESOLVED";
  if (!isClosed) {
    return NextResponse.json(
      { error: "L'évaluation n'est possible qu'une fois le contrat terminé" },
      { status: 409 }
    );
  }

  // La cible est l'autre partie.
  const targetId =
    access.role === "client" ? access.parties.freelancerUserId : access.parties.clientUserId;
  if (!targetId) {
    return NextResponse.json({ error: "Destinataire de l'avis introuvable" }, { status: 409 });
  }

  // Un seul avis par auteur et par contrat.
  const existing = await prisma.review.findUnique({
    where: { contractId_authorId: { contractId: body.contractId, authorId: userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Vous avez déjà évalué ce contrat" }, { status: 409 });
  }

  const clampSub = (n?: number) =>
    typeof n === "number" && n >= 1 && n <= 5 ? Math.round(n) : null;

  const review = await prisma.review.create({
    data: {
      contractId: body.contractId,
      authorId: userId,
      targetId,
      authorRole: access.role === "client" ? "CLIENT" : "FREELANCER",
      rating: Math.round(body.rating),
      comment: body.comment?.trim() || null,
      qualityRating: clampSub(body.qualityRating),
      communicationRating: clampSub(body.communicationRating),
      deadlineRating: clampSub(body.deadlineRating),
    },
  });

  return NextResponse.json({ success: true, review }, { status: 201 });
}
