import Link from "next/link";
import { LogoutButton } from "@/components/layout/logout-button";

const backOfficeNav = [
  { href: "/backoffice", label: "Dashboard", icon: "📊" },
  { href: "/backoffice/catalog", label: "Taxonomie", icon: "🗂️" },
  { href: "/backoffice/locations", label: "Localisation", icon: "🌍" },
  { href: "/backoffice/finance", label: "Finance", icon: "💰" },
  { href: "/backoffice/settings", label: "Paramètres", icon: "⚙️" },
  { href: "/backoffice/roles", label: "Rôles & Accès", icon: "🔐" },
  { href: "/backoffice/audit", label: "Audit", icon: "📋" },
  { href: "/backoffice/reports", label: "Reporting", icon: "📈" },
];

export default function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-white flex flex-col">
        <div className="flex h-14 items-center border-b px-5 gap-2">
          <span className="text-base">🔧</span>
          <Link href="/backoffice" className="text-sm font-bold text-[#2D5BE3]">
            Back Office
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#5A5750]">
            Opérationnel
          </p>
          {backOfficeNav.map((item) => (
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
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#5A5750] hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors"
          >
            <span className="text-base leading-none">⚙️</span>
            Admin Métier →
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
