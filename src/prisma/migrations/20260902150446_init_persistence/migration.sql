-- CreateEnum
CREATE TYPE "SequenceVariant" AS ENUM ('ABAC', 'ACAB', 'BCBC', 'CBCB');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "Culturant" AS ENUM ('Bp', 'Bnp', 'Cp', 'Cnp', 'D');

-- CreateEnum
CREATE TYPE "JudgmentResponse" AS ENUM ('Just', 'Unjust');

-- CreateEnum
CREATE TYPE "PunishmentDecision" AS ENUM ('Punish', 'NoPunish');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ParticipantSlot" AS ENUM ('P1', 'P2');

-- CreateTable
CREATE TABLE "researchers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "researchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stimuli" (
    "id" TEXT NOT NULL,
    "endowment" INTEGER NOT NULL,
    "distributor_distribution" INTEGER NOT NULL,
    "receptor_distribution" INTEGER NOT NULL,
    "distributor_character" TEXT NOT NULL,
    "receptor_character" TEXT NOT NULL,

    CONSTRAINT "stimuli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_templates" (
    "id" TEXT NOT NULL,
    "sequence_variant" "SequenceVariant" NOT NULL,
    "block_number" INTEGER NOT NULL,
    "trial_in_block" INTEGER NOT NULL,
    "stimulus_id" TEXT NOT NULL,

    CONSTRAINT "trial_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence_variant" "SequenceVariant" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'WAITING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "slot" "ParticipantSlot" NOT NULL,
    "display_name" TEXT NOT NULL,
    "participant_code" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "session_sequence_variant" "SequenceVariant" NOT NULL,
    "global_number" INTEGER NOT NULL,
    "block_number" INTEGER NOT NULL,
    "trial_in_block" INTEGER NOT NULL,
    "condition" "Condition" NOT NULL,
    "trial_template_id" TEXT NOT NULL,
    "endowment" INTEGER NOT NULL,
    "distributor_distribution" INTEGER NOT NULL,
    "receptor_distribution" INTEGER NOT NULL,
    "distributor_character" TEXT NOT NULL,
    "receptor_character" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "session_participant_id" TEXT NOT NULL,
    "judgment" "JudgmentResponse",
    "judgment_at" TIMESTAMP(3),
    "punishment" "PunishmentDecision",
    "punishment_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_records" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "consensus" BOOLEAN NOT NULL,
    "culturant" "Culturant" NOT NULL,
    "p1_individual_cost" INTEGER NOT NULL,
    "p2_individual_cost" INTEGER NOT NULL,
    "punishment_applied" BOOLEAN NOT NULL,
    "distributor_final" INTEGER NOT NULL,
    "distributor_lost" INTEGER NOT NULL,
    "cultural_consequence" INTEGER NOT NULL,
    "p1_coins_after" INTEGER NOT NULL,
    "p2_coins_after" INTEGER NOT NULL,
    "group_coins_after" INTEGER NOT NULL,
    "disagreement_count_after" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "researchers_email_key" ON "researchers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "trial_templates_sequence_variant_block_number_trial_in_bloc_key" ON "trial_templates"("sequence_variant", "block_number", "trial_in_block");

-- CreateIndex
CREATE UNIQUE INDEX "trial_templates_id_sequence_variant_block_number_trial_in_b_key" ON "trial_templates"("id", "sequence_variant", "block_number", "trial_in_block");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_id_sequence_variant_key" ON "sessions"("id", "sequence_variant");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_access_token_key" ON "session_participants"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_slot_key" ON "session_participants"("session_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_session_id_participant_code_key" ON "session_participants"("session_id", "participant_code");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_id_session_id_key" ON "session_participants"("id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_session_id_global_number_key" ON "attempts"("session_id", "global_number");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_session_id_block_number_trial_in_block_key" ON "attempts"("session_id", "block_number", "trial_in_block");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_id_session_id_key" ON "attempts"("id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "responses_attempt_id_session_participant_id_key" ON "responses"("attempt_id", "session_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "trial_records_attempt_id_key" ON "trial_records"("attempt_id");

-- AddForeignKey
ALTER TABLE "trial_templates" ADD CONSTRAINT "trial_templates_stimulus_id_fkey" FOREIGN KEY ("stimulus_id") REFERENCES "stimuli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_session_sequence_variant_fkey" FOREIGN KEY ("session_id", "session_sequence_variant") REFERENCES "sessions"("id", "sequence_variant") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_trial_template_id_session_sequence_variant_block__fkey" FOREIGN KEY ("trial_template_id", "session_sequence_variant", "block_number", "trial_in_block") REFERENCES "trial_templates"("id", "sequence_variant", "block_number", "trial_in_block") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_attempt_id_session_id_fkey" FOREIGN KEY ("attempt_id", "session_id") REFERENCES "attempts"("id", "session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_session_participant_id_session_id_fkey" FOREIGN KEY ("session_participant_id", "session_id") REFERENCES "session_participants"("id", "session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_records" ADD CONSTRAINT "trial_records_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
