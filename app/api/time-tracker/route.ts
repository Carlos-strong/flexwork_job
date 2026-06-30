import { NextResponse } from "next/server";

const sessions: { id: string; contractId: string; startTime: string; duration: number; date: string }[] = [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.contractId || body.duration === undefined) {
      return NextResponse.json({ error: "contractId et duration requis" }, { status: 400 });
    }
    const session = {
      id: `ts-${Date.now()}`,
      contractId: body.contractId,
      startTime: body.startTime || new Date().toISOString(),
      duration: body.duration,
      date: new Date().toISOString().split("T")[0],
    };
    sessions.push(session);
    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId");
  const filtered = contractId ? sessions.filter((s) => s.contractId === contractId) : [];
  return NextResponse.json(filtered);
}
