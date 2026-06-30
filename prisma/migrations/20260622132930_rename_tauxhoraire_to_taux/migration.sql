/*
  Warnings:

  - You are about to drop the column `tauxHoraire` on the `prestataire_metiers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "prestataire_metiers" DROP COLUMN "tauxHoraire",
ADD COLUMN     "taux" DOUBLE PRECISION;
