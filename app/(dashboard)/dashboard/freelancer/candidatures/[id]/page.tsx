import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { FreelancerApplicationView } from "@/components/missions/freelancer-application-view";
import type { ApplicationViewProps } from "@/components/missions/freelancer-application-view";

export const revalidate = 0;
export const metadata = { title: "Détail de la candidature" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/connexion");

  const freelancerProfile = await prisma.freelancerProfile.findUnique({ where: { userId } });
  if (!freelancerProfile) redirect("/dashboard/freelancer/candidatures");

  const application = await prisma.application.findFirst({
    where: { id: params.id, freelancerId: freelancerProfile.id },
    include: {
      mission: { include: { client: true } },
    },
  });

  if (!application) redirect("/dashboard/freelancer/candidatures");

  // Look for an offer linked to this application
  let offer: ApplicationViewProps["offer"] = null;
  try {
    const offerRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/offers?applicationId=${params.id}`,
      { next: { revalidate: 0 } }
    );
    if (offerRes.ok) {
      const offerJson = await offerRes.json();
      const offers = Array.isArray(offerJson) ? offerJson : (offerJson.data ?? []);
      if (offers.length > 0) {
        const o = offers[0];
        offer = {
          id: o.id,
          title: o.title,
          description: o.description,
          offerType: o.offerType ?? o.type,
          totalBudget: o.totalBudget ?? o.amount,
          hourlyRate: o.hourlyRate,
          startDate: o.startDate ?? o.deadline,
          endDate: o.endDate,
          milestones: o.milestones ?? [],
          expiresAt: o.expiresAt,
          sentAt: o.sentAt,
        };
      }
    }
  } catch { /* ignore */ }

  // Look for an existing contract for this mission
  let contractId: string | undefined;
  try {
    const ct = await prisma.contract.findFirst({
      where: { missionId: application.missionId, freelancerId: freelancerProfile.id },
      select: { id: true },
    });
    contractId = ct?.id;
  } catch { /* ignore */ }

  const props: ApplicationViewProps = {
    applicationId: application.id,
    missionId: application.missionId,
    missionTitle: application.mission.title,
    clientName: application.mission.client.companyName ?? "Client",
    proposedBudget: application.proposedBudget ?? 0,
    status: application.status,
    coverLetter: application.coverLetter ?? undefined,
    createdAt: application.createdAt.toISOString(),
    offer,
    contractId,
  };

  return (
    <div className="max-w-5xl mx-auto">
      <FreelancerApplicationView {...props} />
    </div>
  );
}
