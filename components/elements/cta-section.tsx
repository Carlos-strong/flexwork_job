import Link from "next/link";

interface CtaSectionProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function CtaSection({
  title = "Prêt à commencer ?",
  description = "Rejoignez des milliers de freelances et clients qui utilisent déjà Flexwork pour collaborer en toute sérénité.",
  primaryLabel = "Créer mon compte gratuitement",
  primaryHref = "/inscription",
  secondaryLabel,
  secondaryHref = "/contact",
}: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 py-16 md:py-24">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full border-[40px] border-white/20" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full border-[40px] border-white/10" />
      </div>
      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-3xl font-bold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-4 text-white/80 max-w-xl mx-auto">
          {description}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3 text-base font-medium text-[#2D5BE3] hover:bg-white/90 transition-colors shadow-xl"
          >
            {primaryLabel}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          {secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center rounded-lg border border-white/30 px-8 py-3 text-base font-medium text-white hover:bg-white/10 transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
