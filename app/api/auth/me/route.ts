import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";


export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: (session.user as { id?: string }).id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        activeProfile: (session.user as { activeProfile?: string }).activeProfile || "FREELANCER",
        image: session.user.image || null,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
