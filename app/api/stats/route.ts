import { NextResponse } from "next/server";

export async function GET() {
  // Données mockées — remplacer par Prisma quand la BDD sera connectée
  const stats = {
    missionsCount: "10 000+",
    freelancersCount: "5 000+",
    satisfactionRate: "98%",
    activeMissions: 342,
    registeredClients: 1250,
    totalPayout: "2.5M €",
  };

  return NextResponse.json(stats);
}
