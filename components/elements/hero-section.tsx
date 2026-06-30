import Link from "next/link";
import { SecurePaymentIllustration, HeroIllustration } from "./illustrations";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-12 md:py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-[#F8F9FD] px-4 py-1.5 text-sm text-[#2D5BE3] mb-6">
              <span className="h-2 w-2 rounded-full bg-[#2D5BE3] animate-pulse" />
              Plateforme de mise en relation nouvelle génération
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-tight">
              Trouvez le freelance parfait
              <span className="text-[#2D5BE3]"> pour votre projet</span>
            </h1>
            <p className="mt-6 text-lg text-[#5A5750] md:text-xl leading-relaxed">
              Flexwork connecte les meilleurs talents avec les entreprises qui
              ont besoin d&apos;eux. Publication de mission, paiement sécurisé
              et matching IA.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2D5BE3] px-8 py-3.5 text-base font-medium text-white hover:bg-[#1F4DD4] transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
              >
                Commencer
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/missions"
                className="inline-flex items-center justify-center rounded-lg border border-[#E2E0D9] bg-white px-8 py-3.5 text-base font-medium hover:bg-[#EEF2FD] hover:text-[#1A1916] transition-colors"
              >
                Voir les missions
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm text-[#5A5750]">
              <div className="flex items-center gap-1.5">
                <SecurePaymentIllustration />
                <span>Paiement sécurisé</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Garantie satisfaction</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Matching IA</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
