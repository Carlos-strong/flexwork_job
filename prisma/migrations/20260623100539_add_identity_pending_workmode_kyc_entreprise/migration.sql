-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'ON_SITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FIXED', 'OPEN_QUOTE');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'IDENTITY_PENDING';

-- AlterTable
ALTER TABLE "client_profiles" ADD COLUMN     "companyVerificationStatus" "ValidationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
ADD COLUMN     "companyVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "companyVerifiedById" TEXT,
ADD COLUMN     "kbisUrl" TEXT,
ADD COLUMN     "ribUrl" TEXT,
ADD COLUMN     "siret" TEXT;

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "budgetType" "BudgetType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "hybridDaysPerWeek" INTEGER,
ADD COLUMN     "missionCity" TEXT,
ADD COLUMN     "missionCountry" TEXT,
ADD COLUMN     "workMode" "WorkMode" NOT NULL DEFAULT 'REMOTE',
ALTER COLUMN "budget" DROP NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'XAF';
