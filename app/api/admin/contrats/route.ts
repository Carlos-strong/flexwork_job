import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/contrats?q=recherche
 *
 * Liste les contrats pour l'outil admin de réinitialisation de workflow.
 * Recherche optionnelle sur le titre de mission, le nom/email du client
 * ou du freelance.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if ((session.user as { activeProfile?: string }).activeProfile !== "ADMIN") {
    return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();

  const contracts = await prisma.contract.findMany({
    where: q
      ? {
          OR: [
            { mission: { title: { contains: q, mode: "insensitive" } } },
            { mission: { client: { companyName: { contains: q, mode: "insensitive" } } } },
            { mission: { client: { user: { firstName: { contains: q, mode: "insensitive" } } } } },
            { mission: { client: { user: { lastName: { contains: q, mode: "insensitive" } } } } },
            { mission: { client: { user: { email: { contains: q, mode: "insensitive" } } } } },
            { freelancer: { user: { firstName: { contains: q, mode: "insensitive" } } } },
            { freelancer: { user: { lastName: { contains: q, mode: "insensitive" } } } },
            { freelancer: { user: { email: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    include: {
      mission: {
        select: {
          title: true,
          client: {
            select: {
              companyName: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      },
      freelancer: {
        select: {
          title: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      milestones: { select: { id: true, title: true, status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const data = contracts.map((c) => ({
    id: c.id,
    missionTitle: c.mission.title,
    client: {
      name:
        c.mission.client.companyName ||
        `${c.mission.client.user.firstName ?? ""} ${c.mission.client.user.lastName ?? ""}`.trim() ||
        c.mission.client.user.email,
      email: c.mission.client.user.email,
    },
    freelancer: {
      name:
        `${c.freelancer.user.firstName ?? ""} ${c.freelancer.user.lastName ?? ""}`.trim() ||
        c.freelancer.title ||
        c.freelancer.user.email,
      email: c.freelancer.user.email,
    },
    status: c.status,
    workflowPhase: c.workflowPhase,
    disputeStep: c.disputeStep,
    totalBudget: c.totalBudget,
    clientSignedAt: c.clientSignedAt,
    freelancerSignedAt: c.freelancerSignedAt,
    milestones: c.milestones,
    updatedAt: c.updatedAt,
  }));

  return NextResponse.json({ success: true, data });
}
