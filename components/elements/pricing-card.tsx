import Link from "next/link";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted = false,
}: PricingCardProps) {
  return (
    <div
      className={`rounded-xl border p-8 ${
        highlighted
          ? "border-primary bg-[#F8F9FD] shadow-lg"
          : "border-[#E2E0D9]"
      }`}
    >
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-2">
        <span className="text-3xl font-bold">{price}</span>
        {period && (
          <span className="text-sm text-[#5A5750]">{period}</span>
        )}
      </p>
      <p className="mt-1 text-sm text-[#5A5750]">{description}</p>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <span className="text-[#2D5BE3]">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
          highlighted
            ? "bg-[#2D5BE3] text-white hover:bg-[#1F4DD4]"
            : "border border-[#E2E0D9] bg-white hover:bg-[#EEF2FD]"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
