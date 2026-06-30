-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "cahierDesChargesUrl" TEXT,
ADD COLUMN     "certificatUrl" TEXT,
ADD COLUMN     "competencesLibres" TEXT[],
ADD COLUMN     "competencesRequisesIds" TEXT[],
ADD COLUMN     "departement" TEXT,
ADD COLUMN     "domaineInterventionId" TEXT,
ADD COLUMN     "domaineInterventionPerso" TEXT,
ADD COLUMN     "experienceRequise" TEXT,
ADD COLUMN     "modeTarification" TEXT,
ADD COLUMN     "paysIntervention" TEXT,
ADD COLUMN     "servicePerso" TEXT,
ADD COLUMN     "servicesIds" TEXT[],
ADD COLUMN     "tauxMax" DOUBLE PRECISION,
ADD COLUMN     "villeIntervention" TEXT;

-- CreateIndex
CREATE INDEX "client_profiles_domaineInterventionId_idx" ON "client_profiles"("domaineInterventionId");

-- CreateIndex
CREATE INDEX "client_profiles_paysIntervention_idx" ON "client_profiles"("paysIntervention");
