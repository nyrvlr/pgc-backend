/**
 * response.service.ts
 * Orquestração de respostas e coordenação de rodada.
 *
 * submitPunishment exige que ambos tenham judgment antes de aceitar,
 * e aciona finalizeAttempt quando ambos concluem punishment.
 * acknowledgeResult delega para trial.service.acknowledgeResult.
 * Session.update é responsabilidade exclusiva de trial.service.acknowledgeResult.
 */

import { prisma } from '../config/prisma';
import { SessionBootstrapError } from './session.drafts';
import {
  recordJudgment,
  recordPunishment,
  finalizeAttempt,
  acknowledgeResult,
} from './trial.service';
import { getParticipantState } from './participant.service';

// ---------------------------------------------------------------------------
// Helper: localiza participante e valida attempt (para Attempt ativo)
// ---------------------------------------------------------------------------

async function resolveActive(accessToken: string, attemptId: string) {
  const sp = await prisma.sessionParticipant.findUnique({
    where: { accessToken },
    include: { session: { select: { status: true } } },
  });
  if (!sp) throw new SessionBootstrapError('Token inválido ou participante não encontrado.');

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, sessionId: true, globalNumber: true, completedAt: true },
  });
  if (!attempt) throw new SessionBootstrapError(`Attempt não encontrado: ${attemptId}`);
  if (attempt.sessionId !== sp.sessionId) {
    throw new SessionBootstrapError(`Attempt ${attemptId} não pertence à Session do participante.`);
  }

  return { sp, attempt };
}

async function getOwnResponse(attemptId: string, sessionParticipantId: string) {
  return prisma.response.findUnique({
    where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId } },
    select: { judgment: true, punishment: true, resultAcknowledgedAt: true },
  });
}

async function bothHaveField(
  sessionId: string,
  attemptId: string,
  field: 'judgment' | 'punishment',
): Promise<boolean> {
  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId }, select: { id: true },
  });
  for (const p of participants) {
    const r = await prisma.response.findUnique({
      where: { attemptId_sessionParticipantId: { attemptId, sessionParticipantId: p.id } },
      select: { [field]: true },
    });
    if (!r || !r[field]) return false;
  }
  return participants.length === 2;
}

/**
 * Retorna true se existe na sessão algum Attempt finalizado (com TrialRecord)
 * cujo resultado ainda não foi reconhecido pelos dois participantes.
 * Enquanto isso for verdade, novos judgments/punishments devem ser bloqueados.
 */
async function hasPendingResult(sessionId: string): Promise<boolean> {
  const pendingAck = await prisma.attempt.findFirst({
    where: {
      sessionId,
      completedAt: { not: null },
      trialRecord: { isNot: null },
      responses: { some: { resultAcknowledgedAt: null } },
    },
    select: { id: true },
  });
  return pendingAck !== null;
}

// ---------------------------------------------------------------------------
// submitJudgment
// ---------------------------------------------------------------------------

