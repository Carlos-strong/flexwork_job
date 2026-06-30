export const revalidate = 86400;

export const metadata = { title: "Comment ça marche" };

export default function HowItWorksPage() {
  const steps = [
    {
      title: "1. Publiez une mission",
      description:
        "Décrivez votre projet, votre budget et les compétences requises. En quelques clics, votre mission est en ligne.",
    },
    {
      title: "2. Recevez des candidatures",
      description:
        "Les freelances intéressés postulent avec leur proposition. Notre IA vous suggère les meilleurs profils.",
    },
    {
      title: "3. Collaborez en toute sérénité",
      description:
        "Utilisez l'espace de travail partagé, le chat et le time tracker pour suivre l'avancement du projet.",
    },
    {
      title: "4. Payez en sécurité",
      description:
        "Les fonds sont sécurisés via TrustEngine. Vous ne libérez le paiement qu'une fois le travail validé.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Comment ça marche
        </h1>
        <p className="mt-4 text-lg text-[#5A5750]">
          Flexwork simplifie la collaboration entre clients et freelances.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <div className="space-y-12">
          {steps.map((step) => (
            <div key={step.title} className="relative pl-8 border-l-2 border-[#C3D1F8]">
              <div className="absolute left-0 top-0 -translate-x-1/2 h-4 w-4 rounded-full bg-[#2D5BE3]" />
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-[#5A5750]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
