/**
 * trial.resolver.ts
 * Função pura de adaptação entre os dados do banco e resolveTrial() do M1.
 * Sem Prisma, sem efeitos colaterais — testável sem banco.
 */

import {
  resolveTrial,
} from '../domain/experiment.rules';
import {
  INITIAL_COINS,
  type Condition,
  type JudgmentResponse,
  type PunishmentDecision,
  type SessionState,
  type TrialResult,
} from '../domain/experiment.types';
import { SessionBootstrapError } from './session.drafts';

// ---------------------------------------------------------------------------
// Tipos de entrada — shapes do que o Prisma retorna
// ---------------------------------------------------------------------------

/** Snapshot do Attempt (campos de estímulo + posição) */
export type AttemptSnapshot = {
  globalNumber: number;
  condition: Condition;
  endowment: number;
  distributorDistribution: number;
  receptorDistribution: number;
  distributorCharacter: string;
  receptorCharacter: string;
};

/** Resposta individual do banco */
export type ResponseRow = {
  slot: 'P1' | 'P2';
  judgment: JudgmentResponse | null;
  punishment: PunishmentDecision | null;
};

/** TrialRecord do Attempt anterior — null se for a primeira tentativa */
export type PreviousTrialRecord = {
  p1CoinsAfter: number;
  p2CoinsAfter: number;
  groupCoinsAfter: number;
  disagreementCountAfter: number;
} | null;

/** Tudo que o TrialRecord precisa para ser persistido */
export type TrialRecordData = TrialResult & {
  p1CoinsAfter: number;
  p2CoinsAfter: number;
  groupCoinsAfter: number;
  disagreementCountAfter: number;
};

// ---------------------------------------------------------------------------
// Função pura
// ---------------------------------------------------------------------------

/**
 * Reconstrói o SessionState anterior, valida as respostas e chama resolveTrial().
 * Retorna os dados completos para persistir o TrialRecord.
 *
 * Lança SessionBootstrapError se:
 * - alguma resposta de judgment ou punishment estiver ausente
 * - P1 ou P2 não estiverem representados nas respostas
 */
export function resolveTrialFromDb(
  attempt: AttemptSnapshot,
  responses: ResponseRow[],
  previousRecord: PreviousTrialRecord,
): TrialRecordData {
  // Mapeia por slot — não por ordem de retorno do banco
  const bySlot = new Map(responses.map(r => [r.slot, r]));
  const r1 = bySlot.get('P1');
  const r2 = bySlot.get('P2');

  if (!r1 || !r2) {
    const missing = [!r1 && 'P1', !r2 && 'P2'].filter(Boolean).join(', ');
    throw new SessionBootstrapError(
      `Tentativa ${attempt.globalNumber}: respostas ausentes para ${missing}.`
    );
  }
  if (!r1.judgment || !r1.punishment) {
    throw new SessionBootstrapError(
      `Tentativa ${attempt.globalNumber}: P1 não completou judgment (${r1.judgment}) ou punishment (${r1.punishment}).`
    );
  }
  if (!r2.judgment || !r2.punishment) {
    throw new SessionBootstrapError(
      `Tentativa ${attempt.globalNumber}: P2 não completou judgment (${r2.judgment}) ou punishment (${r2.punishment}).`
    );
  }

  // Reconstrói SessionState: trial 1 usa INITIAL_COINS; demais usam o record anterior
  const currentState: SessionState = previousRecord
    ? {
        p1Coins: previousRecord.p1CoinsAfter,
        p2Coins: previousRecord.p2CoinsAfter,
        groupCoins: previousRecord.groupCoinsAfter,
        disagreementCount: previousRecord.disagreementCountAfter,
      }
    : {
        p1Coins: INITIAL_COINS,
        p2Coins: INITIAL_COINS,
        groupCoins: 0,
        disagreementCount: 0,
      };

  // Reconstrói Stimulus a partir do snapshot do Attempt
  const stimulus = {
    endowment: attempt.endowment,
    distributorDistribution: attempt.distributorDistribution,
    receptorDistribution: attempt.receptorDistribution,
    distributorCharacter: attempt.distributorCharacter,
    receptorCharacter: attempt.receptorCharacter,
  };

  const { result, nextState } = resolveTrial(
    attempt.condition,
    stimulus,
    {
      p1Judgment: r1.judgment,
      p2Judgment: r2.judgment,
      p1Punishment: r1.punishment,
      p2Punishment: r2.punishment,
    },
    currentState,
  );

  return {
    ...result,
    p1CoinsAfter: nextState.p1Coins,
    p2CoinsAfter: nextState.p2Coins,
    groupCoinsAfter: nextState.groupCoins,
    disagreementCountAfter: nextState.disagreementCount,
  };
}
