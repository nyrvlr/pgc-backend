/**
 * trial.service.ts
 * Persistência de respostas e finalização de tentativas.
 *
 * Responsabilidades:
 *   recordJudgment   — upsert de Response com judgment + timestamp
 *   recordPunishment — upsert de Response com punishment + timestamp
 *   finalizeAttempt  — transação: resolve + persiste TrialRecord + completa Attempt
 *
 * Não implementa: API, Socket.IO, auth, marcação de Session como COMPLETED.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { SessionBootstrapError } from './session.drafts';
import { resolveTrialFromDb, type ResponseRow } from './trial.resolver';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Carrega o Attempt com sua Session e valida que está IN_PROGRESS */
async function loadAttemptInProgress(
  tx: Prisma.TransactionClient,
  attemptId: string,
) {
  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    include: { session: true },
  });
  if (!attempt) {
    throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);
  }
  if (attempt.session.status !== 'IN_PROGRESS') {
    throw new SessionBootstrapError(
      `Session ${attempt.sessionId} não está IN_PROGRESS (status: ${attempt.session.status}).`
    );
  }
  return attempt;
}

/** Valida que o SessionParticipant pertence à mesma Session que o Attempt */
async function loadParticipantInSession(
  tx: Prisma.TransactionClient,
  sessionParticipantId: string,
  sessionId: string,
) {
  const sp = await tx.sessionParticipant.findUnique({
    where: { id: sessionParticipantId },
  });
  if (!sp) {
    throw new SessionBootstrapError(`SessionParticipant não encontrado: ${sessionParticipantId}`);
  }
  if (sp.sessionId !== sessionId) {
    throw new SessionBootstrapError(
      `SessionParticipant ${sessionParticipantId} pertence à Session ${sp.sessionId}, não ${sessionId}.`
    );
  }
  return sp;
}

// ---------------------------------------------------------------------------
// recordJudgment
// ---------------------------------------------------------------------------

/**
 * Registra ou atualiza o julgamento de um participante para uma tentativa.
 * Cria o Response se não existir. Preenche Attempt.startedAt na primeira resposta.
 * Attempt finalizado (completedAt preenchido) não aceita novas respostas.
 */
export async function recordJudgment(
  attemptId: string,
  sessionParticipantId: string,
  judgment: 'Just' | 'Unjust',
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const attempt = await loadAttemptInProgress(tx, attemptId);
    if (attempt.completedAt) {
      throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);
    }

    const sp = await loadParticipantInSession(tx, sessionParticipantId, attempt.sessionId);
    const now = new Date();

    // Preenche startedAt na primeira resposta da tentativa
    if (!attempt.startedAt) {
      await tx.attempt.update({ where: { id: attemptId }, data: { startedAt: now } });
    }

    return tx.response.upsert({
      where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId } },
      update: { judgment, judgmentAt: now },
      create: {
        sessionId: attempt.sessionId,
        attemptId,
        sessionParticipantId,
        judgment,
        judgmentAt: now,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// recordPunishment
// ---------------------------------------------------------------------------

/**
 * Registra ou atualiza a decisão de punição de um participante.
 * Exige que o julgamento já esteja registrado.
 * Attempt finalizado não aceita novas respostas.
 */
export async function recordPunishment(
  attemptId: string,
  sessionParticipantId: string,
  punishment: 'Punish' | 'NoPunish',
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const attempt = await loadAttemptInProgress(tx, attemptId);
    if (attempt.completedAt) {
      throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);
    }

    await loadParticipantInSession(tx, sessionParticipantId, attempt.sessionId);
    const now = new Date();

    const existing = await tx.response.findUnique({
      where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId } },
    });
    if (!existing || !existing.judgment) {
      throw new SessionBootstrapError(
        `Participante ${sessionParticipantId} ainda não registrou julgamento para Attempt ${attemptId}.`
      );
    }

    return tx.response.update({
      where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId } },
      data: { punishment, punishmentAt: now },
    });
  });
}

