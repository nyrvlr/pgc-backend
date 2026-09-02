import { describe, expect, it } from 'vitest';
import {
  CC_REWARD,
  INDIVIDUAL_PUNISHMENT_COST,
  INITIAL_COINS,
  SEQUENCE_MAP,
} from '../../src/domain/experiment.types';

// -----------------------------------------------------------------------------
// SEQUENCE_MAP
// -----------------------------------------------------------------------------

describe('SEQUENCE_MAP', () => {
  it('ABAC → [A, B, A, C]', () => {
    expect(SEQUENCE_MAP['ABAC']).toEqual(['A', 'B', 'A', 'C']);
  });

  it('ACAB → [A, C, A, B]', () => {
    expect(SEQUENCE_MAP['ACAB']).toEqual(['A', 'C', 'A', 'B']);
  });

  it('BCBC → [B, C, B, C]', () => {
    expect(SEQUENCE_MAP['BCBC']).toEqual(['B', 'C', 'B', 'C']);
  });

  it('CBCB → [C, B, C, B]', () => {
    expect(SEQUENCE_MAP['CBCB']).toEqual(['C', 'B', 'C', 'B']);
  });
});

// -----------------------------------------------------------------------------
// Constantes experimentais
// -----------------------------------------------------------------------------

describe('constantes experimentais', () => {
  it('INITIAL_COINS = 80', () => {
    expect(INITIAL_COINS).toBe(80);
  });

  it('CC_REWARD = 3', () => {
    expect(CC_REWARD).toBe(3);
  });

  it('INDIVIDUAL_PUNISHMENT_COST = 1', () => {
    expect(INDIVIDUAL_PUNISHMENT_COST).toBe(1);
  });
});
