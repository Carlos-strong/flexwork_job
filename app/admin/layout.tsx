import Link from "next/link";
import { LogoutButton } from "@/components/layout/logout-button";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "👥" },
  { href: "/admin/verifications/freelances", label: "Vérif. Freelances", icon: "🪪" },
  { href: "/admin/verifications/companies", label: "Vérif. Entreprises", icon: "🏢" },
  { href: "/admin/missions", label: "Missions", icon: "📋" },
  { href: "/admin/disputes", label: "Litiges", icon: "⚖️" },
  { href: "/admin/paiements", label: "Paiements", icon: "💳" },
  { href: "/admin/reports", label: "Signalements", icon: "🚩" },
  { href: "/admin/uma-recruiter", label: "IA Uma", icon: "🤖" },
  { href: "/admin/queues", label: "Queues", icon: "⚙️" },
];

// Séparateur visuel entre Admin Métier et accès Back Office
const backOfficeLink = { href: "/backoffice", label: "Back Office →", icon: "🔧" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-white flex flex-col">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/admin" className="text-sm font-bold text-[#2D5BE3]">⚙️ Administration</Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#5A5750]">
            Admin Métier
          </p>
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors"
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="my-2 border-t" />
          <Link
            href={backOfficeLink.href}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors"
          >
            <span className="text-base leading-none">{backOfficeLink.icon}</span>
            {backOfficeLink.label}
          </Link>
        </nav>
        <div className="border-t p-3">
          <LogoutButton variant="sidebar" />
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-[#F4F3EF] min-h-screen">
        <div className="max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
