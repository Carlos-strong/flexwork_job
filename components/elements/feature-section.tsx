import Link from "next/link";
import type { ReactNode } from "react";

interface FeatureItem {
  icon: string;
  text: string;
}

interface FeatureSectionProps {
  badge: string;
  title: string;
  description: string;
  features: FeatureItem[];
  ctaLabel: string;
  ctaHref: string;
  illustration: ReactNode;
  reversed?: boolean;
}

export function FeatureSection({
  badge,
  title,
  description,
  features,
  ctaLabel,
  ctaHref,
  illustration,
  reversed = false,
}: FeatureSectionProps) {
  return (
    <section className={reversed ? "border-y bg-[#F5F5F0]/30" : ""}>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className={`grid md:grid-cols-2 gap-12 items-center ${reversed ? "" : ""}`}>
          {reversed ? (
            <>
              <div className="order-2 md:order-1 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-8 border border-primary/10">
                {illustration}
              </div>
              <div className="order-1 md:order-2">
                <SectionContent
                  badge={badge}
                  title={title}
                  description={description}
                  features={features}
                  ctaLabel={ctaLabel}
                  ctaHref={ctaHref}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <SectionContent
                  badge={badge}
                  title={title}
                  description={description}
                  features={features}
                  ctaLabel={ctaLabel}
                  ctaHref={ctaHref}
                />
              </div>
              <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-8 border border-primary/10">
                {illustration}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionContent({
  badge,
  title,
  description,
  features,
  ctaLabel,
  ctaHref,
}: {
  badge: string;
  title: string;
  description: string;
  features: FeatureItem[];
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <>
      <span className="inline-block rounded-full bg-[#EEF2FD] px-4 py-1.5 text-xs font-semibold text-[#2D5BE3] uppercase tracking-wider mb-4">
        {badge}
      </span>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-4 text-[#5A5750] leading-relaxed">{description}</p>
      <ul className="mt-6 space-y-3">
        {features.map((item) => (
          <li key={item.text} className="flex items-center gap-3 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FD] text-sm">
              {item.icon}
            </span>
            {item.text}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-[#2D5BE3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1F4DD4] transition-colors"
      >
        {ctaLabel}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </>
  );
}
