export const revalidate = 86400;

export const metadata = { title: "À propos" };

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">À propos</h1>
        <div className="mt-8 space-y-6 text-[#5A5750]">
          <p>
            Flexwork est née d&apos;une conviction : la collaboration entre
            freelances et entreprises doit être plus simple, plus transparente
            et plus sécurisée.
          </p>
          <p>
            Notre plateforme utilise l&apos;intelligence artificielle pour
            faciliter le matching entre les talents et les projets, tout en
            garantissant des paiements sécurisés via Stripe Connect et
            TrustEngine.
          </p>
          <p>
            Que vous soyez un client cherchant le freelance idéal ou un
            talent à la recherche de nouvelles missions, Flexwork vous offre
            les outils nécessaires pour réussir votre collaboration.
          </p>
        </div>
      </div>
    </div>
  );
}
