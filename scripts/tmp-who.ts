import { prisma } from "../lib/prisma";

async function main() {
  // Qui a créé la mission "Designer UI/UX" ?
  const mission = await prisma.mission.findUnique({
    where: { id: "cmrl0yatb003qfktim4wmfos3" },
    include: {
      client: {
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      },
    },
  });
  console.log("CLIENT:", JSON.stringify(mission?.client?.user, null, 2));

  // Qui est le freelancer du contrat ?
  const contract = await prisma.contract.findUnique({
    where: { id: "cmrlra7mj000az7qoffcasdwl" },
    include: {
      offer: {
        include: {
          application: {
            include: {
              freelancer: {
                include: { user: { select: { email: true, firstName: true, lastName: true } } },
              },
            },
          },
        },
      },
    },
  });
  console.log("FREELANCER:", JSON.stringify(contract?.offer?.application.freelancer?.user, null, 2));
  console.log("CONTRACT_STATUS:", contract?.status);
}

main().catch(console.error).finally(() => prisma.$disconnect());
