import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Restauration du catalogue (Catégories → Métiers → Services)...");

  // Nettoyage préalable
  await prisma.prestataireService.deleteMany();
  await prisma.prestataireMetier.deleteMany();
  await prisma.demande.deleteMany();
  await prisma.service.deleteMany();
  await prisma.metier.deleteMany();
  await prisma.categorie.deleteMany();

  // ========== CATÉGORIES ==========
  const catPlomberie = await prisma.categorie.create({
    data: { libelle: "Plomberie", description: "Installation et réparation de plomberie", icon: "🔧", ordre: 1 },
  });
  const catElectricite = await prisma.categorie.create({
    data: { libelle: "Électricité", description: "Installation et réparation électrique", icon: "⚡", ordre: 2 },
  });
  const catMaconnerie = await prisma.categorie.create({
    data: { libelle: "Maçonnerie", description: "Travaux de maçonnerie et de construction", icon: "🧱", ordre: 3 },
  });
  const catMenage = await prisma.categorie.create({
    data: { libelle: "Ménage", description: "Services de nettoyage et d'entretien", icon: "🧹", ordre: 4 },
  });
  const catLivraison = await prisma.categorie.create({
    data: { libelle: "Livraison", description: "Services de livraison et course", icon: "📦", ordre: 5 },
  });
  const catJardinage = await prisma.categorie.create({
    data: { libelle: "Jardinage", description: "Entretien jardin et espaces verts", icon: "🌿", ordre: 6 },
  });
  const catPeinture = await prisma.categorie.create({
    data: { libelle: "Peinture", description: "Travaux de peinture intérieure et extérieure", icon: "🎨", ordre: 7 },
  });

  console.log(`   ✅ ${7} catégories créées`);

  // ========== MÉTIERS ==========
  const metierPlombier = await prisma.metier.create({
    data: { categorieId: catPlomberie.id, libelle: "Plombier", description: "Installation et réparation de plomberie" },
  });
  const metierElectricien = await prisma.metier.create({
    data: { categorieId: catElectricite.id, libelle: "Électricien", description: "Installation et réparation électrique" },
  });
  const metierMacon = await prisma.metier.create({
    data: { categorieId: catMaconnerie.id, libelle: "Maçon", description: "Travaux de maçonnerie" },
  });
  const metierMenagere = await prisma.metier.create({
    data: { categorieId: catMenage.id, libelle: "Ménagère/Ménager", description: "Services de ménage et entretien" },
  });
  const metierLivreur = await prisma.metier.create({
    data: { categorieId: catLivraison.id, libelle: "Livreur", description: "Services de livraison" },
  });
  const metierJardinier = await prisma.metier.create({
    data: { categorieId: catJardinage.id, libelle: "Jardinier", description: "Entretien jardin et espaces verts" },
  });
  const metierPeintre = await prisma.metier.create({
    data: { categorieId: catPeinture.id, libelle: "Peintre", description: "Travaux de peinture" },
  });

  console.log(`   ✅ ${7} métiers créés`);

  // ========== SERVICES ==========
  // Plombier
  await prisma.service.createMany({
    data: [
      { metierId: metierPlombier.id, libelle: "Réparation de fuite", description: "Réparation de fuite d'eau (robinet, canalisation, chasse d'eau)", dureeEstimee: 60 },
      { metierId: metierPlombier.id, libelle: "Installation robinet", description: "Installation ou remplacement de robinet", dureeEstimee: 45 },
      { metierId: metierPlombier.id, libelle: "Débouchage canalisation", description: "Débouchage d'évier, lavabo, douche ou WC", dureeEstimee: 45 },
      { metierId: metierPlombier.id, libelle: "Installation chauffe-eau", description: "Installation ou remplacement de chauffe-eau", dureeEstimee: 120 },
      { metierId: metierPlombier.id, libelle: "Réparation chasse d'eau", description: "Réparation ou remplacement de chasse d'eau", dureeEstimee: 30 },
    ],
  });

  // Électricien
  await prisma.service.createMany({
    data: [
      { metierId: metierElectricien.id, libelle: "Installation prise électrique", description: "Installation ou remplacement de prise électrique", dureeEstimee: 30 },
      { metierId: metierElectricien.id, libelle: "Réparation court-circuit", description: "Diagnostic et réparation de court-circuit", dureeEstimee: 60 },
      { metierId: metierElectricien.id, libelle: "Installation interrupteur", description: "Installation ou remplacement d'interrupteur", dureeEstimee: 30 },
      { metierId: metierElectricien.id, libelle: "Mise aux normes tableau électrique", description: "Mise en conformité du tableau électrique", dureeEstimee: 180 },
      { metierId: metierElectricien.id, libelle: "Installation luminaire", description: "Installation de lustre, applique ou spot", dureeEstimee: 45 },
    ],
  });

  // Maçon
  await prisma.service.createMany({
    data: [
      { metierId: metierMacon.id, libelle: "Petite réparation mur", description: "Rebouchage de trou, fissure ou rénovation de petite surface", dureeEstimee: 60 },
      { metierId: metierMacon.id, libelle: "Construction mur", description: "Construction de mur en parpaing, brique ou pierre", dureeEstimee: 240 },
      { metierId: metierMacon.id, libelle: "Carrelage", description: "Pose de carrelage au sol ou au mur", dureeEstimee: 180 },
      { metierId: metierMacon.id, libelle: "Chape", description: "Réalisation de chape ciment ou liquide", dureeEstimee: 180 },
      { metierId: metierMacon.id, libelle: "Démolition", description: "Démolition de mur non porteur ou cloison", dureeEstimee: 120 },
    ],
  });

  // Ménagère/Ménager
  await prisma.service.createMany({
    data: [
      { metierId: metierMenagere.id, libelle: "Ménage standard", description: "Nettoyage complet d'un appartement ou maison", dureeEstimee: 120 },
      { metierId: metierMenagere.id, libelle: "Ménage vitres", description: "Nettoyage de toutes les vitres et miroirs", dureeEstimee: 60 },
      { metierId: metierMenagere.id, libelle: "Nettoyage cuisine", description: "Nettoyage approfondi de la cuisine (four, frigo, hotte)", dureeEstimee: 90 },
      { metierId: metierMenagere.id, libelle: "Repassage", description: "Repassage et pliage du linge", dureeEstimee: 60 },
      { metierId: metierMenagere.id, libelle: "Grand ménage", description: "Ménage complet avec récurage et entretien approfondi", dureeEstimee: 240 },
    ],
  });

  // Livreur
  await prisma.service.createMany({
    data: [
      { metierId: metierLivreur.id, libelle: "Livraison colis", description: "Livraison de colis standard", dureeEstimee: 30 },
      { metierId: metierLivreur.id, libelle: "Course rapide", description: "Course urgente en ville", dureeEstimee: 30 },
      { metierId: metierLivreur.id, libelle: "Livraison repas", description: "Livraison de repas à domicile", dureeEstimee: 20 },
      { metierId: metierLivreur.id, libelle: "Déménagement", description: "Aide au déménagement (transport + manutention)", dureeEstimee: 240 },
      { metierId: metierLivreur.id, libelle: "Livraison gros volume", description: "Livraison de meubles ou objets volumineux", dureeEstimee: 60 },
    ],
  });

  // Jardinier
  await prisma.service.createMany({
    data: [
      { metierId: metierJardinier.id, libelle: "Tonte pelouse", description: "Tonte de pelouse avec finition", dureeEstimee: 60 },
      { metierId: metierJardinier.id, libelle: "Taille haies", description: "Taille de haies et arbustes", dureeEstimee: 60 },
      { metierId: metierJardinier.id, libelle: "Désherbage", description: "Désherbage manuel ou mécanique", dureeEstimee: 60 },
      { metierId: metierJardinier.id, libelle: "Plantation", description: "Plantation de fleurs, arbres ou arbustes", dureeEstimee: 60 },
      { metierId: metierJardinier.id, libelle: "Nettoyage jardin", description: "Nettoyage complet du jardin et évacuation déchets verts", dureeEstimee: 120 },
    ],
  });

  // Peintre
  await prisma.service.createMany({
    data: [
      { metierId: metierPeintre.id, libelle: "Peinture mur", description: "Peinture d'un mur ou d'une pièce", dureeEstimee: 120 },
      { metierId: metierPeintre.id, libelle: "Peinture plafond", description: "Peinture de plafond", dureeEstimee: 120 },
      { metierId: metierPeintre.id, libelle: "Pose papier peint", description: "Pose ou dépose de papier peint", dureeEstimee: 180 },
      { metierId: metierPeintre.id, libelle: "Peinture extérieure", description: "Peinture de façade ou boiseries extérieures", dureeEstimee: 240 },
      { metierId: metierPeintre.id, libelle: "Enduit lissage", description: "Application d'enduit de lissage avant peinture", dureeEstimee: 120 },
    ],
  });

  console.log(`   ✅ ${35} services créés`);

  // ========== BILAN ==========
  const totalCategories = await prisma.categorie.count();
  const totalMetiers = await prisma.metier.count();
  const totalServices = await prisma.service.count();

  console.log(`\n📊 Bilan du catalogue :`);
  console.log(`   📂 ${totalCategories} catégories`);
  console.log(`   🔧 ${totalMetiers} métiers`);
  console.log(`   📋 ${totalServices} services`);
  console.log(`\n🌱 Catalogue restauré avec succès !`);
  console.log(`   ➡️  Accès : http://localhost:3000/backoffice/catalog`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
