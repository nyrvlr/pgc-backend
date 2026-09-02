import { describe, expect, it } from 'vitest';
import { resolveTrial } from '../../src/domain/experiment.rules';
import type { Culturant, SessionState } from '../../src/domain/experiment.types';
import { REAL_SESSION } from '../fixtures/real-session.reference';

// =============================================================================
// Mapeamento de culturante do motor → nomenclatura legada da aba ORIGINAL
//
// A aba ORIGINAL usa "Cp" para qualquer consenso de punição (Equal ou Unequal)
// e "Cnp" para qualquer consenso de não punição. O motor atual distingue:
//   Bp  (punição em Equal)    → Cp  no legado
//   Cp  (punição em Unequal)  → Cp  no legado
//   Bnp (não punição em Unequal) → Cnp no legado
//   Cnp (não punição em Equal)   → Cnp no legado
//   D   → D
// =============================================================================

function toLegacyCulturant(culturant: Culturant): 'Cp' | 'Cnp' | 'D' {
  if (culturant === 'Bp' || culturant === 'Cp')  return 'Cp';
  if (culturant === 'Bnp' || culturant === 'Cnp') return 'Cnp';
  return 'D';
}

// =============================================================================
// Execução da sessão real
// =============================================================================

const INITIAL_STATE: SessionState = {
  p1Coins: 80,
  p2Coins: 80,
  groupCoins: 0,
  disagreementCount: 0,
};

type TrialOutput = {
  distributorFinal: number;
  distributorLost: number;
  culturalConsequence: 0 | 3;
  groupCoinsCumulative: number;
  p1Coins: number;
  p2Coins: number;
  culturantLegacy: 'Cp' | 'Cnp' | 'D';
  disagreement: 0 | 1;
  disagreementCumulative: number;
};

const outputs: TrialOutput[] = [];
let state = { ...INITIAL_STATE };

for (const fixture of REAL_SESSION) {
  const { result, nextState } = resolveTrial(
    fixture.input.condition,
    fixture.input.stimulus,
    fixture.input.responses,
    state,
  );
  outputs.push({
    distributorFinal:       result.distributorFinal,
    distributorLost:        result.distributorLost,
    culturalConsequence:    result.culturalConsequence,
    groupCoinsCumulative:   nextState.groupCoins,
    p1Coins:                nextState.p1Coins,
    p2Coins:                nextState.p2Coins,
    culturantLegacy:        toLegacyCulturant(result.culturant),
    disagreement:           result.culturant === 'D' ? 1 : 0,
    disagreementCumulative: nextState.disagreementCount,
  });
  state = nextState;
}

const finalState = state;

// =============================================================================
// Testes
// =============================================================================

describe('validação contra sessão real — G1P1 (24.10.2024)', () => {

  it('fixture contém exatamente 64 tentativas', () => {
    expect(REAL_SESSION.length).toBe(64);
    expect(outputs.length).toBe(64);
  });

  it('fixture tem 4 blocos de 16 tentativas', () => {
    for (let b = 1; b <= 4; b++) {
      expect(REAL_SESSION.filter((f) => f.input.block === b).length).toBe(16);
    }
  });

  it('sequência de condições é A, B, A, C', () => {
    const conditions = [1, 2, 3, 4].map(
      (b) => REAL_SESSION.find((f) => f.input.block === b)!.input.condition,
    );
    expect(conditions).toEqual(['A', 'B', 'A', 'C']);
  });

  it('64/64 tentativas: distributorFinal correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].distributorFinal;
      const expected = fixture.expected.distributorFinal;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: distributorFinal motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true); // todas passaram
  });

  it('64/64 tentativas: distributorLost correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].distributorLost;
      const expected = fixture.expected.distributorLost;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: distributorLost motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: culturalConsequence correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].culturalConsequence;
      const expected = fixture.expected.culturalConsequence;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: culturalConsequence motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: groupCoins acumulado correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].groupCoinsCumulative;
      const expected = fixture.expected.groupCoinsCumulative;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: groupCoins motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: p1Coins correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].p1Coins;
      const expected = fixture.expected.p1Coins;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: p1Coins motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: p2Coins correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].p2Coins;
      const expected = fixture.expected.p2Coins;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: p2Coins motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: culturante legado correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].culturantLegacy;
      const expected = fixture.expected.culturantLegacy;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: culturant motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: desacordo por tentativa correto', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].disagreement;
      const expected = fixture.expected.disagreement;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: disagreement motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('64/64 tentativas: desacordos acumulados corretos', () => {
    REAL_SESSION.forEach((fixture, i) => {
      const got = outputs[i].disagreementCumulative;
      const expected = fixture.expected.disagreementCumulative;
      if (got !== expected) {
        throw new Error(
          `Bloco ${fixture.input.block} tentativa ${fixture.input.trialInBlock}: disagreementCumulative motor=${got} planilha=${expected}`,
        );
      }
    });
    expect(true).toBe(true);
  });

  it('estado final: P1=39, P2=43, grupo=120, desacordos=12', () => {
    expect(finalState.p1Coins).toBe(39);
    expect(finalState.p2Coins).toBe(43);
    expect(finalState.groupCoins).toBe(120);
    expect(finalState.disagreementCount).toBe(12);
  });

  it('estado inicial não foi mutado', () => {
    expect(INITIAL_STATE.p1Coins).toBe(80);
    expect(INITIAL_STATE.p2Coins).toBe(80);
    expect(INITIAL_STATE.groupCoins).toBe(0);
    expect(INITIAL_STATE.disagreementCount).toBe(0);
  });
});
