import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Suppression de toutes les données sauf admin...");

  // 1. Récupérer l'admin existant
  const admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    include: { userRoles: true },
  });

  if (!admin) {
    console.log("⚠️  Admin non trouvé, création d'un nouvel admin...");
  } else {
    console.log(`✅ Admin trouvé: ${admin.email} (id: ${admin.id})`);
  }

  // 2. Supprimer toutes les données (sans toucher à l'admin)
  // Ordre respectant les contraintes de clés étrangères
  await prisma.otpCode.deleteMany({ where: { userId: admin ? { not: admin.id } : undefined } });
  await prisma.demande.deleteMany();
  await prisma.disponibilite.deleteMany();
  await prisma.zoneIntervention.deleteMany();
  await prisma.prestataireService.deleteMany();
  await prisma.prestataireMetier.deleteMany();
  await prisma.verificationIdentite.deleteMany({ where: { userId: admin ? { not: admin.id } : undefined } });
  await prisma.adresse.deleteMany({ where: { userId: admin ? { not: admin.id } : undefined } });
  
  // Supprimer les userRole sauf ceux de l'admin
  if (admin) {
    await prisma.userRole.deleteMany({ where: { userId: { not: admin.id } } });
  } else {
    await prisma.userRole.deleteMany();
  }
  
  await prisma.message.deleteMany();
  await prisma.timeSession.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.freelancerProfile.deleteMany();
  await prisma.clientProfile.deleteMany();

  // Supprimer les utilisateurs sauf l'admin
  if (admin) {
    await prisma.user.deleteMany({ where: { id: { not: admin.id } } });
  } else {
    await prisma.user.deleteMany();
  }

  // Supprimer les référentiels (sans supprimer les rôles nécessaires pour l'admin)
  await prisma.service.deleteMany();
  await prisma.metier.deleteMany();
  await prisma.categorie.deleteMany();
  
  // Nettoyer les rôles inutilisés mais garder ADMIN
  if (admin) {
    await prisma.role.deleteMany({ where: { libelle: { notIn: ["ADMIN", "CLIENT", "PRESTATAIRE"] } } });
  } else {
    await prisma.role.deleteMany();
  }

  // 3. Restaurer/créer l'admin
  const password = await bcrypt.hash("password123", 12);

  let adminUser;
  if (admin) {
    // Mettre à jour l'admin existant pour garantir les bons identifiants
    adminUser = await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "System",
        passwordHash: password,
        activeProfile: "ADMIN",
      },
    });
    console.log("✅ Admin mis à jour avec succès");
  } else {
    // Créer un nouvel admin
    // D'abord créer le rôle ADMIN s'il n'existe pas
    let roleAdmin = await prisma.role.findUnique({ where: { libelle: "ADMIN" } });
    if (!roleAdmin) {
      roleAdmin = await prisma.role.create({ data: { libelle: "ADMIN" } });
    }
    let roleClient = await prisma.role.findUnique({ where: { libelle: "CLIENT" } });
    if (!roleClient) {
      roleClient = await prisma.role.create({ data: { libelle: "CLIENT" } });
    }

    adminUser = await prisma.user.create({
      data: {
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "System",
        passwordHash: password,
        activeProfile: "ADMIN",
      },
    });

    // Assigner les rôles
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: roleAdmin.id } });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: roleClient.id } });
    console.log("✅ Admin créé avec succès");
  }

  console.log("\n🔑 Identifiants admin restaurés :");
  console.log(`   Email:    admin@example.com`);
  console.log(`   Mot de passe: password123`);
  console.log(`   ID:       ${adminUser.id}`);
  console.log("\n✅ Nettoyage terminé !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
