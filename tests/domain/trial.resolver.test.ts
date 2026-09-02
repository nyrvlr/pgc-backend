import { describe, expect, it } from 'vitest';
import {
  resolveTrialFromDb,
  SessionBootstrapError,
  type AttemptSnapshot,
  type PreviousTrialRecord,
  type ResponseRow,
} from '../../src/services/trial.resolver';
import { INITIAL_COINS } from '../../src/domain/experiment.types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const attemptUnequal: AttemptSnapshot = {
  globalNumber: 1,
  condition: 'A',
  endowment: 32,
  distributorDistribution: 24,
  receptorDistribution: 8,
  distributorCharacter: 'Lucas',
  receptorCharacter: 'Isaac',
};

const attemptEqual: AttemptSnapshot = {
  globalNumber: 2,
  condition: 'A',
  endowment: 16,
  distributorDistribution: 8,
  receptorDistribution: 8,
  distributorCharacter: 'Alice',
  receptorCharacter: 'Laura',
};

const responsesPunishBoth: ResponseRow[] = [
  { slot: 'P1', judgment: 'Unjust', punishment: 'Punish' },
  { slot: 'P2', judgment: 'Unjust', punishment: 'Punish' },
];

const responsesNoPunishBoth: ResponseRow[] = [
  { slot: 'P1', judgment: 'Just', punishment: 'NoPunish' },
  { slot: 'P2', judgment: 'Just', punishment: 'NoPunish' },
];

const responsesDisagreement: ResponseRow[] = [
  { slot: 'P1', judgment: 'Unjust', punishment: 'Punish' },
  { slot: 'P2', judgment: 'Just',   punishment: 'NoPunish' },
];

// ---------------------------------------------------------------------------
// Trial 1 — usa INITIAL_COINS
// ---------------------------------------------------------------------------

describe('resolveTrialFromDb — trial 1 (estado inicial)', () => {
  it('usa INITIAL_COINS quando previousRecord é null', () => {
    const result = resolveTrialFromDb(attemptUnequal, responsesPunishBoth, null);
    // Punish/Punish: cada um perde 1 moeda
    expect(result.p1CoinsAfter).toBe(INITIAL_COINS - 1);
    expect(result.p2CoinsAfter).toBe(INITIAL_COINS - 1);
  });

  it('groupCoins inicia em 0 quando previousRecord é null', () => {
    const result = resolveTrialFromDb(attemptUnequal, responsesPunishBoth, null);
    // Condição A + Cp (Unequal+Punish/Punish) = CC de 3
    expect(result.groupCoinsAfter).toBe(3);
  });

  it('disagreementCount inicia em 0 quando previousRecord é null', () => {
    const result = resolveTrialFromDb(attemptUnequal, responsesNoPunishBoth, null);
    expect(result.disagreementCountAfter).toBe(0); // NoPunish/NoPunish = Bnp, não D
  });
});

// ---------------------------------------------------------------------------
// Trial seguinte — usa estado anterior
// ---------------------------------------------------------------------------

