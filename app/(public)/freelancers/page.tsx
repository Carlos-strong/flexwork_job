import { prisma } from "@/lib/prisma";
import { FreelancerCard } from "@/components/elements/freelancer-card";

// ISR : revalide toutes les 5 minutes
export const revalidate = 300;

export const metadata = { title: "Nos freelances" };

const FALLBACK_FREELANCERS = [
  { id: "f-1", name: "Marie Dupont",   title: "Développeuse Fullstack",  skills: ["React", "Node.js", "PostgreSQL", "TypeScript"], hourlyRate: 450, rating: 4.9 },
  { id: "f-2", name: "Lucas Petit",    title: "DevOps Engineer",          skills: ["Docker", "Kubernetes", "AWS", "CI/CD"],          hourlyRate: 500, rating: 4.9 },
  { id: "f-3", name: "Sophie Bernard", title: "Data Scientist",           skills: ["Python", "TensorFlow", "SQL", "ML"],            hourlyRate: 550, rating: 4.7 },
  { id: "f-4", name: "Thomas Martin",  title: "Designer UI/UX",           skills: ["Figma", "Sketch", "Adobe XD"],                  hourlyRate: 350, rating: 4.8 },
  { id: "f-5", name: "Julie Renard",   title: "Développeuse Mobile",     skills: ["React Native", "Flutter", "Swift"],             hourlyRate: 400, rating: 4.6 },
];

async function getFreelancers() {
  try {
    const profiles = await prisma.freelancerProfile.findMany({
      where: { isValidated: true },
      include: { user: { select: { firstName: true, lastName: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (profiles.length > 0) {
      return profiles.map((p) => {
        const displayName = `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || "Freelancer";
        return {
          id: p.id,
          name: displayName,
          title: p.title || "Freelancer",
          hourlyRate: p.hourlyRate ?? undefined,
          skills: p.skills,
          rating: 0,
        };
      });
    }
  } catch {}
  return FALLBACK_FREELANCERS;
}

export default async function FreelancersPage() {
  const freelancers = await getFreelancers();

  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <h1 className="text-4xl font-bold tracking-tight">Nos freelances</h1>
      <p className="mt-2 text-[#5A5750]">
        Découvrez les talents de notre communauté.
      </p>
      {freelancers.length === 0 ? (
        <p className="mt-12 text-center text-[#5A5750]">
          Aucun freelance inscrit pour le moment.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {freelancers.map((f: { id: string; name: string; title: string; skills: string[]; hourlyRate?: number; rating?: number }) => (
          <FreelancerCard
              key={f.id}
              id={f.id}
              name={f.name || "Freelancer"}
              title={f.title || "Freelancer"}
              rate={f.hourlyRate ? `${f.hourlyRate} €/jour` : "—"}
              skills={f.skills || []}
              rating={f.rating || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

