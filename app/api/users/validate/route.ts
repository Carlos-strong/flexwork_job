import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(request: Request) {
  try {
    const { id } = await request.json();
    const profile = await prisma.freelancerProfile.update({
      where: { userId: id },
      data: {
        isValidated: true,
      },
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json({ error: "Failed to validate user" }, { status: 500 });
  }
}