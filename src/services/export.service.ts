/**
 * export.service.ts
 * Constrói linhas ExportRow a partir do Prisma para exportação científica.
 *
 * Não serializa CSV nem chama rotas HTTP.
 * Não seleciona displayName, accessToken, email, passwordHash ou dados do pesquisador.
 */

import { prisma } from '../config/prisma';
import { SessionBootstrapError } from './session.drafts';
import type { ExportRow } from '../domain/export.contract';
import type {
  Condition,
  SequenceVariant,
  JudgmentResponse,
  PunishmentDecision,
  Culturant,
} from '../domain/experiment.types';

// ---------------------------------------------------------------------------
// Helpers de validação de union literals
// ---------------------------------------------------------------------------

function toIndividualCost(v: number): 0 | 1 {
  if (v === 0 || v === 1) return v;
  throw new SessionBootstrapError(
    `Valor inválido para individualCost: ${v}. Esperado 0 ou 1.`
  );
}

function toCulturalConsequence(v: number): 0 | 3 {
  if (v === 0 || v === 3) return v;
  throw new SessionBootstrapError(
    `Valor inválido para culturalConsequence: ${v}. Esperado 0 ou 3.`
  );
}

// ---------------------------------------------------------------------------
// buildExportRows
// ---------------------------------------------------------------------------

