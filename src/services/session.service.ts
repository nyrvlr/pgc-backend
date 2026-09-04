/**
 * session.service.ts
 * Bootstrap persistente de sessões experimentais.
 *
 * Responsabilidades:
 *   createSession    — cria Session WAITING vinculada ao pesquisador autenticado
 *   addParticipant   — adiciona SessionParticipant (P1 ou P2), valida ownership
 *   startSession     — transição WAITING → IN_PROGRESS + cria 64 Attempts, valida ownership
 *   getSession       — retorna sessão com participantes e contagem, valida ownership
 *   listSessions     — lista sessões da pesquisadora autenticada
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { type SequenceVariant } from '../domain/experiment.types';
import { buildAttemptDrafts, SessionBootstrapError } from './session.drafts';
import { deriveStage } from './participant.stage';

// ---------------------------------------------------------------------------
// Helper: carrega e valida ownership de uma Session
// Retorna 404 (sem revelar existência) se não encontrada ou de outro pesquisador
// ---------------------------------------------------------------------------

async function loadOwnedSession(
  tx: Prisma.TransactionClient | typeof prisma,
  sessionId: string,
  researcherId: string,
) {
  const session = await (tx as typeof prisma).session.findUnique({
    where: { id: sessionId },
  });
  // Retorna o mesmo erro se não existe ou se pertence a outro — não revela existência
  if (!session || session.researcherId !== researcherId) {
    throw new SessionBootstrapError(`Session não encontrada: ${sessionId}`);
  }
  return session;
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

export async function createSession(
  researcherId: string,
  name: string,
  sequenceVariant: SequenceVariant,
) {
  return prisma.session.create({
    data: { researcherId, name, sequenceVariant },
  });
}

// ---------------------------------------------------------------------------
// addParticipant
// ---------------------------------------------------------------------------

export async function addParticipant(
  sessionId: string,
  researcherId: string,
  slot: 'P1' | 'P2',
  displayName: string,
  participantCode: string,
) {
  // Valida ownership antes de criar o participante
  await loadOwnedSession(prisma, sessionId, researcherId);

  return prisma.sessionParticipant.create({
    data: { sessionId, slot, displayName, participantCode },
  });
}

// ---------------------------------------------------------------------------
// startSession
// ---------------------------------------------------------------------------

export async function startSession(sessionId: string, researcherId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Carregar Session, validar existência e ownership
    const session = await loadOwnedSession(tx, sessionId, researcherId);

    if (session.status !== 'WAITING') {
      throw new SessionBootstrapError(
        `Session ${sessionId} não está em WAITING (status atual: ${session.status}).`
      );
    }

    // 2. Validar exatamente P1 e P2
    const participants = await tx.sessionParticipant.findMany({ where: { sessionId } });
    const slots = participants.map((p: { slot: string }) => p.slot).sort();
    if (slots.length !== 2 || slots[0] !== 'P1' || slots[1] !== 'P2') {
      throw new SessionBootstrapError(
        `Session ${sessionId} requer exatamente P1 e P2. Encontrado: [${slots.join(', ')}].`
      );
    }

    // 3. Carregar 64 TrialTemplates da variante com Stimulus incluído
    const templates = await tx.trialTemplate.findMany({
      where: { sequenceVariant: session.sequenceVariant },
      include: { stimulus: true },
    });

    // 4 + 5. Gerar drafts e criar Attempts
    const drafts = buildAttemptDrafts(sessionId, session.sequenceVariant, templates);
    await tx.attempt.createMany({ data: drafts });

    // 6. Atualizar Session para IN_PROGRESS
    return tx.session.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  });
}

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

export async function getSession(sessionId: string, researcherId: string) {
  // Valida ownership (sem revelar existência a outros pesquisadores)
  await loadOwnedSession(prisma, sessionId, researcherId);

  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        select: {
          id: true,
          slot: true,
          displayName: true,
          participantCode: true,
          joinedAt: true,
          lastSeenAt: true,
          createdAt: true,
          // accessToken excluído explicitamente
        },
      },
      _count: { select: { attempts: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

export async function listSessions(researcherId: string) {
  return prisma.session.findMany({
    where: { researcherId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      sequenceVariant: true,
      status: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { attempts: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// getSessionPanel
// ---------------------------------------------------------------------------

export async function getSessionPanel(sessionId: string, researcherId: string) {
  await loadOwnedSession(prisma, sessionId, researcherId);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true, name: true, sequenceVariant: true,
      status: true, startedAt: true, completedAt: true,
      participants: {
        select: {
          id: true, slot: true, displayName: true,
          participantCode: true, joinedAt: true, lastSeenAt: true,
          // accessToken excluído
        },
        orderBy: { slot: 'asc' },
      },
      attempts: {
        select: {
          completedAt: true,
          responses: {
            select: { resultAcknowledgedAt: true },
          },
        },
      },
    },
  });

  if (!session) throw new SessionBootstrapError(`Session não encontrada: ${sessionId}`);

  const sessionStatus = session.status;

  // Progresso dos attempts
  const totalAttempts = session.attempts.length;
  const finalizedAttempts = session.attempts.filter(
    (a: { completedAt: Date | null; responses: { resultAcknowledgedAt: Date | null }[] }) =>
      a.completedAt !== null
  ).length;
  const acknowledgedAttempts = session.attempts.filter(
    (a: { completedAt: Date | null; responses: { resultAcknowledgedAt: Date | null }[] }) =>
      a.responses.length === 2 &&
      a.responses.every((r: { resultAcknowledgedAt: Date | null }) => r.resultAcknowledgedAt !== null),
  ).length;

  // Attempt ativo: reutiliza o mesmo conceito de participant.service.ts (sem writes)
  // Busca apenas o necessário para derivar estágio e activeAttemptNumber
  type AttemptForPanel = {
    globalNumber: number;
    completedAt:  Date | null;
    trialRecord:  { id: string } | null;
    responses: {
      sessionParticipantId: string;
      judgment:             string | null;
      punishment:           string | null;
      resultAcknowledgedAt: Date | null;
    }[];
  };

  let activeAttempt: AttemptForPanel | null = null;

  if (sessionStatus === 'IN_PROGRESS') {
    activeAttempt = await prisma.attempt.findFirst({
      where: {
        sessionId,
        OR: [
          { completedAt: null },
          {
            completedAt: { not: null },
            trialRecord: { isNot: null },
            responses: { some: { resultAcknowledgedAt: null } },
          },
        ],
      },
      orderBy: { globalNumber: 'asc' },
      select: {
        globalNumber: true,
        completedAt:  true,
        trialRecord:  { select: { id: true } },
        responses: {
          select: {
            sessionParticipantId: true,
            judgment:             true,
            punishment:           true,
            resultAcknowledgedAt: true,
          },
        },
      },
    });
  }

  const activeAttemptNumber: number | null = activeAttempt?.globalNumber ?? null;
  const attemptFinalized = !!(activeAttempt?.trialRecord && activeAttempt?.completedAt);

  // Derivar estágio de cada participante usando deriveStage do domínio (sem writes)
  const participantsWithStage = session.participants.map(
    (sp: { id: string; slot: string; displayName: string; participantCode: string; joinedAt: Date | null; lastSeenAt: Date | null }) => {
      let stage: ReturnType<typeof deriveStage>;

      if (sessionStatus !== 'IN_PROGRESS') {
        // WAITING → WAITING_SESSION, COMPLETED → COMPLETED
        stage = deriveStage(sessionStatus, false, null, null, false);
      } else if (!activeAttempt) {
        // Sem attempt ativo: todas finalizadas com acks
        stage = deriveStage('IN_PROGRESS', false, null, null, false);
      } else {
        // Respostas deste participante no attempt ativo
        const ownRaw = activeAttempt.responses.find(r => r.sessionParticipantId === sp.id);
        const ownResponse = ownRaw
          ? { judgment: ownRaw.judgment, punishment: ownRaw.punishment,
              resultAcknowledgedAt: ownRaw.resultAcknowledgedAt }
          : null;

        // Status do parceiro (o outro participante no mesmo attempt)
        const partnerRaw = activeAttempt.responses.find(r => r.sessionParticipantId !== sp.id);
        const partnerStatus = {
          hasJudgment:   !!(partnerRaw?.judgment),
          hasPunishment: !!(partnerRaw?.punishment),
          hasAck:        !!(partnerRaw?.resultAcknowledgedAt),
        };

        stage = deriveStage('IN_PROGRESS', true, ownResponse, partnerStatus, attemptFinalized);
      }

      return {
        id:              sp.id,
        slot:            sp.slot,
        displayName:     sp.displayName,
        participantCode: sp.participantCode,
        joinedAt:        sp.joinedAt,
        lastSeenAt:      sp.lastSeenAt,
        stage,
      };
    }
  );

  return {
    session: {
      id: session.id, name: session.name,
      sequenceVariant: session.sequenceVariant, status: session.status,
      startedAt: session.startedAt, completedAt: session.completedAt,
    },
    participants: participantsWithStage,
    progress: { totalAttempts, finalizedAttempts, acknowledgedAttempts, activeAttemptNumber },
  };
}

// ---------------------------------------------------------------------------
// getParticipantAccess
// ---------------------------------------------------------------------------

export async function getParticipantAccess(sessionId: string, researcherId: string) {
  await loadOwnedSession(prisma, sessionId, researcherId);

  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId },
    select: {
      slot: true, displayName: true, participantCode: true, accessToken: true,
    },
    orderBy: { slot: 'asc' },
  });

  return participants;
}
