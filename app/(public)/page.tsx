import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { HeroSection } from "@/components/elements/hero-section";
import { StatsSection } from "@/components/elements/stats-section";
import { FeatureSection } from "@/components/elements/feature-section";
import { TestimonialCard } from "@/components/elements/testimonial-card";
import { CtaSection } from "@/components/elements/cta-section";
import { ClientIllustration, FreelancerIllustration } from "@/components/elements/illustrations";

// ISR : la page d’accueil est mise en cache 60s (missions) — le reste est statique
export const revalidate = 60;


const TESTIMONIALS = [
  { id: "1", name: "Jean Dupuis",      role: "Client",    content: "J’ai trouvé le freelance parfait pour mon projet en moins de 48h. Le paiement sécurisé m’a vraiment rassuré.",                                           rating: 5 },
  { id: "2", name: "Camille Lefevre",  role: "Freelance", content: "Flexwork m’a permis de trouver des missions régulières sans avoir à prospecter. L’IA de matching est très pertinente.",              rating: 5 },
  { id: "3", name: "Marc Moreau",      role: "Client",    content: "La gestion des milestones et l’escrow TrustEngine rendent la collaboration tellement plus sereine. Je recommande.", rating: 5 },
];

// ── Requêtes Prisma synchronisées avec la base ──

async function getStats() {
  try {
    const [totalMissions, openMissions, freelancers, clients, totalPayments, succeededPayments] = await Promise.all([
      prisma.mission.count(),
      prisma.mission.count({ where: { status: "OPEN" } }),
      prisma.freelancerProfile.count(),
      prisma.clientProfile.count(),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "SUCCEEDED" } }),
    ]);
    const rate = totalPayments > 0 ? Math.round((succeededPayments / totalPayments) * 100) : 98;
    return {
      missionsCount: `${openMissions}+`,
      freelancersCount: `${freelancers}+`,
      satisfactionRate: `${rate}%`,
    };
  } catch {
    return { missionsCount: "0", freelancersCount: "0", satisfactionRate: "98%" };
  }
}

async function getFeaturedFreelancers() {
  try {
    const dbFreelancers = await prisma.freelancerProfile.findMany({
      where: { isValidated: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { firstName: true, lastName: true } }, _count: { select: { applications: true } } },
    });
    return dbFreelancers.map((f) => ({
      id: f.id,
      name: `${f.user.firstName ?? ""} ${f.user.lastName ?? ""}`.trim() || "Freelance",
      title: f.title ?? "Freelance",
      rate: f.hourlyRate ?? 0,
      skills: f.skills,
      rating: 4.8,
      completedMissions: f._count.applications,
    }));
  } catch {
    return [];
  }
}

async function getLatestMissions() {
  try {
    const dbMissions = await prisma.mission.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { applications: true } } },
    });
    return dbMissions.map((m) => ({
      id: m.id,
      title: m.title,
      budget: m.budget ?? 0,
      currency: m.currency ?? "XAF",
      budgetType: m.budgetType,
      skills: m.skills,
      duration: m.duration || "",
      location: m.location || "",
      applicationsCount: m._count.applications,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
    }));
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Accueil",
  description: "Flexwork connecte freelances et clients. Publication de mission, paiement sécurisé et matching IA.",
};

export default async function HomePage() {
  const [latestMissions, stats, featuredFreelancers] = await Promise.all([
    getLatestMissions(),
    getStats(),
    getFeaturedFreelancers(),
  ]);

  return (
    <>
      <HeroSection />

      <StatsSection
        missionsCount={stats.missionsCount}
        freelancersCount={stats.freelancersCount}
        satisfactionRate={stats.satisfactionRate}
      />

      <FeatureSection
        badge="Pour les clients"
        title="Publiez une mission et trouvez le talent idéal"
        description="Publiez vos missions en quelques minutes et recevez des candidatures de freelances qualifiés. Suivez l'avancement des projets et ne payez que lorsque le travail est validé."
        features={[
          { icon: "📝", text: "Publication de mission en quelques clics" },
          { icon: "🤖", text: "Matching intelligent par IA" },
          { icon: "🔒", text: "Paiement sécurisé via escrow" },
          { icon: "📊", text: "Suivi en temps réel du projet" },
        ]}
        ctaLabel="Publier une mission"
        ctaHref="/inscription"
        illustration={<ClientIllustration />}
      />

      <FeatureSection
        badge="Pour les freelances"
        title="Trouvez des missions qui vous correspondent"
        description="Trouvez des missions qui correspondent à vos compétences. Gérez votre profil, suivez votre temps et recevez vos paiements automatiquement."
        features={[
          { icon: "🎯", text: "Missions filtrées par vos compétences" },
          { icon: "⏱️", text: "Time tracker intégré" },
          { icon: "💳", text: "Paiements automatiques via Stripe" },
          { icon: "🧠", text: "Support IA pour trouver les meilleures opportunités" },
        ]}
        ctaLabel="Créer mon profil"
        ctaHref="/inscription"
        illustration={<FreelancerIllustration />}
        reversed
      />

      {latestMissions.length > 0 && (
        <LatestMissionsSection missions={latestMissions} />
      )}

      {featuredFreelancers.length > 0 && (
        <FeaturedFreelancersSection freelancers={featuredFreelancers} />
      )}

      {/* Témoignages inline */}
      <TestimonialsSection testimonials={TESTIMONIALS} />

      <CtaSection />
    </>
  );
}

