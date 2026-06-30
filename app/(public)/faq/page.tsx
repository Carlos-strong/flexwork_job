export const revalidate = 86400;

import { FaqAccordion } from "@/lib/dynamic-imports";

const faqs = [
  {
    question: "Comment fonctionne le paiement sécurisé ?",
    answer:
      "Les fonds sont déposés sur un compte séquestre TrustEngine dès le début de la mission. Ils ne sont libérés que lorsque vous validez le travail accompli. Cela garantit la sécurité des deux parties.",
  },
  {
    question: "Quels sont les frais de la plateforme ?",
    answer:
      "Flexwork prélève une commission de 5% sur le montant total de chaque mission. Il n'y a pas de frais cachés ni d'abonnement obligatoire.",
  },
  {
    question: "Comment puis-je trouver le freelance idéal ?",
    answer:
      "Notre IA 'Uma' analyse les compétences requises pour votre mission et vous suggère les profils les plus pertinents. Vous pouvez également parcourir les profils et filtrer par compétences, taux journalier et disponibilité.",
  },
  {
    question: "Que faire en cas de litige ?",
    answer:
      "TrustEngine gère les litiges entre clients et freelances. En cas de désaccord, une médiation est proposée pour trouver une solution équitable.",
  },
  {
    question: "Comment suivre le temps passé sur une mission ?",
    answer:
      "Notre time tracker intégré vous permet de démarrer/arrêter le chronomètre directement depuis l'espace de travail. Les sessions sont horodatées et conservées comme preuve de travail.",
  },
];

export const metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Questions fréquentes
        </h1>
        <p className="mt-4 text-[#5A5750]">
          Tout ce que vous devez savoir sur Flexwork.
        </p>
        <div className="mt-12">
          <FaqAccordion items={faqs} />
        </div>
      </div>
    </div>
  );
}