export async function buildExportRows(
  sessionId: string,
  researcherId: string,
): Promise<ExportRow[]> {
  // Valida ownership sem revelar existência
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id:              true,
      researcherId:    true,
      name:            true,
      sequenceVariant: true,
      status:          true,
    },
  });

  if (!session || session.researcherId !== researcherId) {
    throw new SessionBootstrapError(`Session não encontrada: ${sessionId}`);
  }

  // Buscar participantes — somente slot e participantCode (sem displayName, accessToken)
  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId },
    select: { id: true, slot: true, participantCode: true },
  });

  // Sessão ainda não iniciada (sem attempts)
  const attempts = await prisma.attempt.findMany({
    where: { sessionId },
    orderBy: { globalNumber: 'asc' },
    select: {
      id:                      true,
      globalNumber:            true,
      blockNumber:             true,
      trialInBlock:            true,
      condition:               true,
      endowment:               true,
      distributorCharacter:    true,
      receptorCharacter:       true,
      distributorDistribution: true,
      receptorDistribution:    true,
      startedAt:               true,
      completedAt:             true,
      responses: {
        select: {
          sessionParticipantId: true,
          judgment:             true,
          judgmentAt:           true,
          punishment:           true,
          punishmentAt:         true,
          resultAcknowledgedAt: true,
        },
      },
      trialRecord: {
        select: {
          consensus:             true,
          culturant:             true,
          p1IndividualCost:      true,
          p2IndividualCost:      true,
          punishmentApplied:     true,
          distributorFinal:      true,
          distributorLost:       true,
          culturalConsequence:   true,
          p1CoinsAfter:          true,
          p2CoinsAfter:          true,
          groupCoinsAfter:       true,
          disagreementCountAfter: true,
        },
      },
    },
  });

  if (attempts.length === 0) return [];

  // Validar P1 e P2
  type SpRow = { id: string; slot: string; participantCode: string };
  const p1 = (participants as SpRow[]).find(p => p.slot === 'P1');
  const p2 = (participants as SpRow[]).find(p => p.slot === 'P2');
  if (!p1 || !p2) {
    throw new SessionBootstrapError(
      `Session ${sessionId} não possui P1 e P2. Encontrado: [${(participants as SpRow[]).map(p => p.slot).join(', ')}].`
    );
  }

  type ResponseRow = {
    sessionParticipantId: string;
    judgment: string | null; judgmentAt: Date | null;
    punishment: string | null; punishmentAt: Date | null;
    resultAcknowledgedAt: Date | null;
  };
  type AttemptRow = {
    id: string; globalNumber: number; blockNumber: number; trialInBlock: number;
    condition: string; endowment: number;
    distributorCharacter: string; receptorCharacter: string;
    distributorDistribution: number; receptorDistribution: number;
    startedAt: Date | null; completedAt: Date | null;
    responses: ResponseRow[];
    trialRecord: {
      consensus: boolean; culturant: string;
      p1IndividualCost: number; p2IndividualCost: number;
      punishmentApplied: boolean;
      distributorFinal: number; distributorLost: number;
      culturalConsequence: number;
      p1CoinsAfter: number; p2CoinsAfter: number;
      groupCoinsAfter: number; disagreementCountAfter: number;
    } | null;
  };

  const rows: ExportRow[] = (attempts as AttemptRow[]).map(attempt => {
    const r1 = attempt.responses.find(r => r.sessionParticipantId === p1.id) ?? null;
    const r2 = attempt.responses.find(r => r.sessionParticipantId === p2.id) ?? null;

    const tr = attempt.trialRecord;

    return {
      // Sessão
      sessionId:         session.id,
      sessionName:       session.name,
      sequenceVariant:   session.sequenceVariant as SequenceVariant,
      sessionStatus:     session.status as 'WAITING' | 'IN_PROGRESS' | 'COMPLETED',
      p1ParticipantCode: p1.participantCode,
      p2ParticipantCode: p2.participantCode,

      // Posição e estímulo
      globalNumber:            attempt.globalNumber,
      blockNumber:             attempt.blockNumber,
      trialInBlock:            attempt.trialInBlock,
      condition:               attempt.condition as Condition,
      endowment:               attempt.endowment,
      distributorCharacter:    attempt.distributorCharacter,
      receptorCharacter:       attempt.receptorCharacter,
      distributorDistribution: attempt.distributorDistribution,
      receptorDistribution:    attempt.receptorDistribution,

      // Respostas P1
      p1Judgment:             (r1?.judgment ?? null) as JudgmentResponse | null,
      p1JudgmentAt:           r1?.judgmentAt ?? null,
      p1Punishment:           (r1?.punishment ?? null) as PunishmentDecision | null,
      p1PunishmentAt:         r1?.punishmentAt ?? null,
      p1ResultAcknowledgedAt: r1?.resultAcknowledgedAt ?? null,

      // Respostas P2
      p2Judgment:             (r2?.judgment ?? null) as JudgmentResponse | null,
      p2JudgmentAt:           r2?.judgmentAt ?? null,
      p2Punishment:           (r2?.punishment ?? null) as PunishmentDecision | null,
      p2PunishmentAt:         r2?.punishmentAt ?? null,
      p2ResultAcknowledgedAt: r2?.resultAcknowledgedAt ?? null,

      // Resultado (null se TrialRecord ausente)
      consensus:              tr?.consensus ?? null,
      culturant:              tr ? (tr.culturant as Culturant) : null,
      p1IndividualCost:       tr ? toIndividualCost(tr.p1IndividualCost) : null,
      p2IndividualCost:       tr ? toIndividualCost(tr.p2IndividualCost) : null,
      punishmentApplied:      tr?.punishmentApplied ?? null,
      // Preservar sempre, mesmo quando punishmentApplied === false
      distributorFinal:       tr?.distributorFinal ?? null,
      distributorLost:        tr?.distributorLost ?? null,
      culturalConsequence:    tr ? toCulturalConsequence(tr.culturalConsequence) : null,
      p1CoinsAfter:           tr?.p1CoinsAfter ?? null,
      p2CoinsAfter:           tr?.p2CoinsAfter ?? null,
      groupCoinsAfter:        tr?.groupCoinsAfter ?? null,
      disagreementCountAfter: tr?.disagreementCountAfter ?? null,

      // Timestamps
      attemptStartedAt:   attempt.startedAt,
      attemptCompletedAt: attempt.completedAt,
    };
  });

  return rows;
}
