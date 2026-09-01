import { describe, expect, it } from 'vitest';
import {
  calculateDistributorFinal,
  calculateDistributorLost,
  calculateGroupCoins,
  calculateIndividualCost,
  classifyCulturant,
  classifyDistribution,
  hasConsensus,
  shouldAwardCulturalConsequence,
  shouldPunishDistributor,
} from '../../src/domain/experiment.rules';

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
