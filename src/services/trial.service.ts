/**
 * trial.service.ts
 * Persistência de respostas e finalização de tentativas.
 *
 * finalizeAttempt é seguro para chamadas concorrentes:
 *   - idempotente se trialRecord já existir
 *   - P2002 → busca e retorna o TrialRecord criado pela outra transação
 *   - NÃO marca Session como COMPLETED (responsabilidade do acknowledge)
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { SessionBootstrapError } from './session.drafts';
import { resolveTrialFromDb, type ResponseRow } from './trial.resolver';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

async function loadAttemptInProgress(
  tx: Prisma.TransactionClient,
  attemptId: string,
) {
  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    include: { session: true },
  });
  if (!attempt) throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);
  if (attempt.session.status !== 'IN_PROGRESS') {
    throw new SessionBootstrapError(
      `Session ${attempt.sessionId} não está IN_PROGRESS (status: ${attempt.session.status}).`
    );
  }
  return attempt;
}

async function loadParticipantInSession(
  tx: Prisma.TransactionClient,
  sessionParticipantId: string,
  sessionId: string,
) {
  const sp = await tx.sessionParticipant.findUnique({ where: { id: sessionParticipantId } });
  if (!sp) throw new SessionBootstrapError(`SessionParticipant não encontrado: ${sessionParticipantId}`);
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

export async function recordJudgment(
  attemptId: string,
  sessionParticipantId: string,
  judgment: 'Just' | 'Unjust',
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const attempt = await loadAttemptInProgress(tx, attemptId);
    if (attempt.completedAt) throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);

    await loadParticipantInSession(tx, sessionParticipantId, attempt.sessionId);
    const now = new Date();

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

export async function recordPunishment(
  attemptId: string,
  sessionParticipantId: string,
  punishment: 'Punish' | 'NoPunish',
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const attempt = await loadAttemptInProgress(tx, attemptId);
    if (attempt.completedAt) throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);

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
// finalizeAttempt — seguro para concorrência, NÃO conclui Session
// ---------------------------------------------------------------------------

export async function finalizeAttempt(attemptId: string) {
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        include: { session: true, trialRecord: true },
      });
      if (!attempt) throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);

      // Idempotente
      if (attempt.trialRecord) return attempt.trialRecord;

      if (attempt.session.status !== 'IN_PROGRESS') {
        throw new SessionBootstrapError(
          `Session ${attempt.sessionId} não está IN_PROGRESS (status: ${attempt.session.status}).`
        );
      }

      const rawResponses = await tx.response.findMany({
        where: { attemptId },
        include: { sessionParticipant: { select: { slot: true } } },
      });
      const responses: ResponseRow[] = rawResponses.map((r: {
        sessionParticipant: { slot: string };
        judgment: string | null;
        punishment: string | null;
      }) => ({
        slot:       r.sessionParticipant.slot as 'P1' | 'P2',
        judgment:   r.judgment   as 'Just' | 'Unjust' | null,
        punishment: r.punishment as 'Punish' | 'NoPunish' | null,
      }));

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
            `Tentativa ${attempt.globalNumber - 1} ainda não foi finalizada.`
          );
        }
        previousRecord = prevAttempt.trialRecord;
      }

      const recordData = resolveTrialFromDb(
        {
          globalNumber: attempt.globalNumber,
          condition: attempt.condition as import('../domain/experiment.types').Condition,
          endowment: attempt.endowment,
          distributorDistribution: attempt.distributorDistribution,
          receptorDistribution:    attempt.receptorDistribution,
          distributorCharacter:    attempt.distributorCharacter,
          receptorCharacter:       attempt.receptorCharacter,
        },
        responses,
        previousRecord,
      );

      const trialRecord = await tx.trialRecord.create({
        data: {
          attemptId,
          consensus:            recordData.consensus,
          culturant:            recordData.culturant,
          p1IndividualCost:     recordData.p1IndividualCost,
          p2IndividualCost:     recordData.p2IndividualCost,
          punishmentApplied:    recordData.punishmentApplied,
          distributorFinal:     recordData.distributorFinal,
          distributorLost:      recordData.distributorLost,
          culturalConsequence:  recordData.culturalConsequence,
          p1CoinsAfter:         recordData.p1CoinsAfter,
          p2CoinsAfter:         recordData.p2CoinsAfter,
          groupCoinsAfter:      recordData.groupCoinsAfter,
          disagreementCountAfter: recordData.disagreementCountAfter,
        },
      });

      await tx.attempt.update({
        where: { id: attemptId },
        data:  { completedAt: new Date() },
      });

      return trialRecord;
    });
  } catch (err) {
    // Race condition: outra transação criou o TrialRecord primeiro
    if (err !== null && typeof err === 'object' && 'code' in err &&
        (err as { code: string }).code === 'P2002') {
      const existing = await prisma.trialRecord.findUnique({ where: { attemptId } });
      if (existing) return existing;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// acknowledgeResult — registra que o participante viu o resultado
// ---------------------------------------------------------------------------

/**
 * Registra o ack do participante de forma atômica e segura para concorrência.
 *
 * Toda a lógica roda dentro de uma única transação Serializable:
 *   1. Validar que o Attempt existe e está finalizado
 *   2. Validar que a Response existe
 *   3. Gravar resultAcknowledgedAt (idempotente: não retorna cedo se já existir)
 *   4. Verificar se ambos os participantes já deram ack
 *   5. Se sim e globalNumber === 64: marcar Session como COMPLETED
 *
 * P2034 (serialization failure) dispara retry automático (máx 3 tentativas).
 * Duas confirmações simultâneas nunca deixam a Session em IN_PROGRESS.
 */