describe('resolveTrialFromDb — trial seguinte usa estado anterior', () => {
  it('p1CoinsAfter subtrai do previousRecord, não de INITIAL_COINS', () => {
    const prev: PreviousTrialRecord = {
      p1CoinsAfter: 70,
      p2CoinsAfter: 72,
      groupCoinsAfter: 9,
      disagreementCountAfter: 2,
    };
    const result = resolveTrialFromDb(attemptEqual, responsesPunishBoth, prev);
    // Bp (Equal+Punish/Punish): -1 cada
    expect(result.p1CoinsAfter).toBe(69);
    expect(result.p2CoinsAfter).toBe(71);
  });

  it('groupCoinsAfter acumula sobre o valor anterior', () => {
    const prev: PreviousTrialRecord = {
      p1CoinsAfter: 75, p2CoinsAfter: 75,
      groupCoinsAfter: 12, disagreementCountAfter: 1,
    };
    // Condição A + Bp = +3
    const result = resolveTrialFromDb(attemptEqual, responsesPunishBoth, prev);
    expect(result.groupCoinsAfter).toBe(15);
  });

  it('disagreementCountAfter incrementa sobre o valor anterior', () => {
    const prev: PreviousTrialRecord = {
      p1CoinsAfter: 75, p2CoinsAfter: 75,
      groupCoinsAfter: 6, disagreementCountAfter: 3,
    };
    const result = resolveTrialFromDb(attemptUnequal, responsesDisagreement, prev);
    expect(result.disagreementCountAfter).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Mapeamento correto de P1/P2 por slot
// ---------------------------------------------------------------------------

describe('resolveTrialFromDb — mapeamento P1/P2 por slot', () => {
  it('respostas em ordem invertida [P2, P1] produzem o mesmo resultado', () => {
    const invertido: ResponseRow[] = [
      { slot: 'P2', judgment: 'Unjust', punishment: 'Punish' },
      { slot: 'P1', judgment: 'Unjust', punishment: 'Punish' },
    ];
    const normal = resolveTrialFromDb(attemptUnequal, responsesPunishBoth, null);
    const inverted = resolveTrialFromDb(attemptUnequal, invertido, null);
    expect(normal.p1IndividualCost).toBe(inverted.p1IndividualCost);
    expect(normal.p2IndividualCost).toBe(inverted.p2IndividualCost);
    expect(normal.culturant).toBe(inverted.culturant);
  });

  it('P1=Punish P2=NoPunish: p1Cost=1, p2Cost=0, culturant=D', () => {
    const result = resolveTrialFromDb(attemptUnequal, responsesDisagreement, null);
    expect(result.p1IndividualCost).toBe(1);
    expect(result.p2IndividualCost).toBe(0);
    expect(result.culturant).toBe('D');
    expect(result.punishmentApplied).toBe(false);
  });

  it('P1=NoPunish P2=Punish: p1Cost=0, p2Cost=1', () => {
    const invertedDisagreement: ResponseRow[] = [
      { slot: 'P1', judgment: 'Just',   punishment: 'NoPunish' },
      { slot: 'P2', judgment: 'Unjust', punishment: 'Punish'   },
    ];
    const result = resolveTrialFromDb(attemptUnequal, invertedDisagreement, null);
    expect(result.p1IndividualCost).toBe(0);
    expect(result.p2IndividualCost).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Resultado vira TrialRecord corretamente
// ---------------------------------------------------------------------------

describe('resolveTrialFromDb — resultado completo', () => {
  it('Unequal+Punish/Punish em condição A: Cp, punishmentApplied, CC=3', () => {
    const result = resolveTrialFromDb(attemptUnequal, responsesPunishBoth, null);
    expect(result.culturant).toBe('Cp');
    expect(result.consensus).toBe(true);
    expect(result.punishmentApplied).toBe(true);
    expect(result.culturalConsequence).toBe(3);
    expect(result.distributorFinal).toBe(8);   // receptorDistribution
    expect(result.distributorLost).toBe(16);   // 24 - 8
  });

  it('Equal+NoPunish/NoPunish em condição A: Cnp, punishmentApplied=false, CC=3', () => {
    const result = resolveTrialFromDb(attemptEqual, responsesNoPunishBoth, null);
    expect(result.culturant).toBe('Cnp');
    expect(result.consensus).toBe(true);
    expect(result.punishmentApplied).toBe(false);
    expect(result.culturalConsequence).toBe(3);
  });

  it('snapshot do Attempt é usado como Stimulus (distributorFinal Equal)', () => {
    // Equal: distributorFinal = distributorDistribution / 2
    const result = resolveTrialFromDb(attemptEqual, responsesPunishBoth, null);
    expect(result.distributorFinal).toBe(4);   // 8 / 2
    expect(result.distributorLost).toBe(4);    // 8 - 4
  });

  it('todos os campos de nextState estão presentes no retorno', () => {
    const result = resolveTrialFromDb(attemptUnequal, responsesPunishBoth, null);
    expect(result).toHaveProperty('p1CoinsAfter');
    expect(result).toHaveProperty('p2CoinsAfter');
    expect(result).toHaveProperty('groupCoinsAfter');
    expect(result).toHaveProperty('disagreementCountAfter');
  });
});

// ---------------------------------------------------------------------------
// Validações de erro
// ---------------------------------------------------------------------------

describe('resolveTrialFromDb — validações de erro', () => {
  it('lança erro se P1 estiver ausente', () => {
    const soP2: ResponseRow[] = [{ slot: 'P2', judgment: 'Just', punishment: 'NoPunish' }];
    expect(() => resolveTrialFromDb(attemptUnequal, soP2, null))
      .toThrowError(SessionBootstrapError);
  });

  it('lança erro se P2 estiver ausente', () => {
    const soP1: ResponseRow[] = [{ slot: 'P1', judgment: 'Just', punishment: 'NoPunish' }];
    expect(() => resolveTrialFromDb(attemptUnequal, soP1, null))
      .toThrowError(SessionBootstrapError);
  });

  it('lança erro se judgment de P1 for null', () => {
    const incompleto: ResponseRow[] = [
      { slot: 'P1', judgment: null, punishment: 'Punish' },
      { slot: 'P2', judgment: 'Just', punishment: 'NoPunish' },
    ];
    expect(() => resolveTrialFromDb(attemptUnequal, incompleto, null))
      .toThrowError(SessionBootstrapError);
  });

  it('lança erro se punishment de P2 for null', () => {
    const incompleto: ResponseRow[] = [
      { slot: 'P1', judgment: 'Just', punishment: 'NoPunish' },
      { slot: 'P2', judgment: 'Just', punishment: null },
    ];
    expect(() => resolveTrialFromDb(attemptUnequal, incompleto, null))
      .toThrowError(SessionBootstrapError);
  });
});
