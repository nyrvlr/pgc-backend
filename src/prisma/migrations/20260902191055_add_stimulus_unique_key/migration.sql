/*
  Warnings:

  - A unique constraint covering the columns `[distributor_character,distributor_distribution,receptor_distribution]` on the table `stimuli` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "stimuli_distributor_character_distributor_distribution_rece_key" ON "stimuli"("distributor_character", "distributor_distribution", "receptor_distribution");