// ---------------------------------------------------------------------------
// finalizeAttempt
// ---------------------------------------------------------------------------

/**
 * Finaliza uma tentativa em transação atômica:
 * 1. Retorna TrialRecord existente se já finalizado (idempotente)
 * 2. Exige respostas completas de P1 e P2
 * 3. Para globalNumber > 1, exige TrialRecord da tentativa anterior
 * 4. Chama resolveTrial() via resolveTrialFromDb()
 * 5. Persiste TrialRecord e Attempt.completedAt
 */
export async function finalizeAttempt(attemptId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const attempt = await tx.attempt.findUnique({
      where: { id: attemptId },
      include: { session: true, trialRecord: true },
    });
    if (!attempt) {
      throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);
    }

    // 1. Idempotente: retorna o record existente se já finalizado
    if (attempt.trialRecord) {
      return attempt.trialRecord;
    }

    if (attempt.session.status !== 'IN_PROGRESS') {
      throw new SessionBootstrapError(
        `Session ${attempt.sessionId} não está IN_PROGRESS (status: ${attempt.session.status}).`
      );
    }

    // 2. Carregar respostas com slot via sessionParticipant
    const rawResponses = await tx.response.findMany({
      where: { attemptId },
      include: { sessionParticipant: { select: { slot: true } } },
    });
    const responses: ResponseRow[] = rawResponses.map((r: {
      sessionParticipant: { slot: string };
      judgment: string | null;
      punishment: string | null;
    }) => ({
      slot: r.sessionParticipant.slot as 'P1' | 'P2',
      judgment: r.judgment as 'Just' | 'Unjust' | null,
      punishment: r.punishment as 'Punish' | 'NoPunish' | null,
    }));

    // 3. Para globalNumber > 1, exigir TrialRecord da tentativa anterior
    let previousRecord = null;
    if (attempt.globalNumber > 1) {
      const prevAttempt = await tx.attempt.findUnique({
        where: {
          sessionId_globalNumber: {
            sessionId: attempt.sessionId,
            globalNumber: attempt.globalNumber - 1,
          },
        },
        include: { trialRecord: true },
      });
      if (!prevAttempt?.trialRecord) {
        throw new SessionBootstrapError(
          `Tentativa ${attempt.globalNumber - 1} ainda não foi finalizada. ` +
          `Finalize as tentativas em ordem.`
        );
      }
      previousRecord = prevAttempt.trialRecord;
    }

    // 4–6. Reconstrói stimulus + state e chama resolveTrial()
    const recordData = resolveTrialFromDb(
      {
        globalNumber: attempt.globalNumber,
        condition: attempt.condition as import('../domain/experiment.types').Condition,
        endowment: attempt.endowment,
        distributorDistribution: attempt.distributorDistribution,
        receptorDistribution: attempt.receptorDistribution,
        distributorCharacter: attempt.distributorCharacter,
        receptorCharacter: attempt.receptorCharacter,
      },
      responses,
      previousRecord,
    );

    // 7. Persistir TrialRecord
    const trialRecord = await tx.trialRecord.create({
      data: {
        attemptId,
        consensus: recordData.consensus,
        culturant: recordData.culturant,
        p1IndividualCost: recordData.p1IndividualCost,
        p2IndividualCost: recordData.p2IndividualCost,
        punishmentApplied: recordData.punishmentApplied,
        distributorFinal: recordData.distributorFinal,
        distributorLost: recordData.distributorLost,
        culturalConsequence: recordData.culturalConsequence,
        p1CoinsAfter: recordData.p1CoinsAfter,
        p2CoinsAfter: recordData.p2CoinsAfter,
        groupCoinsAfter: recordData.groupCoinsAfter,
        disagreementCountAfter: recordData.disagreementCountAfter,
      },
    });

    // 8. Marcar Attempt como completado
    await tx.attempt.update({
      where: { id: attemptId },
      data: { completedAt: new Date() },
    });

    return trialRecord;
  });
}
