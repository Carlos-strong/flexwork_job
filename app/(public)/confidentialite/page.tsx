export const revalidate = 86400;

export const metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl prose prose-gray">
        <h1>Politique de confidentialité</h1>
        <p className="text-[#5A5750]">Dernière mise à jour : 15 juin 2026</p>

        <h2>1. Collecte des données</h2>
        <p>
          Nous collectons les données nécessaires au fonctionnement de la
          plateforme : nom, email, compétences, informations de paiement.
        </p>

        <h2>2. Utilisation des données</h2>
        <p>
          Vos données sont utilisées pour : la mise en relation, le traitement
          des paiements, l&apos;amélioration du service et le support client.
        </p>

        <h2>3. Protection des données</h2>
        <p>
          Nous utilisons des mesures de sécurité techniques et organisationnelles
          pour protéger vos données conformément au RGPD.
        </p>

        <h2>4. Vos droits</h2>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification et de
          suppression de vos données. Pour exercer ces droits, contactez-nous
          à privacy@flexwork.fr.
        </p>
      </div>
    </div>
  );
}
