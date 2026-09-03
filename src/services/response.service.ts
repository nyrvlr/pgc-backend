/**
 * response.service.ts
 * Camada de orquestração entre o accessToken do participante e os services
 * de persistência de respostas (recordJudgment / recordPunishment).
 *
 * Responsabilidades:
 *   - Localizar SessionParticipant pelo accessToken
 *   - Validar Session IN_PROGRESS
 *   - Validar que o attemptId pertence à mesma Session
 *   - Validar completedAt antes de buscar o primeiro pendente
 *   - Validar que é o primeiro Attempt não-finalizado (em ordem)
 *   - Idempotência: retry com mesmo valor não persiste novamente
 *   - Conflito: valor diferente ao já registrado → SessionBootstrapError (409)
 *   - Delegar persistência a trial.service sem duplicar lógica
 */

import { prisma } from '../config/prisma';
import { SessionBootstrapError } from './session.drafts';
import { recordJudgment, recordPunishment } from './trial.service';
import { getParticipantState } from './participant.service';

// ---------------------------------------------------------------------------
// Helper: resolve participante + attempt validado
// ---------------------------------------------------------------------------

async function resolveParticipantAndAttempt(
  accessToken: string,
  attemptId: string,
) {
  // 1. Localizar participante pelo token
  const sp = await prisma.sessionParticipant.findUnique({
    where: { accessToken },
    include: { session: { select: { status: true } } },
  });
  if (!sp) {
    throw new SessionBootstrapError('Token inválido ou participante não encontrado.');
  }

  // 2. Session deve estar IN_PROGRESS
  if (sp.session.status !== 'IN_PROGRESS') {
    throw new SessionBootstrapError(
      `Session não está IN_PROGRESS (status: ${sp.session.status}).`
    );
  }

  // 3. Carregar o Attempt e validar que pertence à mesma Session
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, sessionId: true, globalNumber: true, completedAt: true },
  });
  if (!attempt) {
    throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);
  }
  if (attempt.sessionId !== sp.sessionId) {
    throw new SessionBootstrapError(
      `Attempt ${attemptId} não pertence à Session do participante.`
    );
  }

  // 4. Attempt já finalizado — verificar antes de buscar firstPending
  //    (um attempt finalizado não aparece na busca completedAt:null,
  //     o que daria erro "fora de ordem" em vez de "já finalizado")
  if (attempt.completedAt) {
    throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);
  }

  // 5. Deve ser o primeiro Attempt ainda não finalizado (em ordem)
  const firstPending = await prisma.attempt.findFirst({
    where: { sessionId: sp.sessionId, completedAt: null },
    orderBy: { globalNumber: 'asc' },
    select: { id: true },
  });
  if (!firstPending || firstPending.id !== attemptId) {
    throw new SessionBootstrapError(
      `Attempt ${attemptId} não é o próximo a ser respondido. Responda as tentativas em ordem.`
    );
  }

  return { sp, attempt };
}

// ---------------------------------------------------------------------------
// submitJudgment
// ---------------------------------------------------------------------------

export async function submitJudgment(
  accessToken: string,
  attemptId: string,
  judgment: 'Just' | 'Unjust',
) {
  const { sp } = await resolveParticipantAndAttempt(accessToken, attemptId);

  // Verificar resposta existente para idempotência/conflito
  const existing = await prisma.response.findUnique({
    where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId: sp.id } },
    select: { judgment: true },
  });

  if (existing?.judgment !== null && existing?.judgment !== undefined) {
    if (existing.judgment === judgment) {
      // Retry idempotente — mesmo valor, não persiste novamente
      return getParticipantState(accessToken);
    }
    throw new SessionBootstrapError(
      `Julgamento já registrado como "${existing.judgment}". Não é possível alterá-lo.`
    );
  }

  await recordJudgment(attemptId, sp.id, judgment);
  return getParticipantState(accessToken);
}

// ---------------------------------------------------------------------------
// submitPunishment
// ---------------------------------------------------------------------------

export async function submitPunishment(
  accessToken: string,
  attemptId: string,
  punishment: 'Punish' | 'NoPunish',
) {
  const { sp } = await resolveParticipantAndAttempt(accessToken, attemptId);

  // Verificar resposta existente para idempotência/conflito
  const existing = await prisma.response.findUnique({
    where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId: sp.id } },
    select: { punishment: true },
  });

  if (existing?.punishment !== null && existing?.punishment !== undefined) {
    if (existing.punishment === punishment) {
      // Retry idempotente — mesmo valor, não persiste novamente
      return getParticipantState(accessToken);
    }
    throw new SessionBootstrapError(
      `Decisão de punição já registrada como "${existing.punishment}". Não é possível alterá-la.`
    );
  }

  await recordPunishment(attemptId, sp.id, punishment);
  return getParticipantState(accessToken);
}
