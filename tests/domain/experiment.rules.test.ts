import { describe, expect, it } from 'vitest';
import {
  calculateIndividualCost,
  classifyCulturant,
  classifyDistribution,
  hasConsensus,
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