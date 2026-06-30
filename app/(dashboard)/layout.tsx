import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { LogoutButton } from "@/components/layout/logout-button";
import { ProfileSwitcher } from "@/components/layout/profile-switcher";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { prisma } from "@/lib/prisma";

// Requête Prisma mise en cache 5 minutes par userId — évite un aller-retour BDD à chaque navigation
const getUserProfiles = unstable_cache(
  async (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        freelancerProfile: { select: { id: true } },
        clientProfile: { select: { id: true } },
      },
    }),
  ["dashboard-user-profiles"],
  { revalidate: 300 }
);

// ── Navigation Client ──────────────────────────
const clientNav = [
  { href: "/dashboard/client", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/client/missions/creation", label: "Créer une mission", icon: "➕" },
  { href: "/dashboard/client/missions", label: "Mes missions", icon: "📋" },
  { href: "/dashboard/client/candidatures", label: "Candidatures", icon: "📩" },
  { href: "/dashboard/client/missions/archives", label: "Archives", icon: "📦" },
  { href: "/dashboard/client/freelancers", label: "Freelances", icon: "🔍" },
  { href: "/dashboard/client/contrats", label: "Contrats", icon: "📝" },
  { href: "/dashboard/client/messages", label: "Messages", icon: "💬" },
  { href: "/dashboard/client/paiements", label: "Paiements", icon: "💳" },
  { href: "/dashboard/client/entreprise", label: "Entreprise", icon: "🏢" },
  { href: "/dashboard/client/avis", label: "Avis donnés", icon: "⭐" },
];

// ── Navigation Freelance ───────────────────────
const freelancerNav = [
  { href: "/dashboard/freelancer", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/freelancer/recherche", label: "Missions", icon: "🔍" },
  { href: "/dashboard/freelancer/candidatures", label: "Candidatures", icon: "📩" },
  { href: "/dashboard/freelancer/contrats", label: "Contrats", icon: "📝" },
  { href: "/dashboard/freelancer/profil", label: "Profil pro", icon: "👤" },
  { href: "/dashboard/freelancer/messages", label: "Messages", icon: "💬" },
  { href: "/dashboard/freelancer/paiements", label: "Paiements", icon: "💳" },
  { href: "/dashboard/freelancer/avis", label: "Avis reçus", icon: "⭐" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Utilise la session mise en cache (React cache) — pas de double appel BDD
  const session = await getSession();

  if (!session?.user) {
    redirect("/connexion");
  }

  const userId = (session.user as { id?: string }).id;
  const activeProfile = (session.user as { activeProfile?: string }).activeProfile || "FREELANCER";

  let hasFreelancerProfile = false;
  let hasClientProfile = false;
  if (userId) {
    try {
      const user = await getUserProfiles(userId);
      hasFreelancerProfile = !!user?.freelancerProfile;
      hasClientProfile = !!user?.clientProfile;
    } catch {
      // Silently fail si BDD indisponible
    }
  }

  const navItems = activeProfile === "CLIENT" ? clientNav : freelancerNav;
  const name = session.user.name || "Utilisateur";
  const emailVerified = (session.user as { emailVerified?: string | null }).emailVerified;
  const needsVerification = !emailVerified;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Bannière de vérification d'email */}
      {needsVerification && <EmailVerificationBanner email={session.user.email || ""} name={name} />}

      <div className="flex flex-1">
        {/* Sidebar — content-visibility pour le rendu différé hors écran mobile */}
        <aside className="w-64 border-r bg-white hidden lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/" className="text-lg font-bold text-[#2D5BE3]" prefetch>
              Flexwork
            </Link>
          </div>
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-[#5A5750] mb-2">
              {activeProfile === "CLIENT" ? "Espace Client" : "Espace Freelance"}
            </p>
            {navItems.map((item) => (
              <SidebarItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </nav>

          {/* Sélecteur de profil */}
          <ProfileSwitcher
            currentProfile={activeProfile}
            hasFreelancerProfile={hasFreelancerProfile}
            hasClientProfile={hasClientProfile}
          />

          {/* Déconnexion en bas de sidebar */}
          <div className="border-t p-4">
            <LogoutButton variant="sidebar" />
          </div>
        </aside>

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar — sticky avec backdrop-blur pour lisibilité */}
          <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex h-16 items-center justify-between px-6">
              <h1 className="text-lg font-semibold">Mon espace</h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#5A5750]">{name}</span>
                <LogoutButton />
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 relative">
            <div className="max-w-[1200px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ href, label, icon }: { href: string; label: string; icon?: string }) {
  return (
    <Link
      href={href}
      prefetch
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors"
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {label}
    </Link>
  );
}
