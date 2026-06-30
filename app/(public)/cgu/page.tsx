export const revalidate = 86400;

export const metadata = { title: "Conditions Générales" };

export default function CguPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl prose prose-gray">
        <h1>Conditions Générales d&apos;Utilisation</h1>
        <p className="text-[#5A5750]">Dernière mise à jour : 15 juin 2026</p>

        <h2>1. Acceptation des conditions</h2>
        <p>
          En accédant et en utilisant la plateforme Flexwork, vous acceptez
          d&apos;être lié par les présentes conditions générales d&apos;utilisation.
        </p>

        <h2>2. Description du service</h2>
        <p>
          Flexwork est une plateforme de mise en relation entre clients et
          freelances. Elle permet la publication de missions, la candidature,
          le suivi de projet et le paiement sécurisé.
        </p>

        <h2>3. Obligations des utilisateurs</h2>
        <p>
          Les utilisateurs s&apos;engagent à fournir des informations exactes,
          à respecter la législation en vigueur et à utiliser la plateforme
          de manière conforme.
        </p>

        <h2>4. Paiement et commissions</h2>
        <p>
          Flexwork prélève une commission de 5% sur le montant des missions.
          Les paiements sont sécurisés via Stripe Connect et TrustEngine.
        </p>

        <h2>5. Propriété intellectuelle</h2>
        <p>
          Les livrables réalisés dans le cadre d&apos;une mission deviennent la
          propriété du client après validation et paiement complet.
        </p>
      </div>
    </div>
  );
}
