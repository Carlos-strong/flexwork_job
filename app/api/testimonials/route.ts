import { NextResponse } from "next/server";

export async function GET() {
  const testimonials = [
    {
      id: "1",
      name: "Jean Dupuis",
      role: "Client",
      company: "StartupLab",
      avatar: "JD",
      content:
        "J'ai trouvé le freelance parfait pour mon projet en moins de 48h. Le paiement sécurisé m'a vraiment rassuré.",
      rating: 5,
    },
    {
      id: "2",
      name: "Camille Lefevre",
      role: "Freelance",
      company: "Design indépendant",
      avatar: "CL",
      content:
        "Flexwork m'a permis de trouver des missions régulières sans avoir à prospecter. L'IA de matching est très pertinente.",
      rating: 5,
    },
    {
      id: "3",
      name: "Marc Moreau",
      role: "Client",
      company: "WebAgency",
      avatar: "MM",
      content:
        "La gestion des milestones et l'escrow TrustEngine rendent la collaboration tellement plus sereine. Je recommande.",
      rating: 5,
    },
  ];

  return NextResponse.json(testimonials);
}
