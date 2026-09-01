import { describe, expect, it } from 'vitest';
import {
  calculateDistributorFinal,
  calculateDistributorLost,
  calculateGroupCoins,
  calculateIndividualCost,
  classifyCulturant,
  classifyDistribution,
  hasConsensus,
  resolveTrial,
  shouldAwardCulturalConsequence,
  shouldPunishDistributor,
} from '../../src/domain/experiment.rules';
import type {
  ParticipantResponses,
  SessionState,
  Stimulus,
} from '../../src/domain/experiment.types';

// -----------------------------------------------------------------------------
// classifyDistribution
// -----------------------------------------------------------------------------

describe('classifyDistribution', () => {
  it('retorna Equal quando distribuidor e receptor têm o mesmo valor', () => {
    expect(classifyDistribution(4, 4)).toBe('Equal');
  });

  it('retorna Equal para qualquer dotação igual (16/16)', () => {
    expect(classifyDistribution(16, 16)).toBe('Equal');
  });

  it('retorna Unequal quando distribuidor tem mais que o receptor (24/8)', () => {
    expect(classifyDistribution(24, 8)).toBe('Unequal');
  });

  it('retorna Unequal para outras proporções desiguais (12/4)', () => {
    expect(classifyDistribution(12, 4)).toBe('Unequal');
  });
});

// -----------------------------------------------------------------------------
// hasConsensus
// -----------------------------------------------------------------------------

