// =============================================================================
// real-session.reference.ts
// Fixture de sessão real — dados de G1P1 (24.10.2024)
//
// Entradas: altru_dados01.csv
// Resultados esperados: aba ORIGINAL de resultado_punicao_altruista_claude_compara.xlsx
//
// IMPORTANTE: esta fixture NÃO deve ser usada como referência de culturante
// direto. A aba ORIGINAL usa nomenclatura legada (Cp para punição em qualquer
// tipo de distribuição). O teste converte para comparar com o motor atual.
// =============================================================================

import type { Condition, ParticipantResponses, Stimulus } from '../../src/domain/experiment.types';

export type RealTrialInput = {
  block: number;
  condition: Condition;
  trialInBlock: number;
  stimulus: Stimulus;
  responses: ParticipantResponses;
};

export type RealTrialExpected = {
  distributorFinal: number;
  distributorLost: number;
  culturalConsequence: 0 | 3;
  groupCoinsCumulative: number;
  p1Coins: number;
  p2Coins: number;
  // Culturante legado da planilha ORIGINAL: Cp / Cnp / D
  culturantLegacy: 'Cp' | 'Cnp' | 'D';
  // Desacordo nesta tentativa (0 ou 1)
  disagreement: 0 | 1;
  // Desacordos acumulados até esta tentativa
  disagreementCumulative: number;
};

export type RealTrialFixture = {
  input: RealTrialInput;
  expected: RealTrialExpected;
};

