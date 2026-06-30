import { NextResponse } from "next/server";

export async function GET() {
  // Données mockées — remplacer par Prisma quand la BDD sera connectée
  const featuredFreelancers = [
    {
      id: "1",
      name: "Marie Dupont",
      title: "Développeuse Fullstack",
      rate: 450,
      currency: "EUR",
      skills: ["React", "Node.js", "PostgreSQL"],
      rating: 4.9,
      completedMissions: 47,
    },
    {
      id: "2",
      name: "Thomas Martin",
      title: "Designer UI/UX",
      rate: 350,
      currency: "EUR",
      skills: ["Figma", "Sketch", "Adobe XD"],
      rating: 4.8,
      completedMissions: 32,
    },
    {
      id: "3",
      name: "Sophie Bernard",
      title: "Data Scientist",
      rate: 550,
      currency: "EUR",
      skills: ["Python", "TensorFlow", "SQL"],
      rating: 4.7,
      completedMissions: 28,
    },
    {
      id: "4",
      name: "Lucas Petit",
      title: "DevOps Engineer",
      rate: 500,
      currency: "EUR",
      skills: ["Docker", "Kubernetes", "AWS"],
      rating: 4.9,
      completedMissions: 41,
    },
  ];

  return NextResponse.json(featuredFreelancers);
}