// ── Sous-composants synchrones (données passées en props) ────────────────────

type Mission = { id: string; title: string; budget: number; currency: string; budgetType: string; skills: string[]; duration: string; location: string; applicationsCount: number; expiresAt: string | null };
type Freelancer = { id: string; name: string; title: string; rate: number; skills: string[]; rating: number; completedMissions: number };
type Testimonial = { id: string; name: string; role: string; content: string; rating: number };

function LatestMissionsSection({ missions }: { missions: Mission[] }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#1A1916]">Missions récentes</h2>
            <p className="mt-2 text-[#5A5750] text-[14px]">Les dernières missions publiées par nos clients.</p>
          </div>
          <Link href="/missions" className="hidden sm:inline-flex items-center gap-1 text-[14px] font-semibold text-[#2D5BE3] hover:underline">
            Voir toutes les missions →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {missions.map((m) => (
            <Link key={m.id} href={`/missions/${m.id}`} className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all group">
              <h3 className="font-semibold text-[#1A1916] group-hover:text-[#2D5BE3] transition-colors line-clamp-2 mb-3">{m.title}</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {m.skills?.slice(0, 4).map((s) => (
                  <span key={s} className="rounded-[20px] bg-[#EEF2FD] px-2.5 py-0.5 text-[12px] font-medium text-[#2D5BE3]">{s}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="font-bold text-[#2D5BE3]">
                  {m.budgetType === "OPEN_QUOTE" ? "Budget libre" : formatCurrency(m.budget, m.currency)}
                </span>
                <span className="text-[#5A5750] text-[12px]">{m.duration} · {m.location}</span>
              </div>
              <p className="mt-2 text-[12px] text-[#E67E22] font-medium">
                {m.expiresAt
                  ? (() => {
                      const days = Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return days > 0 ? `⏰ Expire dans ${days} jour(s)` : "⏰ Expirée";
                    })()
                  : "⏰ Ouverte en continu"}
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center sm:hidden">
          <Link href="/missions" className="text-[14px] font-semibold text-[#2D5BE3] hover:underline">Voir toutes les missions →</Link>
        </div>
      </div>
    </section>
  );
}

function FeaturedFreelancersSection({ freelancers }: { freelancers: Freelancer[] }) {
  return (
    <section className="py-16 md:py-24 bg-[#F5F5F0]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#1A1916]">Freelances en vedette</h2>
            <p className="mt-2 text-[#5A5750] text-[14px]">Découvrez les talents les plus demandés de notre communauté.</p>
          </div>
          <Link href="/freelancers" className="hidden sm:inline-flex items-center gap-1 text-[14px] font-semibold text-[#2D5BE3] hover:underline">
            Voir tous les freelances →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {freelancers.map((f) => (
            <Link key={f.id} href={`/freelancers/${f.id}`} className="rounded-[16px] border border-[#E2E0D9] bg-white p-5 hover:border-[#C3D1F8] hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#EEF2FD] text-[18px] font-bold text-[#2D5BE3]">{f.name.charAt(0)}</div>
                <div>
                  <h3 className="font-semibold text-[#1A1916] group-hover:text-[#2D5BE3] transition-colors">{f.name}</h3>
                  <p className="text-[14px] text-[#5A5750]">{f.title}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {f.skills?.slice(0, 3).map((s) => (
                  <span key={s} className="rounded-[20px] bg-[#FAFAF8] border border-[#E2E0D9] px-2.5 py-0.5 text-[12px] font-medium text-[#5A5750]">{s}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="font-semibold text-[#1A1916]">{f.rate} €/jour</span>
                <span className="flex items-center gap-1 text-[#5A5750]">⭐ {f.rating} · {f.completedMissions} missions</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center sm:hidden">
          <Link href="/freelancers" className="text-[14px] font-semibold text-[#2D5BE3] hover:underline">Voir tous les freelances →</Link>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section className="py-16 md:py-24 bg-[#FAFAF8]">
      <div className="container mx-auto px-4">
        <h2 className="text-[28px] font-bold text-center mb-12 tracking-[-0.02em] text-[#1A1916]">Ils nous font confiance</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} id={t.id} name={t.name} role={t.role} content={t.content} rating={t.rating} company="" avatar="" />
          ))}
        </div>
      </div>
    </section>
  );
}
