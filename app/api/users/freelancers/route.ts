import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FALLBACK_FREELANCERS = [
  { id: "f-1", name: "Marie Dupont", title: "Développeuse Fullstack", rate: 450, currency: "EUR", skills: ["React", "Node.js", "PostgreSQL", "TypeScript"], rating: 4.9, completedMissions: 47, availability: "full-time", location: "Paris", avatar: "MD" },
  { id: "f-2", name: "Lucas Petit", title: "DevOps Engineer", rate: 500, currency: "EUR", skills: ["Docker", "Kubernetes", "AWS", "CI/CD"], rating: 4.9, completedMissions: 41, availability: "full-time", location: "Lyon", avatar: "LP" },
  { id: "f-3", name: "Sophie Bernard", title: "Data Scientist", rate: 550, currency: "EUR", skills: ["Python", "TensorFlow", "SQL", "ML"], rating: 4.7, completedMissions: 28, availability: "part-time", location: "Remote", avatar: "SB" },
  { id: "f-4", name: "Thomas Martin", title: "Designer UI/UX", rate: 350, currency: "EUR", skills: ["Figma", "Sketch", "Adobe XD", "Design System"], rating: 4.8, completedMissions: 32, availability: "full-time", location: "Bordeaux", avatar: "TM" },
  { id: "f-5", name: "Julie Renard", title: "Développeuse Mobile", rate: 400, currency: "EUR", skills: ["React Native", "Flutter", "Swift", "Firebase"], rating: 4.6, completedMissions: 19, availability: "weekends", location: "Remote", avatar: "JR" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const skill = searchParams.get("skill")?.toLowerCase();
  const availability = searchParams.get("availability");
  const maxRate = searchParams.get("maxRate") ? Number(searchParams.get("maxRate")) : undefined;
  const search = searchParams.get("search")?.toLowerCase();

  try {
    // Recherche dans les profils freelances validés
    const where: Record<string, unknown> = {
      isValidated: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { bio: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { skills: { hasSome: [search] } },
      ];
    }

    if (skill) {
      where.skills = { hasSome: [skill] };
    }

    if (availability) {
      where.availability = availability;
    }

    if (maxRate) {
      where.hourlyRate = { lte: maxRate };
    }

    const profiles = await prisma.freelancerProfile.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (profiles.length > 0) {
      return NextResponse.json(
        profiles.map((p) => {
          const displayName = `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || "Freelancer";
          return {
            id: p.id,
            userId: p.userId,
            name: displayName,
            title: p.title || "Freelancer",
            rate: p.hourlyRate || 0,
            currency: "EUR",
            skills: p.skills,
            availability: p.availability || "full-time",
            location: p.location || "Remote",
            avatar: displayName.split(" ").map((n) => n[0]).join(""),
          };
        })
      );
    }
  } catch {
    // Fallback: base de données pas encore connectée, utiliser les données mock
    console.log("[Freelancer Search] Fallback vers mock data (BDD non disponible)");
  }

  // ── Fallback mock data ──────────────────────
  let filtered = [...FALLBACK_FREELANCERS];
  if (skill) filtered = filtered.filter((f) => f.skills.some((s) => s.toLowerCase().includes(skill)));
  if (availability) filtered = filtered.filter((f) => f.availability === availability);
  if (maxRate) filtered = filtered.filter((f) => f.rate <= maxRate);
  if (search) filtered = filtered.filter((f) => f.name.toLowerCase().includes(search) || f.title.toLowerCase().includes(search));

  return NextResponse.json(filtered);
}