describe('hasConsensus', () => {
  it('retorna true quando ambos escolhem Punish', () => {
    expect(hasConsensus('Punish', 'Punish')).toBe(true);
  });

  it('retorna true quando ambos escolhem NoPunish', () => {
    expect(hasConsensus('NoPunish', 'NoPunish')).toBe(true);
  });

  it('retorna false quando P1=Punish e P2=NoPunish', () => {
    expect(hasConsensus('Punish', 'NoPunish')).toBe(false);
  });

  it('retorna false quando P1=NoPunish e P2=Punish', () => {
    expect(hasConsensus('NoPunish', 'Punish')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// classifyCulturant
// -----------------------------------------------------------------------------

describe('classifyCulturant', () => {
  it('Equal + Punish/Punish → Bp', () => {
    expect(classifyCulturant('Equal', 'Punish', 'Punish')).toBe('Bp');
  });

  it('Equal + NoPunish/NoPunish → Cnp', () => {
    expect(classifyCulturant('Equal', 'NoPunish', 'NoPunish')).toBe('Cnp');
  });

  it('Unequal + Punish/Punish → Cp', () => {
    expect(classifyCulturant('Unequal', 'Punish', 'Punish')).toBe('Cp');
  });

  it('Unequal + NoPunish/NoPunish → Bnp', () => {
    expect(classifyCulturant('Unequal', 'NoPunish', 'NoPunish')).toBe('Bnp');
  });

  it('Equal + Punish/NoPunish → D (desacordo)', () => {
    expect(classifyCulturant('Equal', 'Punish', 'NoPunish')).toBe('D');
  });

  it('Unequal + NoPunish/Punish → D (desacordo)', () => {
    expect(classifyCulturant('Unequal', 'NoPunish', 'Punish')).toBe('D');
  });

  it('Equal + NoPunish/Punish → D (desacordo)', () => {
    expect(classifyCulturant('Equal', 'NoPunish', 'Punish')).toBe('D');
  });

  it('Unequal + Punish/NoPunish → D (desacordo)', () => {
    expect(classifyCulturant('Unequal', 'Punish', 'NoPunish')).toBe('D');
  });
});

// -----------------------------------------------------------------------------
// calculateIndividualCost
// -----------------------------------------------------------------------------

describe('calculateIndividualCost', () => {
  it('Punish → 1', () => {
    expect(calculateIndividualCost('Punish')).toBe(1);
  });

  it('NoPunish → 0', () => {
    expect(calculateIndividualCost('NoPunish')).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// shouldPunishDistributor
// -----------------------------------------------------------------------------

describe('shouldPunishDistributor', () => {
  it('Punish + Punish → true (consenso de punição)', () => {
    expect(shouldPunishDistributor('Punish', 'Punish')).toBe(true);
  });

  it('NoPunish + NoPunish → false (consenso por não punir não afeta o Distribuidor)', () => {
    expect(shouldPunishDistributor('NoPunish', 'NoPunish')).toBe(false);
  });

  it('Punish + NoPunish → false (desacordo)', () => {
    expect(shouldPunishDistributor('Punish', 'NoPunish')).toBe(false);
  });

  it('NoPunish + Punish → false (desacordo)', () => {
    expect(shouldPunishDistributor('NoPunish', 'Punish')).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// calculateDistributorFinal
// -----------------------------------------------------------------------------

describe('calculateDistributorFinal', () => {
  it('Unequal 24/8 → distributorFinal = 8', () => {
    expect(calculateDistributorFinal('Unequal', 24, 8)).toBe(8);
  });

  it('Unequal 12/4 → distributorFinal = 4', () => {
    expect(calculateDistributorFinal('Unequal', 12, 4)).toBe(4);
  });

  it('Equal 16/16 → distributorFinal = 8', () => {
    expect(calculateDistributorFinal('Equal', 16, 16)).toBe(8);
  });
});

// -----------------------------------------------------------------------------
// calculateDistributorLost
// -----------------------------------------------------------------------------

describe('calculateDistributorLost', () => {
  it('distributorDistribution=24, distributorFinal=8 → lost = 16', () => {
    expect(calculateDistributorLost(24, 8)).toBe(16);
  });

  it('distributorDistribution=16, distributorFinal=8 → lost = 8', () => {
    expect(calculateDistributorLost(16, 8)).toBe(8);
  });
});

// -----------------------------------------------------------------------------
// shouldAwardCulturalConsequence — matriz experimental completa (15 casos)
// -----------------------------------------------------------------------------

describe('shouldAwardCulturalConsequence', () => {
  it.each([
    // Condição A — qualquer consenso gera CC
    ['A', 'Bp',  true],
    ['A', 'Bnp', true],
    ['A', 'Cp',  true],
    ['A', 'Cnp', true],
    ['A', 'D',   false],
    // Condição B — apenas Bp e Bnp geram CC
    ['B', 'Bp',  true],
    ['B', 'Bnp', true],
    ['B', 'Cp',  false],
    ['B', 'Cnp', false],
    ['B', 'D',   false],
    // Condição C — apenas Cp e Cnp geram CC
    ['C', 'Bp',  false],
    ['C', 'Bnp', false],
    ['C', 'Cp',  true],
    ['C', 'Cnp', true],
    ['C', 'D',   false],
  ] as const)('condição %s + culturante %s → %s', (condition, culturant, expected) => {
    expect(shouldAwardCulturalConsequence(condition, culturant)).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// calculateGroupCoins
// -----------------------------------------------------------------------------

describe('calculateGroupCoins', () => {
  it('shouldAward=true → 3', () => {
    expect(calculateGroupCoins(true)).toBe(3);
  });

  it('shouldAward=false → 0', () => {
    expect(calculateGroupCoins(false)).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// resolveTrial
// -----------------------------------------------------------------------------

const initialState: SessionState = {
  p1Coins: 80,
  p2Coins: 80,
  groupCoins: 0,
  disagreementCount: 0,
};

const stimulusEqual: Stimulus = {
  endowment: 32,
  distributorDistribution: 16,
  receptorDistribution: 16,
  distributorCharacter: 'Lucas',
  receptorCharacter: 'Miguel',
};

const stimulusUnequal: Stimulus = {
  endowment: 32,
  distributorDistribution: 24,
  receptorDistribution: 8,
  distributorCharacter: 'Lucas',
  receptorCharacter: 'Miguel',
};

describe('resolveTrial', () => {
  // 1. Condição A + Equal + Punish/Punish → Bp + CC=3
  it('A + Equal + Punish/Punish: consensus, Bp, custos=1, punishmentApplied, CC=3', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Unjust',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };
    const { result, nextState } = resolveTrial('A', stimulusEqual, responses, initialState);

    expect(result.consensus).toBe(true);
    expect(result.culturant).toBe('Bp');
    expect(result.p1IndividualCost).toBe(1);
    expect(result.p2IndividualCost).toBe(1);
    expect(result.punishmentApplied).toBe(true);
    expect(result.distributorFinal).toBe(8);
    expect(result.distributorLost).toBe(8);
    expect(result.culturalConsequence).toBe(3);

    expect(nextState.p1Coins).toBe(79);
    expect(nextState.p2Coins).toBe(79);
    expect(nextState.groupCoins).toBe(3);
    expect(nextState.disagreementCount).toBe(0);
  });

  // 2. Condição A + Unequal + NoPunish/NoPunish → Bnp + CC=3
  it('A + Unequal + NoPunish/NoPunish: Bnp, custos=0, punishmentApplied=false, CC=3', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Just',
      p2Judgment: 'Just',
      p1Punishment: 'NoPunish',
      p2Punishment: 'NoPunish',
    };
    const { result, nextState } = resolveTrial('A', stimulusUnequal, responses, initialState);

    expect(result.consensus).toBe(true);
    expect(result.culturant).toBe('Bnp');
    expect(result.p1IndividualCost).toBe(0);
    expect(result.p2IndividualCost).toBe(0);
    expect(result.punishmentApplied).toBe(false);
    expect(result.distributorFinal).toBe(8);
    expect(result.distributorLost).toBe(16);
    expect(result.culturalConsequence).toBe(3);

    expect(nextState.p1Coins).toBe(80);
    expect(nextState.p2Coins).toBe(80);
    expect(nextState.groupCoins).toBe(3);
    expect(nextState.disagreementCount).toBe(0);
  });

  // 3. Condição B + Equal + Punish/Punish → Bp + CC=3
  it('B + Equal + Punish/Punish: Bp, CC=3', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Unjust',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };
    const { result } = resolveTrial('B', stimulusEqual, responses, initialState);

    expect(result.culturant).toBe('Bp');
    expect(result.culturalConsequence).toBe(3);
  });

  // 4. Condição B + Unequal + Punish/Punish → Cp + CC=0
  it('B + Unequal + Punish/Punish: Cp, CC=0', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Unjust',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };
    const { result } = resolveTrial('B', stimulusUnequal, responses, initialState);

    expect(result.culturant).toBe('Cp');
    expect(result.culturalConsequence).toBe(0);
  });

  // 5. Condição C + Unequal + Punish/Punish → Cp + CC=3
  it('C + Unequal + Punish/Punish: Cp, CC=3', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Unjust',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };
    const { result } = resolveTrial('C', stimulusUnequal, responses, initialState);

    expect(result.culturant).toBe('Cp');
    expect(result.culturalConsequence).toBe(3);
  });

  // 6. Condição C + Equal + NoPunish/NoPunish → Cnp + CC=3
  it('C + Equal + NoPunish/NoPunish: Cnp, CC=3', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Just',
      p2Judgment: 'Just',
      p1Punishment: 'NoPunish',
      p2Punishment: 'NoPunish',
    };
    const { result } = resolveTrial('C', stimulusEqual, responses, initialState);

    expect(result.culturant).toBe('Cnp');
    expect(result.culturalConsequence).toBe(3);
  });

  // 7. Desacordo Punish/NoPunish
  it('Desacordo Punish/NoPunish: D, p1Cost=1, p2Cost=0, punishmentApplied=false, CC=0, disagreementCount+1', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Just',
      p1Punishment: 'Punish',
      p2Punishment: 'NoPunish',
    };
    const { result, nextState } = resolveTrial('A', stimulusUnequal, responses, initialState);

    expect(result.consensus).toBe(false);
    expect(result.culturant).toBe('D');
    expect(result.p1IndividualCost).toBe(1);
    expect(result.p2IndividualCost).toBe(0);
    expect(result.punishmentApplied).toBe(false);
    expect(result.culturalConsequence).toBe(0);

    expect(nextState.p1Coins).toBe(79);
    expect(nextState.p2Coins).toBe(80);
    expect(nextState.groupCoins).toBe(0);
    expect(nextState.disagreementCount).toBe(1);
  });

  // 8. Desacordo NoPunish/Punish
  it('Desacordo NoPunish/Punish: D, p1Cost=0, p2Cost=1, punishmentApplied=false, CC=0, disagreementCount+1', () => {
    const responses: ParticipantResponses = {
      p1Judgment: 'Just',
      p2Judgment: 'Unjust',
      p1Punishment: 'NoPunish',
      p2Punishment: 'Punish',
    };
    const { result, nextState } = resolveTrial('A', stimulusUnequal, responses, initialState);

    expect(result.consensus).toBe(false);
    expect(result.culturant).toBe('D');
    expect(result.p1IndividualCost).toBe(0);
    expect(result.p2IndividualCost).toBe(1);
    expect(result.punishmentApplied).toBe(false);
    expect(result.culturalConsequence).toBe(0);

    expect(nextState.p1Coins).toBe(80);
    expect(nextState.p2Coins).toBe(79);
    expect(nextState.groupCoins).toBe(0);
    expect(nextState.disagreementCount).toBe(1);
  });

  // 9. p1Judgment / p2Judgment não afetam o resultado experimental
  it('julgamento Just vs Unjust não altera result nem nextState', () => {
    const responsesJust: ParticipantResponses = {
      p1Judgment: 'Just',
      p2Judgment: 'Just',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };
    const responsesUnjust: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Unjust',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };

    const outcomeJust   = resolveTrial('C', stimulusUnequal, responsesJust,   initialState);
    const outcomeUnjust = resolveTrial('C', stimulusUnequal, responsesUnjust, initialState);

    expect(outcomeJust.result).toEqual(outcomeUnjust.result);
    expect(outcomeJust.nextState).toEqual(outcomeUnjust.nextState);
  });

  // 10. Estado não inicial + consequência cultural + imutabilidade do estado recebido
  it('estado acumulado: nextState correto e currentState não é mutado', () => {
    const currentState: SessionState = {
      p1Coins: 57,
      p2Coins: 63,
      groupCoins: 12,
      disagreementCount: 4,
    };
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Unjust',
      p1Punishment: 'Punish',
      p2Punishment: 'Punish',
    };
    const { result, nextState } = resolveTrial('C', stimulusUnequal, responses, currentState);

    expect(result.culturalConsequence).toBe(3);

    expect(nextState.p1Coins).toBe(56);
    expect(nextState.p2Coins).toBe(62);
    expect(nextState.groupCoins).toBe(15);
    expect(nextState.disagreementCount).toBe(4);

    // currentState não deve ter sido mutado
    expect(currentState.p1Coins).toBe(57);
    expect(currentState.p2Coins).toBe(63);
    expect(currentState.groupCoins).toBe(12);
    expect(currentState.disagreementCount).toBe(4);
  });

  // 11. Desacordo sobre estado já acumulado
  it('desacordo sobre estado acumulado: disagreementCount+1, custos e cofrinho corretos', () => {
    const currentState: SessionState = {
      p1Coins: 57,
      p2Coins: 63,
      groupCoins: 12,
      disagreementCount: 4,
    };
    const responses: ParticipantResponses = {
      p1Judgment: 'Unjust',
      p2Judgment: 'Just',
      p1Punishment: 'Punish',
      p2Punishment: 'NoPunish',
    };
    const { result, nextState } = resolveTrial('A', stimulusUnequal, responses, currentState);

    expect(result.culturant).toBe('D');
    expect(result.culturalConsequence).toBe(0);
    expect(result.punishmentApplied).toBe(false);

    expect(nextState.p1Coins).toBe(56);
    expect(nextState.p2Coins).toBe(63);
    expect(nextState.groupCoins).toBe(12);
    expect(nextState.disagreementCount).toBe(5);
  });
});
