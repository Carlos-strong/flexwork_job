export const revalidate = 86400;

export const metadata = { title: "Paiement sécurisé TrustEngine" };

export default function TrustPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Paiement sécurisé avec TrustEngine
        </h1>
        <p className="mt-4 text-[#5A5750]">
          Comment fonctionne l&apos;escrow et la protection des paiements.
        </p>

        <div className="mt-12 space-y-8">
          <div className="rounded-xl border border-[#E2E0D9] p-6">
            <h3 className="text-xl font-semibold">Qu&apos;est-ce que l&apos;escrow ?</h3>
            <p className="mt-2 text-[#5A5750]">
              L&apos;escrow est un mécanisme de séquestre : les fonds sont bloqués
              sur un compte tiers (TrustEngine) pendant toute la durée de la
              mission. Ils ne sont libérés que lorsque les deux parties valident
              le travail.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E0D9] p-6">
            <h3 className="text-xl font-semibold">Protection du client</h3>
            <p className="mt-2 text-[#5A5750]">
              Vous ne payez que lorsque le travail est conforme à vos attentes.
              Si un livrable n&apos;est pas satisfaisant, vous pouvez refuser
              la libération des fonds.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E0D9] p-6">
            <h3 className="text-xl font-semibold">Protection du freelance</h3>
            <p className="mt-2 text-[#5A5750]">
              Votre travail est garanti d&apos;être payé. Les fonds sont déjà
              disponibles sur le compte séquestre avant même que vous ne
              commenciez la mission.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E0D9] p-6">
            <h3 className="text-xl font-semibold">Gestion des litiges</h3>
            <p className="mt-2 text-[#5A5750]">
              En cas de désaccord, TrustEngine propose une médiation
              professionnelle pour trouver une solution équitable aux deux
              parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