export async function submitJudgment(
  accessToken: string,
  attemptId: string,
  judgment: 'Just' | 'Unjust',
) {
  const { sp, attempt } = await resolveActive(accessToken, attemptId);

  // Idempotência pós-finalização: attempt já finalizado
  if (attempt.completedAt) {
    const existing = await getOwnResponse(attemptId, sp.id);
    if (existing?.judgment === judgment) return getParticipantState(accessToken);
    if (existing?.judgment) {
      throw new SessionBootstrapError(
        `Julgamento já registrado como "${existing.judgment}". Não é possível alterá-lo.`
      );
    }
    throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);
  }

  // Session deve estar IN_PROGRESS para Attempt ativo
  if (sp.session.status !== 'IN_PROGRESS') {
    throw new SessionBootstrapError(`Session não está IN_PROGRESS (status: ${sp.session.status}).`);
  }

  // Verificar que é o primeiro pendente (em ordem)
  const firstPending = await prisma.attempt.findFirst({
    where: { sessionId: sp.sessionId, completedAt: null },
    orderBy: { globalNumber: 'asc' },
    select: { id: true },
  });
  if (!firstPending || firstPending.id !== attemptId) {
    throw new SessionBootstrapError(
      `Attempt ${attemptId} não é o próximo a ser respondido.`
    );
  }

  // Barreira de resultado: bloquear enquanto tentativa anterior tiver ack pendente
  if (await hasPendingResult(sp.sessionId)) {
    throw new SessionBootstrapError(
      'Aguardando confirmação do resultado da tentativa anterior antes de avançar.'
    );
  }

  const existing = await getOwnResponse(attemptId, sp.id);
  if (existing?.judgment !== null && existing?.judgment !== undefined) {
    if (existing.judgment === judgment) return getParticipantState(accessToken);
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
  const { sp, attempt } = await resolveActive(accessToken, attemptId);

  // Idempotência pós-finalização
  if (attempt.completedAt) {
    const existing = await getOwnResponse(attemptId, sp.id);
    if (existing?.punishment === punishment) return getParticipantState(accessToken);
    if (existing?.punishment) {
      throw new SessionBootstrapError(
        `Decisão de punição já registrada como "${existing.punishment}". Não é possível alterá-la.`
      );
    }
    throw new SessionBootstrapError(`Attempt ${attemptId} já foi finalizado.`);
  }

  if (sp.session.status !== 'IN_PROGRESS') {
    throw new SessionBootstrapError(`Session não está IN_PROGRESS (status: ${sp.session.status}).`);
  }

  const firstPending = await prisma.attempt.findFirst({
    where: { sessionId: sp.sessionId, completedAt: null },
    orderBy: { globalNumber: 'asc' },
    select: { id: true },
  });
  if (!firstPending || firstPending.id !== attemptId) {
    throw new SessionBootstrapError(`Attempt ${attemptId} não é o próximo a ser respondido.`);
  }

  // Barreira de resultado: bloquear enquanto tentativa anterior tiver ack pendente
  if (await hasPendingResult(sp.sessionId)) {
    throw new SessionBootstrapError(
      'Aguardando confirmação do resultado da tentativa anterior antes de avançar.'
    );
  }

  // Ambos devem ter judgment antes de aceitar punishment
  const bothJudged = await bothHaveField(sp.sessionId, attemptId, 'judgment');
  if (!bothJudged) {
    throw new SessionBootstrapError(
      'Aguardando julgamento do parceiro antes de aceitar decisão de punição.'
    );
  }

  const existing = await getOwnResponse(attemptId, sp.id);
  if (existing?.punishment !== null && existing?.punishment !== undefined) {
    if (existing.punishment === punishment) {
      // Retry idempotente em attempt ativo: continua verificando coordenação
    } else {
      throw new SessionBootstrapError(
        `Decisão de punição já registrada como "${existing.punishment}". Não é possível alterá-la.`
      );
    }
  } else {
    await recordPunishment(attemptId, sp.id, punishment);
  }

  // Verificar se ambos concluíram punishment
  const bothPunished = await bothHaveField(sp.sessionId, attemptId, 'punishment');
  if (bothPunished) {
    await finalizeAttempt(attemptId);
  }

  return getParticipantState(accessToken);
}

// ---------------------------------------------------------------------------
// submitAcknowledge
// ---------------------------------------------------------------------------

export async function submitAcknowledge(
  accessToken: string,
  attemptId: string,
) {
  const { sp, attempt } = await resolveActive(accessToken, attemptId);

  // Deve ter trialRecord (attempt finalizado)
  if (!attempt.completedAt) {
    throw new SessionBootstrapError(`Attempt ${attemptId} ainda não foi finalizado.`);
  }

  await acknowledgeResult(attemptId, sp.id);
  return getParticipantState(accessToken);
}
