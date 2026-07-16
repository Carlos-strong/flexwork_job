/*
  Warnings:

  - A unique constraint covering the columns `[offerId]` on the table `contracts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `startDate` to the `contracts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('FIXED', 'HOURLY');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('FIXED', 'HOURLY');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewFormat" AS ENUM ('CHAT', 'VIDEO_CALL', 'PHONE', 'MEETING');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'UNREAD';
ALTER TYPE "ApplicationStatus" ADD VALUE 'READ';
ALTER TYPE "ApplicationStatus" ADD VALUE 'SHORTLISTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'DISCUSSION';
ALTER TYPE "ApplicationStatus" ADD VALUE 'INTERVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE 'OFFER_SENT';
ALTER TYPE "ApplicationStatus" ADD VALUE 'OFFER_ACCEPTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'OFFER_DECLINED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ARCHIVED';

-- DropForeignKey
ALTER TABLE "demandes" DROP CONSTRAINT "demandes_clientId_fkey";

-- DropForeignKey
ALTER TABLE "milestones" DROP CONSTRAINT "milestones_contractId_fkey";

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "proposedDays" INTEGER;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "clientSignedAt" TIMESTAMP(3),
ADD COLUMN     "contractType" "ContractType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "documentGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "documentHash" TEXT,
ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "freelancerSignedAt" TIMESTAMP(3),
ADD COLUMN     "fullySignedAt" TIMESTAMP(3),
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedByCertificateId" TEXT,
ADD COLUMN     "offerId" TEXT,
ADD COLUMN     "signedByCertificateId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "totalBudget" DOUBLE PRECISION,
ADD COLUMN     "weeklyHourLimit" INTEGER;

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "executionRate" DOUBLE PRECISION DEFAULT 100,
ADD COLUMN     "offerId" TEXT,
ADD COLUMN     "originalAmount" DOUBLE PRECISION,
ADD COLUMN     "originalDueDate" TIMESTAMP(3),
ADD COLUMN     "proofs" JSONB,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "contractId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "metierAutre" TEXT,
ADD COLUMN     "metierId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "virtualCardId" TEXT;

-- CreateTable
CREATE TABLE "digital_certificates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "keySalt" TEXT NOT NULL,
    "keyIv" TEXT NOT NULL,
    "keyAuthTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_signatures" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "signedDataHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signingMethod" TEXT NOT NULL DEFAULT 'RSA-SHA256',
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,

    CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_audit_entries" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "previousHash" TEXT,
    "currentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemSignature" TEXT,

    CONSTRAINT "contract_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "duration" INTEGER,
    "format" "InterviewFormat" NOT NULL DEFAULT 'CHAT',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "feedbackByClient" TEXT,
    "feedbackByFreelancer" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "offerType" "OfferType" NOT NULL DEFAULT 'FIXED',
    "totalBudget" DOUBLE PRECISION,
    "hourlyRate" DOUBLE PRECISION,
    "weeklyHourLimit" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "counteredAt" TIMESTAMP(3),
    "counterNote" TEXT,
    "negotiationRounds" INTEGER NOT NULL DEFAULT 0,
    "lastCounterBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus" NOT NULL,
    "toStatus" "ApplicationStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedByRole" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "cvv" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'Visa',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "isTestCard" BOOLEAN NOT NULL DEFAULT true,
    "usedInProduction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "virtual_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_card_transactions" (
    "id" TEXT NOT NULL,
    "virtualCardId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "contractId" TEXT,
    "missionTitle" TEXT,
    "description" TEXT,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digital_certificates_keyFingerprint_key" ON "digital_certificates"("keyFingerprint");

-- CreateIndex
CREATE INDEX "digital_certificates_userId_status_idx" ON "digital_certificates"("userId", "status");

-- CreateIndex
CREATE INDEX "digital_certificates_keyFingerprint_idx" ON "digital_certificates"("keyFingerprint");

-- CreateIndex
CREATE INDEX "contract_signatures_certificateId_idx" ON "contract_signatures"("certificateId");

-- CreateIndex
CREATE INDEX "contract_signatures_signedDataHash_idx" ON "contract_signatures"("signedDataHash");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signatures_contractId_certificateId_key" ON "contract_signatures"("contractId", "certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_audit_entries_currentHash_key" ON "contract_audit_entries"("currentHash");

-- CreateIndex
CREATE INDEX "contract_audit_entries_contractId_createdAt_idx" ON "contract_audit_entries"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "contract_audit_entries_currentHash_idx" ON "contract_audit_entries"("currentHash");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_applicationId_key" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_applicationId_idx" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_scheduledAt_idx" ON "interviews"("scheduledAt");

-- CreateIndex
CREATE INDEX "offers_applicationId_status_idx" ON "offers"("applicationId", "status");

-- CreateIndex
CREATE INDEX "offers_status_expiresAt_idx" ON "offers"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "application_status_history_applicationId_createdAt_idx" ON "application_status_history"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "application_status_history_applicationId_idx" ON "application_status_history"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "virtual_cards_cardNumber_key" ON "virtual_cards"("cardNumber");

-- CreateIndex
CREATE INDEX "virtual_cards_userId_idx" ON "virtual_cards"("userId");

-- CreateIndex
CREATE INDEX "virtual_cards_isTestCard_idx" ON "virtual_cards"("isTestCard");

-- CreateIndex
CREATE INDEX "virtual_card_transactions_virtualCardId_createdAt_idx" ON "virtual_card_transactions"("virtualCardId", "createdAt");

-- CreateIndex
CREATE INDEX "virtual_card_transactions_contractId_idx" ON "virtual_card_transactions"("contractId");

-- CreateIndex
CREATE INDEX "applications_status_missionId_idx" ON "applications"("status", "missionId");

-- CreateIndex
CREATE INDEX "applications_freelancerId_status_idx" ON "applications"("freelancerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_offerId_key" ON "contracts"("offerId");

-- CreateIndex
CREATE INDEX "contracts_status_createdAt_idx" ON "contracts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contracts_freelancerId_idx" ON "contracts"("freelancerId");

-- CreateIndex
CREATE INDEX "milestones_offerId_idx" ON "milestones"("offerId");

-- CreateIndex
CREATE INDEX "milestones_contractId_idx" ON "milestones"("contractId");

-- AddForeignKey
ALTER TABLE "digital_certificates" ADD CONSTRAINT "digital_certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "digital_certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_audit_entries" ADD CONSTRAINT "contract_audit_entries_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes" ADD CONSTRAINT "demandes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signedByCertificateId_fkey" FOREIGN KEY ("signedByCertificateId") REFERENCES "digital_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_virtualCardId_fkey" FOREIGN KEY ("virtualCardId") REFERENCES "virtual_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_cards" ADD CONSTRAINT "virtual_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "virtual_card_transactions" ADD CONSTRAINT "virtual_card_transactions_virtualCardId_fkey" FOREIGN KEY ("virtualCardId") REFERENCES "virtual_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
