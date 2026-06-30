/*
  Warnings:

  - You are about to drop the column `availability` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `companySector` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `hourlyRate` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isValidated` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `portfolio` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `skills` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('FREELANCER', 'CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "TarificationMode" AS ENUM ('HORAIRE', 'JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL', 'PAR_PRESTATION');

-- CreateEnum
CREATE TYPE "DemandeStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'COMPLETEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "PieceType" AS ENUM ('CARTE_NATIONALE', 'PASSEPORT', 'PERMIS');

-- CreateEnum
CREATE TYPE "JourSemaine" AS ENUM ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('DEBUTANT', 'UN_A_TROIS_ANS', 'TROIS_A_CINQ_ANS', 'PLUS_DE_CINQ_ANS');

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_freelancerId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_freelancerId_fkey";

-- DropForeignKey
ALTER TABLE "missions" DROP CONSTRAINT "missions_clientId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "availability",
DROP COLUMN "bio",
DROP COLUMN "companyName",
DROP COLUMN "companySector",
DROP COLUMN "hourlyRate",
DROP COLUMN "isValidated",
DROP COLUMN "location",
DROP COLUMN "name",
DROP COLUMN "portfolio",
DROP COLUMN "role",
DROP COLUMN "skills",
DROP COLUMN "title",
ADD COLUMN     "activeProfile" "ProfileType" NOT NULL DEFAULT 'FREELANCER',
ADD COLUMN     "country" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerified" TIMESTAMP(3);

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "freelancer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "skills" TEXT[],
    "hourlyRate" DOUBLE PRECISION,
    "availability" TEXT,
    "portfolio" TEXT,
    "location" TEXT,
    "experience" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "companySector" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications_identite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pieceType" "PieceType" NOT NULL,
    "numeroPiece" TEXT NOT NULL,
    "photoRecto" TEXT NOT NULL,
    "photoVerso" TEXT,
    "selfieUrl" TEXT,
    "statut" "ValidationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateSoumission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTraitement" TIMESTAMP(3),
    "traiteParId" TEXT,
    "motifRejet" TEXT,

    CONSTRAINT "verifications_identite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metiers" (
    "id" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "metiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "metierId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "dureeEstimee" INTEGER,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestataire_metiers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metierId" TEXT NOT NULL,
    "experience" "ExperienceLevel",
    "description" TEXT,
    "modeTarification" "TarificationMode" NOT NULL DEFAULT 'PAR_PRESTATION',
    "tauxHoraire" DOUBLE PRECISION,
    "statutValidation" "ValidationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateValidation" TIMESTAMP(3),
    "valideParId" TEXT,
    "motifRejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestataire_metiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestataire_services" (
    "id" TEXT NOT NULL,
    "prestataireMetierId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "prix" DOUBLE PRECISION,
    "description" TEXT,

    CONSTRAINT "prestataire_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones_intervention" (
    "id" TEXT NOT NULL,
    "prestataireMetierId" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "arrondissement" TEXT,
    "quartier" TEXT,
    "rayonKm" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "zones_intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilites" (
    "id" TEXT NOT NULL,
    "prestataireMetierId" TEXT NOT NULL,
    "jourSemaine" "JourSemaine" NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "estDisponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "disponibilites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intitule" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Cameroun',
    "ville" TEXT NOT NULL,
    "arrondissement" TEXT,
    "quartier" TEXT,
    "adresseDetaillee" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "estPrincipale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categorieId" TEXT,
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "photos" TEXT[],
    "adresseId" TEXT,
    "dateSouhaitee" TIMESTAMP(3),
    "heureSouhaitee" TEXT,
    "budgetPropose" DOUBLE PRECISION,
    "statut" "DemandeStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "prestataireMetierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "estUtilise" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_profiles_userId_key" ON "freelancer_profiles"("userId");

-- CreateIndex
CREATE INDEX "freelancer_profiles_skills_idx" ON "freelancer_profiles"("skills");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "client_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_libelle_key" ON "roles"("libelle");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "verifications_identite_userId_idx" ON "verifications_identite"("userId");

-- CreateIndex
CREATE INDEX "verifications_identite_statut_idx" ON "verifications_identite"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "categories_libelle_key" ON "categories"("libelle");

-- CreateIndex
CREATE INDEX "metiers_categorieId_idx" ON "metiers"("categorieId");

-- CreateIndex
CREATE UNIQUE INDEX "metiers_categorieId_libelle_key" ON "metiers"("categorieId", "libelle");

-- CreateIndex
CREATE INDEX "services_metierId_idx" ON "services"("metierId");

-- CreateIndex
CREATE UNIQUE INDEX "services_metierId_libelle_key" ON "services"("metierId", "libelle");

-- CreateIndex
CREATE INDEX "prestataire_metiers_metierId_statutValidation_idx" ON "prestataire_metiers"("metierId", "statutValidation");

-- CreateIndex
CREATE UNIQUE INDEX "prestataire_metiers_userId_metierId_key" ON "prestataire_metiers"("userId", "metierId");

-- CreateIndex
CREATE INDEX "prestataire_services_serviceId_idx" ON "prestataire_services"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "prestataire_services_prestataireMetierId_serviceId_key" ON "prestataire_services"("prestataireMetierId", "serviceId");

-- CreateIndex
CREATE INDEX "zones_intervention_ville_quartier_idx" ON "zones_intervention"("ville", "quartier");

-- CreateIndex
CREATE INDEX "zones_intervention_prestataireMetierId_idx" ON "zones_intervention"("prestataireMetierId");

-- CreateIndex
CREATE INDEX "disponibilites_prestataireMetierId_jourSemaine_idx" ON "disponibilites"("prestataireMetierId", "jourSemaine");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilites_prestataireMetierId_jourSemaine_key" ON "disponibilites"("prestataireMetierId", "jourSemaine");

-- CreateIndex
CREATE INDEX "adresses_userId_idx" ON "adresses"("userId");

-- CreateIndex
CREATE INDEX "adresses_ville_quartier_idx" ON "adresses"("ville", "quartier");

-- CreateIndex
CREATE INDEX "demandes_serviceId_statut_idx" ON "demandes"("serviceId", "statut");

-- CreateIndex
CREATE INDEX "demandes_clientId_createdAt_idx" ON "demandes"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "demandes_prestataireMetierId_idx" ON "demandes"("prestataireMetierId");

-- CreateIndex
CREATE INDEX "otp_codes_userId_type_idx" ON "otp_codes"("userId", "type");

-- CreateIndex
CREATE INDEX "otp_codes_phone_code_idx" ON "otp_codes"("phone", "code");

-- CreateIndex
CREATE INDEX "missions_title_status_skills_idx" ON "missions"("title", "status", "skills");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_firstName_lastName_idx" ON "users"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications_identite" ADD CONSTRAINT "verifications_identite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metiers" ADD CONSTRAINT "metiers_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_metierId_fkey" FOREIGN KEY ("metierId") REFERENCES "metiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestataire_metiers" ADD CONSTRAINT "prestataire_metiers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestataire_metiers" ADD CONSTRAINT "prestataire_metiers_metierId_fkey" FOREIGN KEY ("metierId") REFERENCES "metiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestataire_services" ADD CONSTRAINT "prestataire_services_prestataireMetierId_fkey" FOREIGN KEY ("prestataireMetierId") REFERENCES "prestataire_metiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestataire_services" ADD CONSTRAINT "prestataire_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones_intervention" ADD CONSTRAINT "zones_intervention_prestataireMetierId_fkey" FOREIGN KEY ("prestataireMetierId") REFERENCES "prestataire_metiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites" ADD CONSTRAINT "disponibilites_prestataireMetierId_fkey" FOREIGN KEY ("prestataireMetierId") REFERENCES "prestataire_metiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adresses" ADD CONSTRAINT "adresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_adresseId_fkey" FOREIGN KEY ("adresseId") REFERENCES "adresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_prestataireMetierId_fkey" FOREIGN KEY ("prestataireMetierId") REFERENCES "prestataire_metiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "freelancer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "freelancer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_sessions" ADD CONSTRAINT "time_sessions_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "freelancer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
