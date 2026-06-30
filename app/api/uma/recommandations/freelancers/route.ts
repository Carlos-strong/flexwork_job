import { NextResponse } from "next/server";

// Algorithme de matching simple (MVP)
// Plus tard: embeddings OpenAI + similarité cosinus
const freelancers = [
  { id: "f-1", name: "Marie Dupont", title: "Développeuse Fullstack", rate: 450, skills: ["React", "Node.js", "TypeScript"], rating: 4.9 },
  { id: "f-2", name: "Lucas Petit", title: "DevOps Engineer", rate: 500, skills: ["Docker", "Kubernetes", "AWS"], rating: 4.9 },
  { id: "f-3", name: "Sophie Bernard", title: "Data Scientist", rate: 550, skills: ["Python", "TensorFlow", "ML"], rating: 4.7 },
  { id: "f-4", name: "Thomas Martin", title: "Designer UI/UX", rate: 350, skills: ["Figma", "UI Design"], rating: 4.8 },
  { id: "f-5", name: "Julie Renard", title: "Développeuse Mobile", rate: 400, skills: ["React Native", "Flutter"], rating: 4.6 },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const missionId = searchParams.get("missionId");
  const skills = searchParams.get("skills")?.toLowerCase().split(",") || [];

  // Score de matching basé sur les compétences
  const scored = freelancers.map((f) => {
    const matchingSkills = f.skills.filter((s) =>
      skills.some((ms) => s.toLowerCase().includes(ms.trim()))
    ).length;
    const score = skills.length > 0 ? matchingSkills / skills.length : 0;
    return { ...f, score: Math.round(score * 100), matchingSkills };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    missionId: missionId || "unknown",
    recommendations: scored.slice(0, 5),
    total: scored.length,
  });
}
