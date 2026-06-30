export const revalidate = 86400;

import { PricingCard } from "@/components/elements/pricing-card";

const plans = [
  {
    name: "Gratuit",
    price: "0 €",
    description: "Pour démarrer",
    features: [
      "Profil freelance ou client",
      "Parcourir les missions",
      "5 candidatures par mois",
    ],
    cta: "S'inscrire",
    ctaHref: "/inscription",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "19 €",
    period: "/mois",
    description: "Pour les freelances actifs",
    features: [
      "Candidatures illimitées",
      "Time tracker",
      "Statistiques avancées",
      "Support prioritaire",
    ],
    cta: "Choisir Pro",
    ctaHref: "/inscription",
    highlighted: true,
  },
  {
    name: "Entreprise",
    price: "Sur devis",
    description: "Pour les recruteurs",
    features: [
      "Missions illimitées",
      "Matching IA avancé",
      "API dédiée",
      "Account manager",
    ],
    cta: "Nous contacter",
    ctaHref: "/contact",
    highlighted: false,
  },
];

export const metadata = { title: "Tarifs" };

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Des tarifs <span className="text-[#2D5BE3]">transparents</span>
        </h1>
        <p className="mt-4 text-lg text-[#5A5750]">
          Commissions plateforme de 5% sur chaque mission. Pas de frais cachés.
        </p>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard key={plan.name} {...plan} />
        ))}
      </div>
    </div>
  );
}

