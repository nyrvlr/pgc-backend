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
