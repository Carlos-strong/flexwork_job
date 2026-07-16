import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contracts, applications, persistMockStore } from "@/lib/mock-data";
import { conversations, addSystemMessage } from "@/lib/collaboration";
import { enqueueJob } from "@/lib/queue";
import { syncStore } from "@/lib/sync-store";
import { checkContractAccess, type ContractRole } from "@/lib/contract-access";

/** Rôle autorisé par action de mutation de contrat. */
const ACTION_REQUIRED_ROLE: Record<string, ContractRole | undefined> = {
  SUBMIT_MILESTONE: "freelancer",
  APPROVE_MILESTONE: "client",
  REJECT_MILESTONE: "client",
  RELEASE_MILESTONE: "client",
  // DECLINED : les deux parties peuvent refuser → pas de rôle requis (partie au contrat suffit)
};

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ── Authentification + appartenance au contrat ──────
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const preview = await req.clone().json().catch(() => ({} as Record<string, unknown>));
    const requiredRole = ACTION_REQUIRED_ROLE[(preview as { action?: string }).action ?? ""];
    const access = await checkContractAccess(params.id, userId, requiredRole);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Chercher le contrat en Prisma (fallback mock si indisponible)
    let missionTitle = "Mission";
    let contractExists = false;

    try {
      const dbContract = await prisma.contract.findUnique({
        where: { id: params.id },
        include: { mission: { select: { title: true } } },
      });
      if (dbContract) {
        contractExists = true;
        missionTitle = dbContract.mission?.title ?? "Mission";
      }
    } catch { /* Prisma indisponible */ }

    const mockContract = contracts.find((c) => c.id === params.id);
    if (!contractExists && !mockContract) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }
    if (mockContract) missionTitle = mockContract.missionTitle ?? missionTitle;

    const body = await req.json();
    const { status, milestoneId, action } = body;

    // ── Action : refus du contrat ───────────────────────
    if (status === "DECLINED") {
      try {
        await prisma.contract.update({ where: { id: params.id }, data: { status: "DISPUTED" } });
      } catch {
        if (mockContract) { mockContract.status = "DECLINED"; persistMockStore(); }
      }

      const conv = conversations.find((c) => c.contractId === params.id);
      if (conv) addSystemMessage(conv.id, "❌ Le contrat a été refusé par le freelance.");

      // Mettre à jour la candidature associée (mock fallback)
      const appIndex = applications.findIndex((a) => conv?.title.includes(a.freelancerId || ""));
      if (appIndex !== -1) { applications[appIndex].status = "CONTRACT_DECLINED"; persistMockStore(); }

      await enqueueJob("NOTIFICATION_EMAIL", {
        to: "client@flexwork.test",
        subject: `Contrat refusé — ${missionTitle}`,
        template: "contract_declined",
        data: { missionTitle },
      }).catch(() => {});

      syncStore.emit(params.id, { type: "contract_update", data: { status: "DECLINED" } });

      return NextResponse.json({ message: "Contrat refusé" });
    }

    // ── Action : soumission d'un milestone (FREELANCER) ─
    if (action === "SUBMIT_MILESTONE") {
      if (!milestoneId) return NextResponse.json({ error: "milestoneId requis" }, { status: 400 });

      let milestone: { id: string; title: string; amount: number } | null = null;
      try {
        milestone = await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "IN_REVIEW",
            rejectionReason: null,  // ← nettoyage après resoumission
            rejectedAt: null as any,        // ← nettoyage du rejet précédent
          },
          select: { id: true, title: true, amount: true },
        });
      } catch {
        // Fallback mock
        const mock = mockContract?.milestones?.find((m: { id: string }) => m.id === milestoneId);
        if (mock) { (mock as Record<string, unknown>).status = "IN_REVIEW"; milestone = mock as { id: string; title: string; amount: number }; }
      }
      if (!milestone) return NextResponse.json({ error: "Milestone introuvable" }, { status: 404 });

      const conv = conversations.find((c) => c.contractId === params.id);
      if (conv) addSystemMessage(conv.id, `📤 Livrable soumis : "${milestone.title}" — en attente de validation.`);

      await enqueueJob("MILESTONE_SUBMITTED", {
        milestoneId: milestone.id,
        contractId: params.id,
        title: milestone.title,
        amount: milestone.amount,
      }).catch(() => {});

      syncStore.emit(params.id, {
        type: "milestone_update",
        data: { milestoneId: milestone.id, status: "IN_REVIEW", title: milestone.title },
      });

      return NextResponse.json({ message: "Milestone soumis", milestoneId: milestone.id, status: "IN_REVIEW" });
    }

    // ── Action : approbation d'un milestone (CLIENT) ────
    if (action === "APPROVE_MILESTONE") {
      if (!milestoneId) return NextResponse.json({ error: "milestoneId requis" }, { status: 400 });

      let milestone: { id: string; title: string; amount: number } | null = null;
      try {
        milestone = await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: "APPROVED", completedAt: new Date() },
          select: { id: true, title: true, amount: true },
        });
      } catch {
        const mock = mockContract?.milestones?.find((m: { id: string }) => m.id === milestoneId);
        if (mock) { (mock as Record<string, unknown>).status = "APPROVED"; milestone = mock as { id: string; title: string; amount: number }; }
      }
      if (!milestone) return NextResponse.json({ error: "Milestone introuvable" }, { status: 404 });

      const conv = conversations.find((c) => c.contractId === params.id);
      if (conv) addSystemMessage(conv.id, `✅ Milestone approuvé : "${milestone.title}" — libération en cours.`);

      await enqueueJob("MILESTONE_APPROVED", {
        milestoneId: milestone.id,
        contractId: params.id,
        title: milestone.title,
        amount: milestone.amount,
      }).catch(() => {});

      syncStore.emit(params.id, {
        type: "milestone_update",
        data: { milestoneId: milestone.id, status: "APPROVED", title: milestone.title },
      });

      return NextResponse.json({ message: "Milestone approuvé", milestoneId: milestone.id, status: "APPROVED" });
    }

    // ── Action : rejet d'un milestone (CLIENT) ──────────
    if (action === "REJECT_MILESTONE") {
      if (!milestoneId) return NextResponse.json({ error: "milestoneId requis" }, { status: 400 });
      const { rejectionReason } = body;
      if (!rejectionReason) return NextResponse.json({ error: "Motif de rejet obligatoire" }, { status: 400 });

      let milestone: { id: string; title: string; amount: number } | null = null;
      try {
        const updated = await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "IN_REVIEW",
            revisionCount: { increment: 1 },
            rejectionReason,
            rejectedAt: new Date() as any,
          },
          select: { id: true, title: true, amount: true },
        });
        milestone = updated;
      } catch {
        const mock = mockContract?.milestones?.find((m: { id: string }) => m.id === milestoneId);
        if (mock) {
          (mock as Record<string, unknown>).status = "IN_REVIEW";
          (mock as Record<string, unknown>).revisionCount = ((mock as Record<string, unknown>).revisionCount as number || 0) + 1;
          (mock as Record<string, unknown>).rejectionReason = rejectionReason;
          milestone = mock as { id: string; title: string; amount: number };
        }
      }
      if (!milestone) return NextResponse.json({ error: "Milestone introuvable" }, { status: 404 });

      const conv = conversations.find((c) => c.contractId === params.id);
      if (conv) addSystemMessage(conv.id, `❌ Milestone rejeté : "${milestone.title}" — ${rejectionReason}`);

      await enqueueJob("MILESTONE_REJECTED", {
        milestoneId: milestone.id,
        contractId: params.id,
        title: milestone.title,
        amount: milestone.amount,
        reason: rejectionReason,
      }).catch(() => {});

      syncStore.emit(params.id, {
        type: "milestone_update",
        data: { milestoneId: milestone.id, status: "IN_REVIEW", title: milestone.title, rejectionReason },
      });

      return NextResponse.json({ message: "Milestone rejeté", milestoneId: milestone.id, status: "IN_REVIEW", revisionCount: body.revisionCount });
    }

    // ── Action : libération paiement milestone ──────────
    if (action === "RELEASE_MILESTONE") {
      if (!milestoneId) return NextResponse.json({ error: "milestoneId requis" }, { status: 400 });

      let milestone: { id: string; title: string; amount: number } | null = null;
      try {
        milestone = await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: "RELEASED" },
          select: { id: true, title: true, amount: true },
        });
      } catch {
        const mock = mockContract?.milestones?.find((m: { id: string }) => m.id === milestoneId);
        if (mock) { (mock as Record<string, unknown>).status = "RELEASED"; milestone = mock as { id: string; title: string; amount: number }; }
      }
      if (!milestone) return NextResponse.json({ error: "Milestone introuvable" }, { status: 404 });

      const conv = conversations.find((c) => c.contractId === params.id);
      if (conv) addSystemMessage(conv.id, `💸 Paiement libéré : "${milestone.title}" — ${milestone.amount.toLocaleString()} €`);

      await enqueueJob("MILESTONE_RELEASED", {
        milestoneId: milestone.id,
        contractId: params.id,
        title: milestone.title,
        amount: milestone.amount,
      }).catch(() => {});

      await enqueueJob("PAYMENT_RELEASE", {
        paymentId: `pay-${Date.now()}`,
        contractId: params.id,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        amount: milestone.amount,
      }).catch(() => {});

      syncStore.emit(params.id, {
        type: "milestone_update",
        data: { milestoneId: milestone.id, status: "RELEASED", title: milestone.title },
      });

      return NextResponse.json({ message: "Paiement libéré", milestoneId: milestone.id, status: "RELEASED" });
    }

    return NextResponse.json({ error: "Action non supportée. Actions: DECLINED, SUBMIT_MILESTONE, APPROVE_MILESTONE, REJECT_MILESTONE, RELEASE_MILESTONE" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

// ── GET /api/contracts/[id]/milestones ─────────
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const milestones = await prisma.milestone.findMany({
      where: { contractId: params.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: milestones });
  } catch {
    // Fallback mock
    const contract = contracts.find((c) => c.id === params.id);
    if (!contract) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    return NextResponse.json({ data: contract.milestones ?? [] });
  }
}
