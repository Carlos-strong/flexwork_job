import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApplicationService } from "@/lib/services/application.service";
import { InterviewFormat } from "@prisma/client";

export const dynamic = "force-dynamic";

// POST /api/applications/[id]/interview
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
      scheduledAt,
      format = "CHAT",
      duration,
      notes,
    } = body;

    if (!format || !["CHAT", "VIDEO_CALL", "PHONE", "MEETING"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid interview format" },
        { status: 400 }
      );
    }

    const interview = await ApplicationService.createInterview({
      applicationId: id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      format: format as InterviewFormat,
      duration,
      notes,
    });

    return NextResponse.json({
      success: true,
      interview,
    });
  } catch (error) {
    console.error("Error creating interview:", error);
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 }
    );
  }
}

// PATCH /api/applications/[id]/interview/[interviewId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; interviewId?: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      feedbackByClient,
      feedbackByFreelancer,
      rating,
    } = body;

    // Si interviewId n'est pas dans params, chercher dans le body
    const interviewId = params.interviewId;
    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    const interview = await ApplicationService.completeInterview({
      interviewId,
      feedbackByClient,
      feedbackByFreelancer,
      rating,
    });

    return NextResponse.json({
      success: true,
      interview,
    });
  } catch (error) {
    console.error("Error updating interview:", error);
    return NextResponse.json(
      { error: "Failed to update interview" },
      { status: 500 }
    );
  }
}
