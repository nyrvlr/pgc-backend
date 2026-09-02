/**
 * session.service.ts
 * Bootstrap persistente de sessões experimentais.
 *
 * Responsabilidades:
 *   createSession     — cria Session WAITING
 *   addParticipant    — adiciona SessionParticipant (P1 ou P2)
 *   startSession      — transição WAITING → IN_PROGRESS + cria 64 Attempts
 *
 * Não implementa: API, auth, Socket.IO, Response, TrialRecord, resolveTrial.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { type SequenceVariant } from '../domain/experiment.types';
import { buildAttemptDrafts, SessionBootstrapError } from './session.drafts';

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
  slot: 'P1' | 'P2',
  displayName: string,
  participantCode: string,
) {
  return prisma.sessionParticipant.create({
    data: { sessionId, slot, displayName, participantCode },
  });
}

// ---------------------------------------------------------------------------
// startSession
// ---------------------------------------------------------------------------

/**
 * Transição WAITING → IN_PROGRESS em transação atômica.
 *
 * Garante:
 * 1. Session existe e está WAITING
 * 2. Exatamente P1 e P2 presentes
 * 3. 64 TrialTemplates carregados com Stimulus
 * 4. 4 blocos × 16 (validado por buildAttemptDrafts)
 * 5. 64 Attempts criados com snapshot completo
 * 6. Session atualizada para IN_PROGRESS + startedAt = now
 *
 * Se qualquer etapa falhar, a transação é revertida e nenhum Attempt persiste.
 */
export async function startSession(sessionId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Carregar Session e validar status
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new SessionBootstrapError(`Session não encontrada: ${sessionId}`);
    }
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

    // 4 + 5. Gerar drafts (valida blocos internamente) e criar Attempts
    const drafts = buildAttemptDrafts(sessionId, session.sequenceVariant, templates);

    await tx.attempt.createMany({ data: drafts });

    // 6. Atualizar Session para IN_PROGRESS
    return tx.session.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  });
}
