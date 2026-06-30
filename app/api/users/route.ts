import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        freelancerProfile: true,
        clientProfile: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName, passwordHash, country, profileType } = await request.json();
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        country,
        activeProfile: profileType || "FREELANCER",
      },
    });

    // Créer le profil associé
    if (profileType === "FREELANCER" || !profileType) {
      await prisma.freelancerProfile.create({
        data: { userId: user.id },
      });
    } else if (profileType === "CLIENT") {
      await prisma.clientProfile.create({
        data: { userId: user.id },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, email, firstName, lastName, country, activeProfile } = await request.json();
    const user = await prisma.user.update({
      where: { id },
      data: {
        email,
        firstName,
        lastName,
        country,
        activeProfile,
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    console.log("Attempting to delete user with ID:", id);

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        freelancerProfile: true,
        clientProfile: true,
      },
    });
    if (!user) {
      console.log("User not found");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.log("User found:", user);

    // Étape 1 : Supprimer les comptes et sessions (ont onDelete: Cascade côté Prisma)
    await prisma.account.deleteMany({ where: { userId: id } });
    await prisma.session.deleteMany({ where: { userId: id } });

    // Étape 2 : Supprimer les références liées aux missions du client (via ClientProfile)
    if (user.clientProfile) {
      const clientMissionIds = (
        await prisma.mission.findMany({
          where: { clientId: user.clientProfile.id },
          select: { id: true },
        })
      ).map((m) => m.id);

      if (clientMissionIds.length > 0) {
        await prisma.application.deleteMany({
          where: { missionId: { in: clientMissionIds } },
        });

        const clientContractIds = (
          await prisma.contract.findMany({
            where: { missionId: { in: clientMissionIds } },
            select: { id: true },
          })
        ).map((c) => c.id);

        if (clientContractIds.length > 0) {
          await prisma.milestone.deleteMany({ where: { contractId: { in: clientContractIds } } });
          await prisma.timeSession.deleteMany({ where: { contractId: { in: clientContractIds } } });
          await prisma.message.deleteMany({ where: { contractId: { in: clientContractIds } } });
          await prisma.contract.deleteMany({ where: { id: { in: clientContractIds } } });
        }

        await prisma.mission.deleteMany({ where: { id: { in: clientMissionIds } } });
      }
    }

    // Étape 3 : Supprimer les candidatures et contrats du freelance (via FreelancerProfile)
    if (user.freelancerProfile) {
      await prisma.application.deleteMany({
        where: { freelancerId: user.freelancerProfile.id },
      });

      const freelancerContractIds = (
        await prisma.contract.findMany({
          where: { freelancerId: user.freelancerProfile.id },
          select: { id: true },
        })
      ).map((c) => c.id);

      if (freelancerContractIds.length > 0) {
        await prisma.milestone.deleteMany({ where: { contractId: { in: freelancerContractIds } } });
        await prisma.timeSession.deleteMany({ where: { contractId: { in: freelancerContractIds } } });
        await prisma.message.deleteMany({ where: { contractId: { in: freelancerContractIds } } });
        await prisma.contract.deleteMany({ where: { id: { in: freelancerContractIds } } });
      }
    }

    // Étape 4 : Supprimer les messages où l'utilisateur est expéditeur ou destinataire
    await prisma.message.deleteMany({
      where: { OR: [{ senderId: id }, { receiverId: id }] },
    });

    // Étape 5 : Supprimer les paiements
    await prisma.payment.deleteMany({
      where: { userId: id },
    });

    // Étape 6 : Supprimer les profils (Cascade devrait le faire, mais explicit pour sécurité)
    await prisma.freelancerProfile.deleteMany({ where: { userId: id } });
    await prisma.clientProfile.deleteMany({ where: { userId: id } });

    // Étape 7 : Supprimer l'utilisateur
    await prisma.user.delete({
      where: { id },
    });
    console.log("User deleted successfully");
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to delete user", details: message }, { status: 500 });
  }
}