export const REAL_SESSION: RealTrialFixture[] = [
  // ── Bloco 1 — Condição A ──────────────────────────────────────────────────
  {
    input:    { block: 1, condition: 'A', trialInBlock: 1, stimulus: { endowment: 16, distributorDistribution: 12, receptorDistribution: 4,  distributorCharacter: 'Lucas',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 4,  distributorLost: 8,  culturalConsequence: 0, groupCoinsCumulative: 0,   p1Coins: 79, p2Coins: 80, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 1  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 2, stimulus: { endowment: 4,  distributorDistribution: 3,  receptorDistribution: 1,  distributorCharacter: 'Alice',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 1,  distributorLost: 2,  culturalConsequence: 3, groupCoinsCumulative: 3,   p1Coins: 78, p2Coins: 79, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 1  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 3, stimulus: { endowment: 12, distributorDistribution: 6,  receptorDistribution: 6,  distributorCharacter: 'Cecilia',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 3,  distributorLost: 3,  culturalConsequence: 3, groupCoinsCumulative: 6,   p1Coins: 77, p2Coins: 78, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 1  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 4, stimulus: { endowment: 8,  distributorDistribution: 6,  receptorDistribution: 2,  distributorCharacter: 'David',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 2,  distributorLost: 4,  culturalConsequence: 3, groupCoinsCumulative: 9,   p1Coins: 76, p2Coins: 77, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 1  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 5, stimulus: { endowment: 4,  distributorDistribution: 2,  receptorDistribution: 2,  distributorCharacter: 'Laura',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 1,  distributorLost: 1,  culturalConsequence: 3, groupCoinsCumulative: 12,  p1Coins: 75, p2Coins: 76, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 1  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 6, stimulus: { endowment: 20, distributorDistribution: 15, receptorDistribution: 5,  distributorCharacter: 'Maria',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 5,  distributorLost: 10, culturalConsequence: 3, groupCoinsCumulative: 15,  p1Coins: 74, p2Coins: 75, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 1  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 7, stimulus: { endowment: 20, distributorDistribution: 10, receptorDistribution: 10, distributorCharacter: 'Sarah',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 5,  distributorLost: 5,  culturalConsequence: 0, groupCoinsCumulative: 15,  p1Coins: 73, p2Coins: 75, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 2  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 8, stimulus: { endowment: 12, distributorDistribution: 9,  receptorDistribution: 3,  distributorCharacter: 'Isabella', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 3,  distributorLost: 6,  culturalConsequence: 3, groupCoinsCumulative: 18,  p1Coins: 72, p2Coins: 74, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 2  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 9, stimulus: { endowment: 32, distributorDistribution: 16, receptorDistribution: 16, distributorCharacter: 'Olivia',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 8,  distributorLost: 8,  culturalConsequence: 0, groupCoinsCumulative: 18,  p1Coins: 72, p2Coins: 73, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 10, stimulus: { endowment: 8,  distributorDistribution: 4,  receptorDistribution: 4,  distributorCharacter: 'Theo',     receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 2,  distributorLost: 2,  culturalConsequence: 3, groupCoinsCumulative: 21,  p1Coins: 71, p2Coins: 72, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 11, stimulus: { endowment: 24, distributorDistribution: 18, receptorDistribution: 6,  distributorCharacter: 'Oliver',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 6,  distributorLost: 12, culturalConsequence: 3, groupCoinsCumulative: 24,  p1Coins: 70, p2Coins: 71, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 12, stimulus: { endowment: 28, distributorDistribution: 21, receptorDistribution: 7,  distributorCharacter: 'Phillip',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 7,  distributorLost: 14, culturalConsequence: 3, groupCoinsCumulative: 27,  p1Coins: 69, p2Coins: 70, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 13, stimulus: { endowment: 24, distributorDistribution: 12, receptorDistribution: 12, distributorCharacter: 'William',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 6,  distributorLost: 6,  culturalConsequence: 3, groupCoinsCumulative: 30,  p1Coins: 69, p2Coins: 70, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 14, stimulus: { endowment: 32, distributorDistribution: 24, receptorDistribution: 8,  distributorCharacter: 'Sofia',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 8,  distributorLost: 16, culturalConsequence: 3, groupCoinsCumulative: 33,  p1Coins: 68, p2Coins: 69, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 15, stimulus: { endowment: 28, distributorDistribution: 14, receptorDistribution: 14, distributorCharacter: 'Benjamin', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 7,  distributorLost: 7,  culturalConsequence: 3, groupCoinsCumulative: 36,  p1Coins: 68, p2Coins: 69, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 3  },
  },
  {
    input:    { block: 1, condition: 'A', trialInBlock: 16, stimulus: { endowment: 16, distributorDistribution: 8,  receptorDistribution: 8,  distributorCharacter: 'Isaac',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 4,  distributorLost: 4,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 67, p2Coins: 69, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 4  },
  },
  // ── Bloco 2 — Condição B ──────────────────────────────────────────────────
  {
    input:    { block: 2, condition: 'B', trialInBlock: 1, stimulus: { endowment: 20, distributorDistribution: 15, receptorDistribution: 5,  distributorCharacter: 'Cecilia',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 5,  distributorLost: 10, culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 66, p2Coins: 68, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 4  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 2, stimulus: { endowment: 24, distributorDistribution: 18, receptorDistribution: 6,  distributorCharacter: 'Isaac',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 6,  distributorLost: 12, culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 65, p2Coins: 67, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 4  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 3, stimulus: { endowment: 12, distributorDistribution: 6,  receptorDistribution: 6,  distributorCharacter: 'Alice',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'NoPunish', p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 3,  distributorLost: 3,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 65, p2Coins: 66, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 5  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 4, stimulus: { endowment: 20, distributorDistribution: 10, receptorDistribution: 10, distributorCharacter: 'Isabella', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 5,  distributorLost: 5,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 64, p2Coins: 66, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 5, stimulus: { endowment: 32, distributorDistribution: 24, receptorDistribution: 8,  distributorCharacter: 'William',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 8,  distributorLost: 16, culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 63, p2Coins: 65, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 6, stimulus: { endowment: 16, distributorDistribution: 8,  receptorDistribution: 8,  distributorCharacter: 'David',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 4,  distributorLost: 4,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 63, p2Coins: 65, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 7, stimulus: { endowment: 12, distributorDistribution: 9,  receptorDistribution: 3,  distributorCharacter: 'Laura',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 3,  distributorLost: 6,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 62, p2Coins: 64, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 8, stimulus: { endowment: 8,  distributorDistribution: 6,  receptorDistribution: 2,  distributorCharacter: 'Olivia',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 2,  distributorLost: 4,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 61, p2Coins: 63, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 9, stimulus: { endowment: 24, distributorDistribution: 12, receptorDistribution: 12, distributorCharacter: 'Lucas',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 6,  distributorLost: 6,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 61, p2Coins: 63, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 10, stimulus: { endowment: 32, distributorDistribution: 16, receptorDistribution: 16, distributorCharacter: 'Oliver',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 8,  distributorLost: 8,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 61, p2Coins: 63, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 6  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 11, stimulus: { endowment: 8,  distributorDistribution: 4,  receptorDistribution: 4,  distributorCharacter: 'Sofia',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 2,  distributorLost: 2,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 60, p2Coins: 63, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 7  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 12, stimulus: { endowment: 4,  distributorDistribution: 3,  receptorDistribution: 1,  distributorCharacter: 'Benjamin', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 1,  distributorLost: 2,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 59, p2Coins: 63, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 8  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 13, stimulus: { endowment: 16, distributorDistribution: 12, receptorDistribution: 4,  distributorCharacter: 'Theo',     receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 4,  distributorLost: 8,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 58, p2Coins: 62, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 8  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 14, stimulus: { endowment: 28, distributorDistribution: 14, receptorDistribution: 14, distributorCharacter: 'Maria',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 7,  distributorLost: 7,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 58, p2Coins: 62, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 8  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 15, stimulus: { endowment: 4,  distributorDistribution: 2,  receptorDistribution: 2,  distributorCharacter: 'Phillip',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 1,  distributorLost: 1,  culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 58, p2Coins: 62, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 8  },
  },
  {
    input:    { block: 2, condition: 'B', trialInBlock: 16, stimulus: { endowment: 28, distributorDistribution: 21, receptorDistribution: 7,  distributorCharacter: 'Sarah',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 7,  distributorLost: 14, culturalConsequence: 0, groupCoinsCumulative: 36,  p1Coins: 57, p2Coins: 61, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 8  },
  },
  // ── Bloco 3 — Condição A (Aa) ────────────────────────────────────────────
  {
    input:    { block: 3, condition: 'A', trialInBlock: 1, stimulus: { endowment: 24, distributorDistribution: 12, receptorDistribution: 12, distributorCharacter: 'Theo',     receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 6,  distributorLost: 6,  culturalConsequence: 3, groupCoinsCumulative: 39,  p1Coins: 57, p2Coins: 61, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 8  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 2, stimulus: { endowment: 16, distributorDistribution: 12, receptorDistribution: 4,  distributorCharacter: 'Sofia',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 4,  distributorLost: 8,  culturalConsequence: 3, groupCoinsCumulative: 42,  p1Coins: 56, p2Coins: 60, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 8  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 3, stimulus: { endowment: 16, distributorDistribution: 8,  receptorDistribution: 8,  distributorCharacter: 'Olivia',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 4,  distributorLost: 4,  culturalConsequence: 0, groupCoinsCumulative: 42,  p1Coins: 56, p2Coins: 59, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 4, stimulus: { endowment: 12, distributorDistribution: 6,  receptorDistribution: 6,  distributorCharacter: 'Benjamin', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 3,  distributorLost: 3,  culturalConsequence: 3, groupCoinsCumulative: 45,  p1Coins: 56, p2Coins: 59, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 5, stimulus: { endowment: 4,  distributorDistribution: 3,  receptorDistribution: 1,  distributorCharacter: 'Maria',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 1,  distributorLost: 2,  culturalConsequence: 3, groupCoinsCumulative: 48,  p1Coins: 55, p2Coins: 58, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 6, stimulus: { endowment: 24, distributorDistribution: 18, receptorDistribution: 6,  distributorCharacter: 'David',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 6,  distributorLost: 12, culturalConsequence: 3, groupCoinsCumulative: 51,  p1Coins: 54, p2Coins: 57, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 7, stimulus: { endowment: 4,  distributorDistribution: 2,  receptorDistribution: 2,  distributorCharacter: 'Sarah',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 1,  distributorLost: 1,  culturalConsequence: 3, groupCoinsCumulative: 54,  p1Coins: 54, p2Coins: 57, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 8, stimulus: { endowment: 12, distributorDistribution: 9,  receptorDistribution: 3,  distributorCharacter: 'Phillip',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 3,  distributorLost: 6,  culturalConsequence: 3, groupCoinsCumulative: 57,  p1Coins: 53, p2Coins: 56, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 9, stimulus: { endowment: 32, distributorDistribution: 16, receptorDistribution: 16, distributorCharacter: 'Isaac',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 8,  distributorLost: 8,  culturalConsequence: 3, groupCoinsCumulative: 60,  p1Coins: 53, p2Coins: 56, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 10, stimulus: { endowment: 32, distributorDistribution: 24, receptorDistribution: 8,  distributorCharacter: 'Lucas',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 8,  distributorLost: 16, culturalConsequence: 3, groupCoinsCumulative: 63,  p1Coins: 52, p2Coins: 55, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 11, stimulus: { endowment: 20, distributorDistribution: 10, receptorDistribution: 10, distributorCharacter: 'Laura',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 5,  distributorLost: 5,  culturalConsequence: 3, groupCoinsCumulative: 66,  p1Coins: 52, p2Coins: 55, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 12, stimulus: { endowment: 8,  distributorDistribution: 4,  receptorDistribution: 4,  distributorCharacter: 'William',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 2,  distributorLost: 2,  culturalConsequence: 3, groupCoinsCumulative: 69,  p1Coins: 52, p2Coins: 55, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 13, stimulus: { endowment: 20, distributorDistribution: 15, receptorDistribution: 5,  distributorCharacter: 'Alice',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 5,  distributorLost: 10, culturalConsequence: 3, groupCoinsCumulative: 72,  p1Coins: 51, p2Coins: 54, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 14, stimulus: { endowment: 8,  distributorDistribution: 6,  receptorDistribution: 2,  distributorCharacter: 'Oliver',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 2,  distributorLost: 4,  culturalConsequence: 3, groupCoinsCumulative: 75,  p1Coins: 50, p2Coins: 53, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 15, stimulus: { endowment: 28, distributorDistribution: 21, receptorDistribution: 7,  distributorCharacter: 'Isabella', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 7,  distributorLost: 14, culturalConsequence: 3, groupCoinsCumulative: 78,  p1Coins: 49, p2Coins: 52, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 3, condition: 'A', trialInBlock: 16, stimulus: { endowment: 28, distributorDistribution: 14, receptorDistribution: 14, distributorCharacter: 'Cecilia',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 7,  distributorLost: 7,  culturalConsequence: 3, groupCoinsCumulative: 81,  p1Coins: 49, p2Coins: 52, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 9  },
  },
  // ── Bloco 4 — Condição C ──────────────────────────────────────────────────
  {
    input:    { block: 4, condition: 'C', trialInBlock: 1, stimulus: { endowment: 4,  distributorDistribution: 3,  receptorDistribution: 1,  distributorCharacter: 'Cecilia',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 1,  distributorLost: 2,  culturalConsequence: 3, groupCoinsCumulative: 84,  p1Coins: 48, p2Coins: 51, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 9  },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 2, stimulus: { endowment: 24, distributorDistribution: 12, receptorDistribution: 12, distributorCharacter: 'Sofia',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 6,  distributorLost: 6,  culturalConsequence: 0, groupCoinsCumulative: 84,  p1Coins: 48, p2Coins: 50, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 3, stimulus: { endowment: 24, distributorDistribution: 18, receptorDistribution: 6,  distributorCharacter: 'Olivia',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 6,  distributorLost: 12, culturalConsequence: 3, groupCoinsCumulative: 87,  p1Coins: 47, p2Coins: 49, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 4, stimulus: { endowment: 12, distributorDistribution: 6,  receptorDistribution: 6,  distributorCharacter: 'Maria',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 3,  distributorLost: 3,  culturalConsequence: 3, groupCoinsCumulative: 90,  p1Coins: 47, p2Coins: 49, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 5, stimulus: { endowment: 8,  distributorDistribution: 4,  receptorDistribution: 4,  distributorCharacter: 'Lucas',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 2,  distributorLost: 2,  culturalConsequence: 3, groupCoinsCumulative: 93,  p1Coins: 47, p2Coins: 49, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 6, stimulus: { endowment: 12, distributorDistribution: 9,  receptorDistribution: 3,  distributorCharacter: 'Sarah',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 3,  distributorLost: 6,  culturalConsequence: 3, groupCoinsCumulative: 96,  p1Coins: 46, p2Coins: 48, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 7, stimulus: { endowment: 20, distributorDistribution: 15, receptorDistribution: 5,  distributorCharacter: 'Benjamin', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 5,  distributorLost: 10, culturalConsequence: 3, groupCoinsCumulative: 99,  p1Coins: 45, p2Coins: 47, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 8, stimulus: { endowment: 16, distributorDistribution: 8,  receptorDistribution: 8,  distributorCharacter: 'Oliver',   receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 4,  distributorLost: 4,  culturalConsequence: 3, groupCoinsCumulative: 102, p1Coins: 45, p2Coins: 47, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 10 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 9, stimulus: { endowment: 20, distributorDistribution: 10, receptorDistribution: 10, distributorCharacter: 'Phillip',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 5,  distributorLost: 5,  culturalConsequence: 0, groupCoinsCumulative: 102, p1Coins: 44, p2Coins: 47, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 10, stimulus: { endowment: 16, distributorDistribution: 12, receptorDistribution: 4,  distributorCharacter: 'William',  receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 4,  distributorLost: 8,  culturalConsequence: 3, groupCoinsCumulative: 105, p1Coins: 43, p2Coins: 46, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 11, stimulus: { endowment: 28, distributorDistribution: 14, receptorDistribution: 14, distributorCharacter: 'Alice',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 7,  distributorLost: 7,  culturalConsequence: 3, groupCoinsCumulative: 108, p1Coins: 43, p2Coins: 46, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 12, stimulus: { endowment: 4,  distributorDistribution: 2,  receptorDistribution: 2,  distributorCharacter: 'Isabella', receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'NoPunish', p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 1,  distributorLost: 1,  culturalConsequence: 3, groupCoinsCumulative: 111, p1Coins: 43, p2Coins: 46, culturantLegacy: 'Cnp', disagreement: 0, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 13, stimulus: { endowment: 32, distributorDistribution: 24, receptorDistribution: 8,  distributorCharacter: 'Theo',     receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 8,  distributorLost: 16, culturalConsequence: 3, groupCoinsCumulative: 114, p1Coins: 42, p2Coins: 45, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 14, stimulus: { endowment: 8,  distributorDistribution: 6,  receptorDistribution: 2,  distributorCharacter: 'Isaac',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 2,  distributorLost: 4,  culturalConsequence: 3, groupCoinsCumulative: 117, p1Coins: 41, p2Coins: 44, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 15, stimulus: { endowment: 28, distributorDistribution: 21, receptorDistribution: 7,  distributorCharacter: 'Laura',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Unjust', p2Judgment: 'Unjust', p1Punishment: 'Punish',   p2Punishment: 'Punish'   } },
    expected: { distributorFinal: 7,  distributorLost: 14, culturalConsequence: 3, groupCoinsCumulative: 120, p1Coins: 40, p2Coins: 43, culturantLegacy: 'Cp',  disagreement: 0, disagreementCumulative: 11 },
  },
  {
    input:    { block: 4, condition: 'C', trialInBlock: 16, stimulus: { endowment: 32, distributorDistribution: 16, receptorDistribution: 16, distributorCharacter: 'David',    receptorCharacter: 'N/A' }, responses: { p1Judgment: 'Just',   p2Judgment: 'Just',   p1Punishment: 'Punish',   p2Punishment: 'NoPunish' } },
    expected: { distributorFinal: 8,  distributorLost: 8,  culturalConsequence: 0, groupCoinsCumulative: 120, p1Coins: 39, p2Coins: 43, culturantLegacy: 'D',   disagreement: 1, disagreementCumulative: 12 },
  },
];
