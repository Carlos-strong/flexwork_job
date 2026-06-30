import Link from "next/link";

export const metadata = { title: "Profil freelance" };

export default async function FreelancerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  let freelancer: {
    name: string; title: string; rate: number; skills: string[];
    rating?: number; completedMissions?: number;
    availability: string; location: string; bio: string;
    portfolio?: string; email: string;
  } | null = null;

  try {
    // Chercher via l'API users
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/users`,
      { next: { revalidate: 30 } }
    );
    if (res.ok) {
      const users = await res.json();
      const found = Array.isArray(users) ? users.find((u: { id: string }) => u.id === params.id) : null;
      if (found) {
        freelancer = {
          name: found.name || "Freelancer",
          title: found.title || "Freelancer",
          rate: found.hourlyRate || 0,
          skills: found.skills || [],
          rating: found.rating || 0,
          completedMissions: found.completedMissions || 0,
          availability: found.availability || "full-time",
          location: found.location || "Remote",
          bio: found.bio || "",
          portfolio: found.portfolio || "",
          email: found.email || "",
        };
      }
    }
  } catch { /* ignore */ }

  if (!freelancer) {
    return <div className="text-center py-12 text-[#5A5750]">Freelance introuvable.</div>;
  }

  return (
    <div className="max-w-3xl">
      {/* En-tête */}
      <div className="rounded-xl border border-[#E2E0D9] p-8 mb-6">
        <div className="flex items-start gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EEF2FD] text-2xl font-bold text-[#2D5BE3]">
            {freelancer.name.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{freelancer.name}</h2>
            <p className="text-[#5A5750]">{freelancer.title}</p>
            <div className="mt-2 flex items-center gap-4 text-sm text-[#5A5750]">
              <span>📍 {freelancer.location}</span>
              <span>★ {freelancer.rating}</span>
              <span>{freelancer.completedMissions} missions</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {freelancer.skills.map((s: string) => (
                <span key={s} className="rounded-full bg-[#EEF2FD] px-3 py-1 text-xs font-medium text-[#2D5BE3]">{s}</span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#2D5BE3]">{freelancer.rate} €</p>
            <p className="text-sm text-[#5A5750]">/ jour</p>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
              freelancer.availability === "full-time" ? "bg-green-100 text-green-700" :
              freelancer.availability === "part-time" ? "bg-blue-100 text-blue-700" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {freelancer.availability === "full-time" ? "Temps plein" : freelancer.availability === "part-time" ? "Temps partiel" : "Weekends"}
            </span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="rounded-xl border border-[#E2E0D9] p-6 mb-6">
        <h3 className="font-semibold mb-2">À propos</h3>
        <p className="text-sm text-[#5A5750] leading-relaxed">{freelancer.bio}</p>
      </div>

      {/* Contact & Actions */}
      <div className="flex gap-3">
        <Link
          href={`mailto:${freelancer.email}`}
          className="rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
        >
          Contacter {freelancer.name.split(" ")[0]}
        </Link>
        {freelancer.portfolio && (
          <Link
            href={freelancer.portfolio}
            target="_blank"
            className="rounded-lg border border-[#E2E0D9] px-6 py-2.5 text-sm font-medium hover:bg-[#EEF2FD] transition-colors"
          >
            Voir le portfolio
          </Link>
        )}
      </div>
    </div>
  );
}
