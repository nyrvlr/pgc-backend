/**
 * participant.service.ts
 * Acesso e estado do participante por accessToken.
 *
 * Não expõe: sequenceVariant, condition, bloco, número/total de rodadas,
 * respostas do parceiro ou accessToken de qualquer participante.
 */

import { prisma } from '../config/prisma';
import { SessionBootstrapError } from './session.drafts';
import { deriveStage } from './participant.stage';
import type { ParticipantStage, OwnResponse } from './participant.stage';

export type { ParticipantStage, OwnResponse };
export { deriveStage };

export type CurrentAttemptView = {
  id: string;
  endowment: number;
  distributorDistribution: number;
  receptorDistribution: number;
  distributorCharacter: string;
  receptorCharacter: string;
};

export type ParticipantStateResult = {
  participant: {
    id: string;
    slot: string;
    displayName: string;
    participantCode: string;
    joinedAt: Date | null;
    lastSeenAt: Date | null;
    createdAt: Date;
  };
  session: {
    id: string;
    name: string;
    status: string;
  };
  stage: ParticipantStage;
  currentAttempt: CurrentAttemptView | null;
};

export async function getParticipantState(accessToken: string): Promise<ParticipantStateResult> {
  const now = new Date();

  const sp = await prisma.sessionParticipant.findUnique({
    where: { accessToken },
    include: {
      session: { select: { id: true, name: true, status: true } },
    },
  });

  if (!sp) {
    throw new SessionBootstrapError(`Token inválido ou participante não encontrado.`);
  }

  await prisma.sessionParticipant.update({
    where: { id: sp.id },
    data: {
      joinedAt:   sp.joinedAt ?? now,
      lastSeenAt: now,
    },
  });

  const sessionStatus = sp.session.status;
  let currentAttempt: CurrentAttemptView | null = null;
  let ownResponse: OwnResponse = null;

  if (sessionStatus === 'IN_PROGRESS') {
    const attempt = await prisma.attempt.findFirst({
      where:   { sessionId: sp.sessionId, completedAt: null },
      orderBy: { globalNumber: 'asc' },
      select: {
        id: true,
        endowment: true,
        distributorDistribution: true,
        receptorDistribution: true,
        distributorCharacter: true,
        receptorCharacter: true,
        responses: {
          where:  { sessionParticipantId: sp.id },
          select: { judgment: true, punishment: true },
          take: 1,
        },
      },
    });

    if (attempt) {
      currentAttempt = {
        id:                      attempt.id,
        endowment:               attempt.endowment,
        distributorDistribution: attempt.distributorDistribution,
        receptorDistribution:    attempt.receptorDistribution,
        distributorCharacter:    attempt.distributorCharacter,
        receptorCharacter:       attempt.receptorCharacter,
      };
      ownResponse = attempt.responses[0] ?? null;
    }
  }

  const stage = deriveStage(sessionStatus, currentAttempt !== null, ownResponse);

  return {
    participant: {
      id:              sp.id,
      slot:            sp.slot,
      displayName:     sp.displayName,
      participantCode: sp.participantCode,
      joinedAt:        sp.joinedAt ?? now,
      lastSeenAt:      now,
      createdAt:       sp.createdAt,
    },
    session: { id: sp.session.id, name: sp.session.name, status: sessionStatus },
    stage,
    currentAttempt,
  };
}
