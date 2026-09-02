import { describe, expect, it } from 'vitest';
import { resolveTrial } from '../../src/domain/experiment.rules';
import {
  SEQUENCE_MAP,
  type ParticipantResponses,
  type SessionState,
  type Stimulus,
} from '../../src/domain/experiment.types';

// =============================================================================
// Fixture sintética
// Esta sequência NÃO representa os 64 cartões reais do experimento físico.
// Serve apenas para validar a acumulação correta do motor ao longo de 64
// tentativas com estímulos e respostas determinísticas.
// =============================================================================

// Dotações coerentes com o protocolo (múltiplos de 4, faixa 4–32)
const ENDOWMENTS = [4, 8, 12, 16, 20, 24, 28, 32];

// 8 estímulos Equal + 8 Unequal por bloco (16 no total)
const BLOCK_STIMULI: Stimulus[] = [
  ...ENDOWMENTS.map((e) => ({
    endowment: e,
    distributorDistribution: e / 2,
    receptorDistribution: e / 2,
    distributorCharacter: 'Lucas',
    receptorCharacter: 'Miguel',
  })),
  ...ENDOWMENTS.map((e) => ({
    endowment: e,
    distributorDistribution: (3 * e) / 4,
    receptorDistribution: e / 4,
    distributorCharacter: 'Lucas',
    receptorCharacter: 'Miguel',
  })),
];

