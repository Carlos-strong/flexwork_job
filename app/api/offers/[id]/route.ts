import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OfferService } from "@/lib/services/offer.service";

export const dynamic = "force-dynamic";

// PATCH /api/offers/[id]/send
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; action?: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || url.pathname.split("/").pop();
    const body = await request.json();

    if (action === "send") {
      const offer = await OfferService.sendOffer(
        id,
        body.expiresAt ? new Date(body.expiresAt) : undefined
      );

      return NextResponse.json({
        success: true,
        offer,
      });
    }

    if (action === "accept") {
      const result = await OfferService.acceptOffer(id, session.user.id);

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    if (action === "decline") {
      const offer = await OfferService.declineOffer(
        id,
        session.user.id,
        body.reason || "No reason provided"
      );

      return NextResponse.json({
        success: true,
        offer,
      });
    }

    if (action === "counter") {
      const milestones = Array.isArray(body.milestones) ? body.milestones : [];
      const result = await OfferService.negotiateOffer(
        id,
        session.user.id,
        milestones.map((m: { milestoneId: string; amount: number; dueDate?: string }) => ({
          milestoneId: m.milestoneId,
          amount: m.amount,
          dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
        })),
        body.note
      );

      return NextResponse.json({
        success: true,
        offer: result.offer,
        autoDeclined: result.autoDeclined,
        remainingRounds: result.remainingRounds,
      });
    }

    if (action === "withdraw") {
      const offer = await OfferService.withdrawOffer(
        id,
        body.reason || "Offer withdrawn"
      );

      return NextResponse.json({
        success: true,
        offer,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating offer:", error);
    const message = error instanceof Error ? error.message : "Failed to process offer action";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
