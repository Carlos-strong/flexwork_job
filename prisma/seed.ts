import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Démarrage du seed...");

  // Nettoyage (nouveaux modèles d'abord)
  await prisma.otpCode.deleteMany();
  await prisma.demande.deleteMany();
  await prisma.disponibilite.deleteMany();
  await prisma.zoneIntervention.deleteMany();
  await prisma.prestataireService.deleteMany();
  await prisma.prestataireMetier.deleteMany();
  await prisma.verificationIdentite.deleteMany();
  await prisma.adresse.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.service.deleteMany();
  await prisma.metier.deleteMany();
  await prisma.categorie.deleteMany();
  await prisma.role.deleteMany();

  // Nettoyage (modèles existants)
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
  await prisma.user.deleteMany();

  // ========== RÉFÉRENTIELS (ROLES, CATÉGORIES, MÉTIERS, SERVICES) ==========

  // Création des rôles
  const roleClient = await prisma.role.create({ data: { libelle: "CLIENT" } });
  const rolePrestataire = await prisma.role.create({ data: { libelle: "PRESTATAIRE" } });
  const roleAdmin = await prisma.role.create({ data: { libelle: "ADMIN" } });

  // Création des catégories
  const catPlomberie = await prisma.categorie.create({ data: { libelle: "Plomberie", description: "Installation et réparation de plomberie", icon: "🔧", ordre: 1 } });
  const catElectricite = await prisma.categorie.create({ data: { libelle: "Électricité", description: "Installation et réparation électrique", icon: "⚡", ordre: 2 } });
  const catMaconnerie = await prisma.categorie.create({ data: { libelle: "Maçonnerie", description: "Travaux de maçonnerie et de construction", icon: "🧱", ordre: 3 } });
  const catMenage = await prisma.categorie.create({ data: { libelle: "Ménage", description: "Services de nettoyage et d'entretien", icon: "🧹", ordre: 4 } });
  const catLivraison = await prisma.categorie.create({ data: { libelle: "Livraison", description: "Services de livraison et course", icon: "📦", ordre: 5 } });
  const catJardinage = await prisma.categorie.create({ data: { libelle: "Jardinage", description: "Entretien jardin et espaces verts", icon: "🌿", ordre: 6 } });
  const catPeinture = await prisma.categorie.create({ data: { libelle: "Peinture", description: "Travaux de peinture intérieure et extérieure", icon: "🎨", ordre: 7 } });

  // Création des métiers
  // Plomberie
  const metierPlombier = await prisma.metier.create({ data: { categorieId: catPlomberie.id, libelle: "Plombier", description: "Installation et réparation de plomberie" } });
  // Électricité
  const metierElectricien = await prisma.metier.create({ data: { categorieId: catElectricite.id, libelle: "Électricien", description: "Installation et réparation électrique" } });
  // Maçonnerie
  const metierMacon = await prisma.metier.create({ data: { categorieId: catMaconnerie.id, libelle: "Maçon", description: "Travaux de maçonnerie" } });
  // Ménage
  const metierMenagere = await prisma.metier.create({ data: { categorieId: catMenage.id, libelle: "Ménagère/Ménager", description: "Services de ménage et entretien" } });
  // Livraison
  const metierLivreur = await prisma.metier.create({ data: { categorieId: catLivraison.id, libelle: "Livreur", description: "Services de livraison" } });
  // Jardinage
  const metierJardinier = await prisma.metier.create({ data: { categorieId: catJardinage.id, libelle: "Jardinier", description: "Entretien jardin et espaces verts" } });
  // Peinture
  const metierPeintre = await prisma.metier.create({ data: { categorieId: catPeinture.id, libelle: "Peintre", description: "Travaux de peinture" } });

  // Création des services par métier
  // Plombier
  await prisma.service.createMany({ data: [
    { metierId: metierPlombier.id, libelle: "Réparation de fuite", description: "Réparation de fuite d'eau (robinet, canalisation, chasse d'eau)", dureeEstimee: 60 },
    { metierId: metierPlombier.id, libelle: "Installation robinet", description: "Installation ou remplacement de robinet", dureeEstimee: 45 },
    { metierId: metierPlombier.id, libelle: "Débouchage canalisation", description: "Débouchage d'évier, lavabo, douche ou WC", dureeEstimee: 45 },
    { metierId: metierPlombier.id, libelle: "Installation chauffe-eau", description: "Installation ou remplacement de chauffe-eau", dureeEstimee: 120 },
    { metierId: metierPlombier.id, libelle: "Réparation chasse d'eau", description: "Réparation ou remplacement de chasse d'eau", dureeEstimee: 30 },
  ] });

  // Électricien
  await prisma.service.createMany({ data: [
    { metierId: metierElectricien.id, libelle: "Installation prise électrique", description: "Installation ou remplacement de prise électrique", dureeEstimee: 30 },
    { metierId: metierElectricien.id, libelle: "Réparation court-circuit", description: "Diagnostic et réparation de court-circuit", dureeEstimee: 60 },
    { metierId: metierElectricien.id, libelle: "Installation interrupteur", description: "Installation ou remplacement d'interrupteur", dureeEstimee: 30 },
    { metierId: metierElectricien.id, libelle: "Mise aux normes tableau électrique", description: "Mise en conformité du tableau électrique", dureeEstimee: 180 },
    { metierId: metierElectricien.id, libelle: "Installation luminaire", description: "Installation de lustre, applique ou spot", dureeEstimee: 45 },
  ] });

  // Maçon
  await prisma.service.createMany({ data: [
    { metierId: metierMacon.id, libelle: "Petite réparation mur", description: "Rebouchage de trou, fissure ou rénovation de petite surface", dureeEstimee: 60 },
    { metierId: metierMacon.id, libelle: "Construction mur", description: "Construction de mur en parpaing, brique ou pierre", dureeEstimee: 240 },
    { metierId: metierMacon.id, libelle: "Carrelage", description: "Pose de carrelage au sol ou au mur", dureeEstimee: 180 },
    { metierId: metierMacon.id, libelle: "Chape", description: "Réalisation de chape ciment ou liquide", dureeEstimee: 180 },
    { metierId: metierMacon.id, libelle: "Démolition", description: "Démolition de mur non porteur ou cloison", dureeEstimee: 120 },
  ] });

  // Ménagère/Ménager
  await prisma.service.createMany({ data: [
    { metierId: metierMenagere.id, libelle: "Ménage standard", description: "Nettoyage complet d'un appartement ou maison", dureeEstimee: 120 },
    { metierId: metierMenagere.id, libelle: "Ménage vitres", description: "Nettoyage de toutes les vitres et miroirs", dureeEstimee: 60 },
    { metierId: metierMenagere.id, libelle: "Nettoyage cuisine", description: "Nettoyage approfondi de la cuisine (four, frigo, hotte)", dureeEstimee: 90 },
    { metierId: metierMenagere.id, libelle: "Repassage", description: "Repassage et pliage du linge", dureeEstimee: 60 },
    { metierId: metierMenagere.id, libelle: "Grand ménage", description: "Ménage complet avec récurage et entretien approfondi", dureeEstimee: 240 },
  ] });

  // Livreur
  await prisma.service.createMany({ data: [
    { metierId: metierLivreur.id, libelle: "Livraison colis", description: "Livraison de colis standard", dureeEstimee: 30 },
    { metierId: metierLivreur.id, libelle: "Course rapide", description: "Course urgente en ville", dureeEstimee: 30 },
    { metierId: metierLivreur.id, libelle: "Livraison repas", description: "Livraison de repas à domicile", dureeEstimee: 20 },
    { metierId: metierLivreur.id, libelle: "Déménagement", description: "Aide au déménagement (transport + manutention)", dureeEstimee: 240 },
    { metierId: metierLivreur.id, libelle: "Livraison gros volume", description: "Livraison de meubles ou objets volumineux", dureeEstimee: 60 },
  ] });

  // Jardinier
  await prisma.service.createMany({ data: [
    { metierId: metierJardinier.id, libelle: "Tonte pelouse", description: "Tonte de pelouse avec finition", dureeEstimee: 60 },
    { metierId: metierJardinier.id, libelle: "Taille haies", description: "Taille de haies et arbustes", dureeEstimee: 60 },
    { metierId: metierJardinier.id, libelle: "Désherbage", description: "Désherbage manuel ou mécanique", dureeEstimee: 60 },
    { metierId: metierJardinier.id, libelle: "Plantation", description: "Plantation de fleurs, arbres ou arbustes", dureeEstimee: 60 },
    { metierId: metierJardinier.id, libelle: "Nettoyage jardin", description: "Nettoyage complet du jardin et évacuation déchets verts", dureeEstimee: 120 },
  ] });

  // Peintre
  await prisma.service.createMany({ data: [
    { metierId: metierPeintre.id, libelle: "Peinture mur", description: "Peinture d'un mur ou d'une pièce", dureeEstimee: 120 },
    { metierId: metierPeintre.id, libelle: "Peinture plafond", description: "Peinture de plafond", dureeEstimee: 120 },
    { metierId: metierPeintre.id, libelle: "Pose papier peint", description: "Pose ou dépose de papier peint", dureeEstimee: 180 },
    { metierId: metierPeintre.id, libelle: "Peinture extérieure", description: "Peinture de façade ou boiseries extérieures", dureeEstimee: 240 },
    { metierId: metierPeintre.id, libelle: "Enduit lissage", description: "Application d'enduit de lissage avant peinture", dureeEstimee: 120 },
  ] });

  const password = await bcrypt.hash("password123", 12);

  // === ADMIN ===
  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "System",
      passwordHash: password,
      activeProfile: "ADMIN",
    },
  });

  // === CLIENTS (compte + profil client) ===
  const clientUser1 = await prisma.user.create({
    data: {
      email: "contact@techcorp.fr",
      firstName: "Jean",
      lastName: "Dupont",
      passwordHash: password,
      activeProfile: "CLIENT",
      country: "France",
    },
  });
  const client1 = await prisma.clientProfile.create({
    data: {
      userId: clientUser1.id,
      companyName: "TechCorp SAS",
      companySector: "Tech",
      description: "Entreprise de services tech",
    },
  });

  const clientUser2 = await prisma.user.create({
    data: {
      email: "contact@webagency.fr",
      firstName: "Sarah",
      lastName: "Moreau",
      passwordHash: password,
      activeProfile: "CLIENT",
      country: "France",
    },
  });
  const client2 = await prisma.clientProfile.create({
    data: {
      userId: clientUser2.id,
      companyName: "WebAgency",
      companySector: "Design",
      description: "Agence web spécialisée en design",
    },
  });

  // === FREELANCERS (compte + profil freelance) ===
  const f1User = await prisma.user.create({
    data: {
      email: "marie@example.com",
      firstName: "Marie",
      lastName: "Dupont",
      passwordHash: password,
      activeProfile: "FREELANCER",
      country: "France",
    },
  });
  const freelancer1 = await prisma.freelancerProfile.create({
    data: {
      userId: f1User.id,
      title: "Développeuse Fullstack",
      bio: "Développeuse passionnée avec 8 ans d'expérience en React, Node.js et architecture cloud.",
      skills: ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker"],
      hourlyRate: 450,
      availability: "full-time",
      location: "Paris",
      portfolio: "https://marieductont.dev",
      isValidated: true,
    },
  });

  const f2User = await prisma.user.create({
    data: {
      email: "lucas@example.com",
      firstName: "Lucas",
      lastName: "Petit",
      passwordHash: password,
      activeProfile: "FREELANCER",
      country: "France",
    },
  });
  const freelancer2 = await prisma.freelancerProfile.create({
    data: {
      userId: f2User.id,
      title: "DevOps Engineer",
      bio: "Ingénieur DevOps certifié AWS. J'accompagne les équipes dans la mise en place d'infrastructures scalables.",
      skills: ["Docker", "Kubernetes", "AWS", "CI/CD", "Terraform"],
      hourlyRate: 500,
      availability: "full-time",
      location: "Lyon",
      isValidated: true,
    },
  });

  const f3User = await prisma.user.create({
    data: {
      email: "sophie@example.com",
      firstName: "Sophie",
      lastName: "Bernard",
      passwordHash: password,
      activeProfile: "FREELANCER",
      country: "France",
    },
  });
  const freelancer3 = await prisma.freelancerProfile.create({
    data: {
      userId: f3User.id,
      title: "Data Scientist",
      bio: "Data scientist avec un PhD en Machine Learning. Experte en NLP et analyse prédictive.",
      skills: ["Python", "TensorFlow", "SQL", "PyTorch", "ML"],
      hourlyRate: 550,
      availability: "part-time",
      location: "Remote",
      isValidated: true,
    },
  });

  const f4User = await prisma.user.create({
    data: {
      email: "thomas@example.com",
      firstName: "Thomas",
      lastName: "Martin",
      passwordHash: password,
      activeProfile: "FREELANCER",
      country: "France",
    },
  });
  const freelancer4 = await prisma.freelancerProfile.create({
    data: {
      userId: f4User.id,
      title: "Designer UI/UX",
      bio: "Designer UI/UX depuis 6 ans. Création d'expériences utilisateur mémorables.",
      skills: ["Figma", "Sketch", "Adobe XD", "Design System", "Prototypage"],
      hourlyRate: 350,
      availability: "full-time",
      location: "Bordeaux",
      isValidated: true,
    },
  });

  // === Utilisateur avec les DEUX profils (exemple multi-profil) ===
  const dualUser = await prisma.user.create({
    data: {
      email: "dual@example.com",
      firstName: "Alex",
      lastName: "Dubois",
      passwordHash: password,
      activeProfile: "FREELANCER",
      country: "Belgique",
    },
  });
  await prisma.freelancerProfile.create({
    data: {
      userId: dualUser.id,
      title: "Développeur Mobile",
      bio: "Développeur React Native et Flutter",
      skills: ["React Native", "Flutter", "TypeScript", "Firebase"],
      hourlyRate: 400,
      availability: "part-time",
      location: "Bruxelles",
      isValidated: true,
    },
  });
  await prisma.clientProfile.create({
    data: {
      userId: dualUser.id,
      companyName: "Alex Dev SARL",
      companySector: "Tech",
      description: "Agence de développement mobile",
    },
  });

  // === USER ROLES (assignation des rôles à chaque utilisateur) ===
  await prisma.userRole.createMany({ data: [
    { userId: admin.id, roleId: roleAdmin.id },
    { userId: admin.id, roleId: roleClient.id },
    { userId: clientUser1.id, roleId: roleClient.id },
    { userId: clientUser2.id, roleId: roleClient.id },
    { userId: f1User.id, roleId: rolePrestataire.id },
    { userId: f2User.id, roleId: rolePrestataire.id },
    { userId: f3User.id, roleId: rolePrestataire.id },
    { userId: f4User.id, roleId: rolePrestataire.id },
    { userId: dualUser.id, roleId: rolePrestataire.id },
    { userId: dualUser.id, roleId: roleClient.id },
  ] });

  // === EXEMPLE PRESTATAIRE SERVICES À DOMICILE ===
  // Création d'un prestataire plombier avec ses services, zones et disponibilités
  const plombierUser = await prisma.user.create({
    data: {
      email: "plombier@example.com",
      firstName: "David",
      lastName: "Kamga",
      phone: "+237691234567",
      passwordHash: password,
      activeProfile: "FREELANCER",
      country: "Cameroun",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=plombier",
    },
  });

  // Adresse du plombier
  const adressePlombier = await prisma.adresse.create({
    data: {
      userId: plombierUser.id,
      intitule: "Domicile",
      pays: "Cameroun",
      ville: "Douala",
      arrondissement: "Douala 3",
      quartier: "Bonabéri",
      adresseDetaillee: "Rue 1234, Quartier Bonabéri",
      estPrincipale: true,
    },
  });

  // Vérification d'identité (validée)
  await prisma.verificationIdentite.create({
    data: {
      userId: plombierUser.id,
      pieceType: "CARTE_NATIONALE",
      numeroPiece: "CNI-123456789",
      photoRecto: "/uploads/identite/recto.jpg",
      photoVerso: "/uploads/identite/verso.jpg",
      statut: "VALIDE",
      dateTraitement: new Date(),
    },
  });

  // Assignation du rôle prestataire
  await prisma.userRole.create({ data: { userId: plombierUser.id, roleId: rolePrestataire.id } });
  // On lui donne aussi le rôle client (il peut aussi commander)
  await prisma.userRole.create({ data: { userId: plombierUser.id, roleId: roleClient.id } });

  // Métier plombier avec validation
  const prestatairePlombier = await prisma.prestataireMetier.create({
    data: {
      userId: plombierUser.id,
      metierId: metierPlombier.id,
      experience: "PLUS_DE_CINQ_ANS",
      description: "Plombier professionnel avec 7 ans d'expérience dans les installations et réparations domestiques. Disponible pour tous types de travaux de plomberie.",
      modeTarification: "PAR_PRESTATION",
      statutValidation: "VALIDE",
      dateValidation: new Date(),
    },
  });

  // Services proposés avec prix
  const servicesPlombier = await prisma.service.findMany({
    where: { metierId: metierPlombier.id },
  });
  for (const service of servicesPlombier) {
    const prix = service.libelle === "Réparation de fuite" ? 5000
      : service.libelle === "Installation robinet" ? 8000
      : service.libelle === "Débouchage canalisation" ? 7000
      : service.libelle === "Installation chauffe-eau" ? 25000
      : 10000;
    await prisma.prestataireService.create({
      data: {
        prestataireMetierId: prestatairePlombier.id,
        serviceId: service.id,
        prix,
      },
    });
  }

  // Zone d'intervention
  await prisma.zoneIntervention.create({
    data: {
      prestataireMetierId: prestatairePlombier.id,
      ville: "Douala",
      arrondissement: "Douala 3",
      quartier: "Bonabéri",
      rayonKm: 15,
    },
  });
  await prisma.zoneIntervention.create({
    data: {
      prestataireMetierId: prestatairePlombier.id,
      ville: "Douala",
      arrondissement: "Douala 1",
      rayonKm: 20,
    },
  });

  // Disponibilités
  await prisma.disponibilite.createMany({
    data: [
      { prestataireMetierId: prestatairePlombier.id, jourSemaine: "LUNDI", heureDebut: "08:00", heureFin: "18:00" },
      { prestataireMetierId: prestatairePlombier.id, jourSemaine: "MARDI", heureDebut: "08:00", heureFin: "18:00" },
      { prestataireMetierId: prestatairePlombier.id, jourSemaine: "MERCREDI", heureDebut: "08:00", heureFin: "18:00" },
      { prestataireMetierId: prestatairePlombier.id, jourSemaine: "JEUDI", heureDebut: "08:00", heureFin: "18:00" },
      { prestataireMetierId: prestatairePlombier.id, jourSemaine: "VENDREDI", heureDebut: "08:00", heureFin: "17:00" },
      { prestataireMetierId: prestatairePlombier.id, jourSemaine: "SAMEDI", heureDebut: "09:00", heureFin: "13:00" },
    ],
  });

  // === EXEMPLE DEMANDE DE SERVICE (client) ===
  // Création d'une demande de service "Réparation fuite" par un client
  const clientPlomberie = await prisma.user.create({
    data: {
      email: "client-service@example.com",
      firstName: "Paul",
      lastName: "Biyong",
      phone: "+237698765432",
      passwordHash: password,
      activeProfile: "CLIENT",
      country: "Cameroun",
    },
  });
  await prisma.userRole.create({ data: { userId: clientPlomberie.id, roleId: roleClient.id } });

  const adresseClient = await prisma.adresse.create({
    data: {
      userId: clientPlomberie.id,
      intitule: "Domicile",
      pays: "Cameroun",
      ville: "Douala",
      arrondissement: "Douala 2",
      quartier: "Akwa",
      adresseDetaillee: "Rue 5678, Akwa",
      estPrincipale: true,
    },
  });

  const serviceFuite = await prisma.service.findFirst({
    where: { libelle: "Réparation de fuite" },
  });

  if (serviceFuite) {
    await prisma.demande.create({
      data: {
        clientId: clientPlomberie.id,
        categorieId: catPlomberie.id,
        serviceId: serviceFuite.id,
        description: "Fuite importante sous l'évier de la cuisine. L'eau coule en continu depuis ce matin. Urgent !",
        adresseId: adresseClient.id,
        dateSouhaitee: new Date("2026-06-25"),
        heureSouhaitee: "14:00",
        budgetPropose: 7000,
        statut: "EN_ATTENTE",
      },
    });
  }

  // === MISSIONS ===
  const mission1 = await prisma.mission.create({
    data: {
      clientId: client1.id,
      title: "Développeur React/Next.js",
      description: "Nous recherchons un développeur React expérimenté pour travailler sur notre plateforme SaaS. Missions : développer de nouvelles fonctionnalités, optimiser les performances, et participer à l'architecture technique.",
      budget: 5000,
      currency: "EUR",
      skills: ["React", "Next.js", "TypeScript", "Tailwind"],
      duration: "3 mois",
      location: "Remote",
      status: "OPEN",
    },
  });

  const mission2 = await prisma.mission.create({
    data: {
      clientId: client1.id,
      title: "Designer UI/UX",
      description: "Création de l'interface utilisateur pour notre application mobile. Recherche designer créatif.",
      budget: 3000,
      currency: "EUR",
      skills: ["Figma", "UI Design", "Prototypage", "Design System"],
      duration: "1 mois",
      location: "Remote",
      status: "OPEN",
    },
  });

  const mission3 = await prisma.mission.create({
    data: {
      clientId: client2.id,
      title: "Rédacteur web SEO",
      description: "Recherche rédacteur pour produire du contenu optimisé SEO pour notre blog tech.",
      budget: 1500,
      currency: "EUR",
      skills: ["SEO", "Rédaction", "WordPress"],
      duration: "2 mois",
      location: "Remote",
      status: "OPEN",
    },
  });

  const mission4 = await prisma.mission.create({
    data: {
      clientId: client2.id,
      title: "DevOps Engineer",
      description: "Mise en place et maintenance de notre infrastructure cloud. Kubernetes, Docker, CI/CD.",
      budget: 6000,
      currency: "EUR",
      skills: ["Docker", "Kubernetes", "AWS", "CI/CD"],
      duration: "6 mois",
      location: "Remote",
      status: "IN_PROGRESS",
    },
  });

  // === APPLICATIONS ===
  await prisma.application.create({
    data: {
      freelancerId: freelancer1.id,
      missionId: mission1.id,
      coverLetter: "Bonjour, je suis très intéressée par cette mission. J'ai 5 ans d'expérience en React et Next.js.",
      proposedBudget: 4800,
      status: "PENDING",
    },
  });

  await prisma.application.create({
    data: {
      freelancerId: freelancer2.id,
      missionId: mission1.id,
      coverLetter: "Mission correspond parfaitement à mon profil. Disponible immédiatement.",
      proposedBudget: 5000,
      status: "PENDING",
    },
  });

  await prisma.application.create({
    data: {
      freelancerId: freelancer3.id,
      missionId: mission2.id,
      coverLetter: "Je postule avec enthousiasme. Designer spécialisée en UI/UX depuis 5 ans.",
      proposedBudget: 3200,
      status: "PENDING",
    },
  });

  await prisma.application.create({
    data: {
      freelancerId: freelancer4.id,
      missionId: mission2.id,
      coverLetter: "Designer passionné avec 6 ans d'expérience. Mon portfolio parle de lui-même.",
      proposedBudget: 3000,
      status: "PENDING",
    },
  });

  // === CONTRAT ===
  const contract = await prisma.contract.create({
    data: {
      missionId: mission4.id,
      freelancerId: freelancer2.id,
      startDate: new Date("2026-06-01"),
      status: "ACTIVE",
      escrowAmount: 6000,
      escrowId: "escrow_demo_001",
      milestones: {
        create: [
          {
            title: "Mise en place infrastructure",
            description: "Configuration serveurs et déploiement initial",
            amount: 2000,
            status: "APPROVED",
            dueDate: new Date("2026-06-20"),
          },
          {
            title: "CI/CD Pipeline",
            description: "Mise en place des pipelines d'intégration continue",
            amount: 2000,
            status: "IN_REVIEW",
            dueDate: new Date("2026-07-05"),
          },
          {
            title: "Documentation & Handover",
            description: "Documentation technique et transfert de connaissances",
            amount: 2000,
            status: "PENDING",
            dueDate: new Date("2026-07-20"),
          },
        ],
      },
    },
  });

  // === MESSAGES (entre utilisateurs, pas entre profils) ===
  await prisma.message.createMany({
    data: [
      { contractId: contract.id, senderId: clientUser2.id, receiverId: f2User.id, content: "Bonjour ! Prêt à démarrer la mission ?" },
      { contractId: contract.id, senderId: f2User.id, receiverId: clientUser2.id, content: "Bonjour ! Oui, tout est prêt. J'ai déjà commencé à préparer l'infrastructure." },
      { contractId: contract.id, senderId: clientUser2.id, receiverId: f2User.id, content: "Super, le premier milestone est validé !" },
    ],
  });

  // === PAIEMENTS (au niveau du compte utilisateur) ===
  await prisma.payment.createMany({
    data: [
      { userId: clientUser2.id, amount: 6000, currency: "EUR", type: "DEPOSIT", status: "SUCCEEDED", stripePaymentId: "pi_demo_001", trustEngineId: "escrow_demo_001" },
      { userId: f2User.id, amount: 2000, currency: "EUR", type: "RELEASE", status: "SUCCEEDED", trustEngineId: "escrow_demo_001" },
      { userId: f2User.id, amount: 1900, currency: "EUR", type: "PAYOUT", status: "SUCCEEDED", stripePaymentId: "po_demo_001" },
    ],
  });

  console.log("✅ Seed terminé !");
  console.log(`   👥 ${4} freelances · ${2} clients · ${1} multi-profil`);
  console.log(`   📋 ${4} missions · ${4} candidatures`);
  console.log(`   📝 ${1} contrat · ${3} milestones`);
  console.log(`   💬 ${3} messages · ${3} paiements`);
  console.log(`   🔑 Mot de passe pour tous : password123`);
  console.log(`   🏷️ Rôles: ADMIN, CLIENT, PRESTATAIRE`);
  console.log(`   📂 ${7} catégories · services par métier`);
  console.log(`   👷 1 prestataire (plombier) avec services, zone, disponibilités`);
  console.log(`   📄 1 demande de service (réparation fuite)`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