// Padrão de 4 respostas repetido 4× = 16 por bloco
// Cobre: consenso punição, consenso não punição, desacordo P1, desacordo P2
const RESPONSE_PATTERN: ParticipantResponses[] = [
  { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   },
  { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' },
  { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'NoPunish' },
  { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'NoPunish', p2Punishment: 'Punish'   },
];
const BLOCK_RESPONSES: ParticipantResponses[] = [
  ...RESPONSE_PATTERN,
  ...RESPONSE_PATTERN,
  ...RESPONSE_PATTERN,
  ...RESPONSE_PATTERN,
];

// Sequência ABAC via SEQUENCE_MAP
const SEQUENCE = SEQUENCE_MAP['ABAC']; // ['A', 'B', 'A', 'C']

// Estado inicial canônico
const INITIAL_STATE: SessionState = {
  p1Coins: 80,
  p2Coins: 80,
  groupCoins: 0,
  disagreementCount: 0,
};

// =============================================================================
// Execução da simulação
// =============================================================================

// Resultados e estados acumulados ao longo das 64 tentativas
type TrialRecord = {
  block: number;
  trialInBlock: number;
  condition: 'A' | 'B' | 'C';
  culturalConsequence: 0 | 3;
  culturant: string;
  p1IndividualCost: 0 | 1;
  p2IndividualCost: 0 | 1;
};

const trialRecords: TrialRecord[] = [];
let state = { ...INITIAL_STATE };

for (let b = 0; b < 4; b++) {
  const condition = SEQUENCE[b];
  for (let t = 0; t < 16; t++) {
    const { result, nextState } = resolveTrial(
      condition,
      BLOCK_STIMULI[t],
      BLOCK_RESPONSES[t],
      state,
    );
    trialRecords.push({
      block: b,
      trialInBlock: t,
      condition,
      culturalConsequence: result.culturalConsequence,
      culturant: result.culturant,
      p1IndividualCost: result.p1IndividualCost,
      p2IndividualCost: result.p2IndividualCost,
    });
    state = nextState;
  }
}

const finalState = state;

// =============================================================================
// Testes
// =============================================================================

describe('simulação sintética de sessão ABAC (64 tentativas)', () => {

  // 1. Contagem total de tentativas
  it('fixture contém exatamente 64 tentativas', () => {
    expect(trialRecords.length).toBe(64);
  });

  // 2. Estrutura de blocos
  it('existem exatamente 4 blocos de 16 tentativas', () => {
    for (let b = 0; b < 4; b++) {
      const blocoTentativas = trialRecords.filter((r) => r.block === b);
      expect(blocoTentativas.length).toBe(16);
    }
  });

  // 3. Distribuição Equal/Unequal por bloco
  it('cada bloco tem 8 distribuições Equal e 8 Unequal', () => {
    // BLOCK_STIMULI tem 8 Equal seguidos de 8 Unequal — mesmos índices em todos os blocos
    const equalCount  = BLOCK_STIMULI.filter(
      (s) => s.distributorDistribution === s.receptorDistribution,
    ).length;
    const unequalCount = BLOCK_STIMULI.filter(
      (s) => s.distributorDistribution !== s.receptorDistribution,
    ).length;

    expect(equalCount).toBe(8);
    expect(unequalCount).toBe(8);
  });

  // 4. Condições dos blocos seguem ABAC via SEQUENCE_MAP
  it('condições dos 4 blocos são A, B, A, C (via SEQUENCE_MAP)', () => {
    expect(SEQUENCE).toEqual(['A', 'B', 'A', 'C']);

    const conditionsByBlock = [0, 1, 2, 3].map((b) =>
      trialRecords.find((r) => r.block === b)!.condition,
    );
    expect(conditionsByBlock).toEqual(['A', 'B', 'A', 'C']);
  });

  // 5. Todas as 64 tentativas resolvidas sem erro (implícito: trialRecords.length === 64)
  it('todas as 64 tentativas são resolvidas sem erro', () => {
    expect(trialRecords.length).toBe(64);
    trialRecords.forEach((r) => {
      expect(['Bp', 'Bnp', 'Cp', 'Cnp', 'D']).toContain(r.culturant);
      expect([0, 3]).toContain(r.culturalConsequence);
    });
  });

  // 6. Estado final igual à soma dos efeitos das 64 tentativas
  it('estado final é igual à soma acumulada dos efeitos das 64 tentativas', () => {
    const totalP1Cost  = trialRecords.reduce((s, r) => s + r.p1IndividualCost, 0);
    const totalP2Cost  = trialRecords.reduce((s, r) => s + r.p2IndividualCost, 0);
    const totalCC      = trialRecords.reduce((s, r) => s + r.culturalConsequence, 0);
    const totalD       = trialRecords.filter((r) => r.culturant === 'D').length;

    expect(finalState.p1Coins).toBe(INITIAL_STATE.p1Coins - totalP1Cost);
    expect(finalState.p2Coins).toBe(INITIAL_STATE.p2Coins - totalP2Cost);
    expect(finalState.groupCoins).toBe(INITIAL_STATE.groupCoins + totalCC);
    expect(finalState.disagreementCount).toBe(INITIAL_STATE.disagreementCount + totalD);
  });

  // 7. p1Coins e p2Coins finais correspondem ao número de vezes que cada um escolheu Punish
  it('saldos finais correspondem ao número de punições individuais', () => {
    const p1Punishments = BLOCK_RESPONSES.filter((r) => r.p1Punishment === 'Punish').length * 4;
    const p2Punishments = BLOCK_RESPONSES.filter((r) => r.p2Punishment === 'Punish').length * 4;

    expect(finalState.p1Coins).toBe(80 - p1Punishments);
    expect(finalState.p2Coins).toBe(80 - p2Punishments);

    // Valores concretos da fixture sintética
    expect(finalState.p1Coins).toBe(48);
    expect(finalState.p2Coins).toBe(48);
  });

  // 8. disagreementCount final corresponde ao total de tentativas com culturante D
  it('disagreementCount final corresponde ao total de tentativas com culturante D', () => {
    const totalD = trialRecords.filter((r) => r.culturant === 'D').length;
    expect(finalState.disagreementCount).toBe(totalD);
    expect(finalState.disagreementCount).toBe(32);
  });

  // 9. groupCoins final corresponde à soma de todos os culturalConsequence
  it('groupCoins final corresponde à soma de todos os culturalConsequence', () => {
    const totalCC = trialRecords.reduce((s, r) => s + r.culturalConsequence, 0);
    expect(finalState.groupCoins).toBe(totalCC);
    expect(finalState.groupCoins).toBe(72);
  });

  // 10. Estado inicial original permanece intacto (resolveTrial não muta)
  it('estado inicial não foi mutado ao longo das 64 tentativas', () => {
    expect(INITIAL_STATE.p1Coins).toBe(80);
    expect(INITIAL_STATE.p2Coins).toBe(80);
    expect(INITIAL_STATE.groupCoins).toBe(0);
    expect(INITIAL_STATE.disagreementCount).toBe(0);
  });
});
