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
import type { ParticipantStage, OwnResponse, PartnerStatus } from './participant.stage';

export type { ParticipantStage, OwnResponse, PartnerStatus };
export { deriveStage };

export type CurrentAttemptView = {
  id: string;
  endowment: number;
  distributorDistribution: number;
  receptorDistribution: number;
  distributorCharacter: string;
  receptorCharacter: string;
};

/** Dados do resultado observável — apenas consequências visíveis */
export type TrialResultView = {
  ownIndividualCost:    number;
  ownCoinsAfter:        number;
  punishmentApplied:    boolean;
  distributorResult:    { character: string; finalCoins: number; coinsLost: number } | null;
  culturalConsequence:  number;
  groupCoinsAfter:      number;
};

export type ParticipantStateResult = {
  participant: {
    id:              string;
    slot:            string;
    displayName:     string;
    participantCode: string;
    joinedAt:        Date | null;
    lastSeenAt:      Date | null;
    createdAt:       Date;
  };
  session: { id: string; name: string; status: string };
  stage:          ParticipantStage;
  currentAttempt: CurrentAttemptView | null;
  trialResult:    TrialResultView | null;
};

// ---------------------------------------------------------------------------
// Helper: carrega o attempt ativo e a resposta do próprio participante
// "Ativo" = sem completedAt E sem ambos os acks dados
// ---------------------------------------------------------------------------

async function loadActiveAttemptForParticipant(sessionId: string, participantId: string) {
  // Attempt ativo: ou sem completedAt (ainda não finalizado)
  // ou finalizado mas pelo menos um participante ainda não deu ack
  const attempt = await prisma.attempt.findFirst({
    where: {
      sessionId,
      OR: [
        { completedAt: null },
        {
          completedAt: { not: null },
          trialRecord: { isNot: null },
          // tem attempt finalizado onde nem todos deram ack
          responses: {
            some: { resultAcknowledgedAt: null },
          },
        },
      ],
    },
    orderBy: { globalNumber: 'asc' },
    select: {
      id: true,
      endowment: true,
      distributorDistribution: true,
      receptorDistribution: true,
      distributorCharacter: true,
      receptorCharacter: true,
      completedAt: true,
      trialRecord: {
        select: {
          p1IndividualCost: true,
          p2IndividualCost: true,
          p1CoinsAfter: true,
          p2CoinsAfter: true,
          punishmentApplied: true,
          distributorFinal: true,
          distributorLost: true,
          culturalConsequence: true,
          groupCoinsAfter: true,
        },
      },
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

  return attempt;
}

// ---------------------------------------------------------------------------
// getParticipantState
// ---------------------------------------------------------------------------

export async function getParticipantState(accessToken: string): Promise<ParticipantStateResult> {
  const now = new Date();

  const sp = await prisma.sessionParticipant.findUnique({
    where: { accessToken },
    include: { session: { select: { id: true, name: true, status: true } } },
  });

  if (!sp) {
    throw new SessionBootstrapError('Token inválido ou participante não encontrado.');
  }

  // Atualizar joinedAt (só no primeiro acesso) e lastSeenAt (sempre)
  await prisma.sessionParticipant.update({
    where: { id: sp.id },
    data: { joinedAt: sp.joinedAt ?? now, lastSeenAt: now },
  });

  const sessionStatus = sp.session.status;

  if (sessionStatus === 'WAITING' || sessionStatus === 'COMPLETED') {
    const stage = deriveStage(sessionStatus, false, null, null, false);
    return {
      participant: {
        id: sp.id, slot: sp.slot, displayName: sp.displayName,
        participantCode: sp.participantCode,
        joinedAt: sp.joinedAt ?? now, lastSeenAt: now, createdAt: sp.createdAt,
      },
      session: { id: sp.session.id, name: sp.session.name, status: sessionStatus },
      stage,
      currentAttempt: null,
      trialResult:    null,
    };
  }

  // IN_PROGRESS: carregar attempt ativo
  const attempt = await loadActiveAttemptForParticipant(sp.sessionId, sp.id);

  let currentAttempt: CurrentAttemptView | null = null;
  let trialResult:    TrialResultView | null    = null;
  let ownResponse:    OwnResponse               = null;
  let partnerStatus:  PartnerStatus | null      = null;

  if (attempt) {
    currentAttempt = {
      id:                      attempt.id,
      endowment:               attempt.endowment,
      distributorDistribution: attempt.distributorDistribution,
      receptorDistribution:    attempt.receptorDistribution,
      distributorCharacter:    attempt.distributorCharacter,
      receptorCharacter:       attempt.receptorCharacter,
    };

    // Resposta do próprio participante
    type RawResponse = typeof attempt.responses[number];
    const ownRaw = attempt.responses.find((r: RawResponse) => r.sessionParticipantId === sp.id);
    ownResponse = ownRaw
      ? { judgment: ownRaw.judgment, punishment: ownRaw.punishment,
          resultAcknowledgedAt: ownRaw.resultAcknowledgedAt }
      : null;

    // Status do parceiro (o outro slot)
    const partnerRaw = attempt.responses.find((r: RawResponse) => r.sessionParticipantId !== sp.id);
    partnerStatus = {
      hasJudgment:   !!(partnerRaw?.judgment),
      hasPunishment: !!(partnerRaw?.punishment),
      hasAck:        !!(partnerRaw?.resultAcknowledgedAt),
    };

    // Resultado observável (apenas se attempt já foi finalizado com TrialRecord)
    const attemptFinalized = !!(attempt.trialRecord && attempt.completedAt);
    if (attempt.trialRecord && attempt.completedAt) {
      const tr = attempt.trialRecord;
      const isP1 = sp.slot === 'P1';
      const ownCost   = isP1 ? tr.p1IndividualCost : tr.p2IndividualCost;
      const ownCoins  = isP1 ? tr.p1CoinsAfter     : tr.p2CoinsAfter;
      trialResult = {
        ownIndividualCost:   ownCost,
        ownCoinsAfter:       ownCoins,
        punishmentApplied:   tr.punishmentApplied,
        distributorResult:   tr.punishmentApplied
          ? { character: attempt.distributorCharacter,
              finalCoins: tr.distributorFinal,
              coinsLost:  tr.distributorLost }
          : null,
        culturalConsequence: tr.culturalConsequence,
        groupCoinsAfter:     tr.groupCoinsAfter,
      };
    }
  }

  const stage = deriveStage(sessionStatus, attempt !== null, ownResponse, partnerStatus, attempt ? !!(attempt.trialRecord && attempt.completedAt) : false);

  return {
    participant: {
      id: sp.id, slot: sp.slot, displayName: sp.displayName,
      participantCode: sp.participantCode,
      joinedAt: sp.joinedAt ?? now, lastSeenAt: now, createdAt: sp.createdAt,
    },
    session: { id: sp.session.id, name: sp.session.name, status: sessionStatus },
    stage,
    currentAttempt,
    trialResult,
  };
}
