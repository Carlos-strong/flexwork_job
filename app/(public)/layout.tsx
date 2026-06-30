import Link from "next/link";

const publicNavLinks = [
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/freelancers", label: "Freelances" },
  { href: "/missions", label: "Missions" },
];

const footerPlatformLinks = [
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/faq", label: "FAQ" },
  { href: "/a-propos", label: "À propos" },
];

const footerLegalLinks = [
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/confiance", label: "TrustEngine" },
];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header public */}
      <header className="sticky top-0 z-50 w-full border-b border-[#E2E0D9] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" prefetch>
            <span className="text-[20px] font-bold text-[#2D5BE3]">Flexwork</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {publicNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                className="text-[14px] font-medium text-[#5A5750] hover:text-[#1A1916] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/connexion"
              prefetch
              className="text-[14px] font-medium text-[#5A5750] hover:text-[#1A1916] transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/inscription"
              prefetch
              className="inline-flex items-center justify-center rounded-[10px] bg-[#2D5BE3] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#1F4DD4] transition-colors"
            >
              S&apos;inscrire
            </Link>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E2E0D9] bg-[#FAFAF8]">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <span className="text-[18px] font-bold text-[#2D5BE3]">Flexwork</span>
              <p className="mt-2 text-[14px] text-[#5A5750]">
                La plateforme qui connecte freelances et clients.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-[#1A1916]">Plateforme</h3>
              <ul className="space-y-2 text-[14px] text-[#5A5750]">
                {footerPlatformLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-[#1A1916] transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-[#1A1916]">Légal</h3>
              <ul className="space-y-2 text-[14px] text-[#5A5750]">
                {footerLegalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-[#1A1916] transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-[#1A1916]">Contact</h3>
              <ul className="space-y-2 text-[14px] text-[#5A5750]">
                <li><Link href="/contact" className="hover:text-[#1A1916] transition-colors">Nous contacter</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-[#E2E0D9] pt-6 text-center text-[14px] text-[#5A5750]">
            &copy; {new Date().getFullYear()} Flexwork. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
