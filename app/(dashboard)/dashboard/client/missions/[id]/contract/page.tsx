/**
 * Page contrat client (par mission) → redirige vers la vue de pilotage unifiée.
 *
 * Résout le contractId à partir du missionId, puis redirige vers
 * /dashboard/pilotage/[contractId] qui gère les deux rôles.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ClientContractPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=" + encodeURIComponent(`/dashboard/client/missions/${params.id}/contract`));
  }

  // Résoudre le contractId à partir du missionId
  const contract = await prisma.contract.findFirst({
    where: { missionId: params.id },
    select: { id: true },
  });

  if (contract) {
    redirect(`/dashboard/pilotage/${contract.id}`);
  }

  // Aucun contrat trouvé pour cette mission
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <p className="text-3xl mb-4">📄</p>
        <h2 className="text-xl font-semibold mb-2">Contrat introuvable</h2>
        <p className="text-[#5A5750] mb-6">
          Aucun contrat n&apos;est associé à cette mission.
        </p>
        <a
          href="/dashboard/client/contrats"
          className="inline-flex items-center rounded-lg bg-[#2D5BE3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A4BCE] transition-colors"
        >
          Voir mes contrats
        </a>
      </div>
    </div>
  );
}
