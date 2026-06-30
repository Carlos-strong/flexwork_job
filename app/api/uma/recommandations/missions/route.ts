import { NextResponse } from "next/server";
import { missions } from "@/lib/mock-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const freelancerId = searchParams.get("freelancerId");

  // Récupérer les compétences du freelancer (simulé)
  const freelancerSkills: Record<string, string[]> = {
    "f-1": ["React", "Node.js", "TypeScript"],
    "f-2": ["Docker", "Kubernetes", "AWS"],
    "f-3": ["Python", "TensorFlow", "ML"],
    "f-4": ["Figma", "UI Design"],
    "f-5": ["React Native", "Flutter"],
  };

  const skills = freelancerSkills[freelancerId || ""] || [];

  const scored = missions.map((m) => {
    const matchingSkills = m.skills.filter((s) =>
      skills.some((fs) => fs.toLowerCase().includes(s.toLowerCase()))
    ).length;
    const score = skills.length > 0 ? matchingSkills / Math.max(m.skills.length, 1) : 0;
    return { ...m, score: Math.round(score * 100), matchingSkills };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    freelancerId,
    recommendations: scored.slice(0, 5),
    message: "Recommandations basées sur le matching de compétences",
  });
}
