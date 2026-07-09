import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OfferService } from "@/lib/services/offer.service";

export const dynamic = "force-dynamic";

// POST /api/applications/[id]/offer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      title,
      description,
      offerType,
      totalBudget,
      hourlyRate,
      weeklyHourLimit,
      startDate,
      endDate,
      milestones,
    } = body;

    if (!title || !offerType || !startDate) {
      return NextResponse.json(
        { error: "Title, offerType, and startDate are required" },
        { status: 400 }
      );
    }

    const offer = await OfferService.createOffer({
      applicationId: id,
      title,
      description,
      offerType,
      totalBudget,
      hourlyRate,
      weeklyHourLimit,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      milestones,
    });

    return NextResponse.json({
      success: true,
      offer,
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    );
  }
}