export async function acknowledgeResult(
  attemptId: string,
  sessionParticipantId: string,
): Promise<void> {
  const MAX_RETRIES = 3;

  for (let n = 0; n < MAX_RETRIES; n++) {
    try {
      await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // 1. Validar Attempt (dentro da transação = snapshot consistente)
          const attempt = await tx.attempt.findUnique({
            where: { id: attemptId },
            select: {
              globalNumber: true,
              sessionId:    true,
              completedAt:  true,
              trialRecord:  { select: { id: true } },
            },
          });
          if (!attempt) {
            throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);
          }
          if (!attempt.trialRecord || !attempt.completedAt) {
            throw new SessionBootstrapError(`Attempt ${attemptId} ainda não foi finalizado.`);
          }

          // 2. Validar que a Response existe
          const response = await tx.response.findUnique({
            where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId } },
            select: { resultAcknowledgedAt: true },
          });
          if (!response) {
            throw new SessionBootstrapError(
              `Resposta não encontrada para o participante ${sessionParticipantId}.`
            );
          }

          // 3. Gravar ack — idempotente: mesmo que já exista, continua para
          //    verificar se o parceiro também já deu ack (não retorna cedo)
          if (!response.resultAcknowledgedAt) {
            await tx.response.update({
              where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId } },
              data:  { resultAcknowledgedAt: new Date() },
            });
          }

          // 4. Verificar se ambos deram ack
          const allResponses = await tx.response.findMany({
            where:  { attemptId },
            select: { resultAcknowledgedAt: true },
          });
          const allAcked =
            allResponses.length === 2 &&
            allResponses.every(
              (r: { resultAcknowledgedAt: Date | null }) => r.resultAcknowledgedAt !== null,
            );

          if (!allAcked) return;

          // 5. Ambos deram ack — completar Session apenas no trial 64
          //    updateMany com filtro de status evita reescrever completedAt
          //    se a Session já estiver COMPLETED (retry idempotente)
          if (attempt.globalNumber === 64) {
            await tx.session.updateMany({
              where: { id: attempt.sessionId, status: 'IN_PROGRESS' },
              data:  { status: 'COMPLETED', completedAt: new Date() },
            });
          }
          // Trials 1–63: nenhuma ação adicional necessária
        },
        { isolationLevel: 'Serializable' },
      );
      return; // sucesso
    } catch (err) {
      // P2034 = serialization failure — retry automático
      const isP2034 =
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2034';

      if (isP2034 && n < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
}
