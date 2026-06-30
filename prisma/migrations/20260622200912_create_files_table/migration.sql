/*
  Warnings:

  - You are about to drop the column `cahierDesChargesUrl` on the `client_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `certificatUrl` on the `client_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "client_profiles" DROP COLUMN "cahierDesChargesUrl",
DROP COLUMN "certificatUrl";

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_path_key" ON "files"("path");

-- CreateIndex
CREATE INDEX "files_entityType_entityId_idx" ON "files"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "files_entityType_entityId_category_idx" ON "files"("entityType", "entityId", "category");

-- CreateIndex
CREATE INDEX "files_userId_idx" ON "files"("userId");
