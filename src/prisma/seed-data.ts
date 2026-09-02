/**
 * seed-data.ts
 * Fonte única de verdade dos dados do catálogo experimental.
 *
 * Fonte original: G1_P1_24_10_2024.xlsx — aba G1P1.
 *
 * ASSUNÇÃO DO MVP:
 * A ordem dos 64 estímulos (blockNumber × trialInBlock → Stimulus) é assumida
 * idêntica nas variantes ABAC, ACAB, BCBC e CBCB. O que muda entre variantes é
 * apenas a sequência de condições dos 4 blocos. Esta assunção foi adotada por
 * ausência dos arquivos originais das demais variantes e deve ser revisada
 * quando esses arquivos estiverem disponíveis.
 *
 * Este módulo não importa Prisma. É puro TypeScript sem dependências externas,
 * exceto pelo import de SEQUENCE_MAP do domínio validado.
 */

import { SEQUENCE_MAP, type SequenceVariant } from '../domain/experiment.types';

// ---------------------------------------------------------------------------
// Variantes derivadas do domínio — única fonte de verdade para ABAC|ACAB|BCBC|CBCB
// ---------------------------------------------------------------------------

export type { SequenceVariant };
export const VARIANTS = Object.keys(SEQUENCE_MAP) as SequenceVariant[];

// ---------------------------------------------------------------------------
// Pares fixos de personagens (protocolo experimental)
// ---------------------------------------------------------------------------

export const RECEPTOR_PAIR: Record<string, string> = {
  Alice:    'Laura',    Laura:    'Alice',
  David:    'Theo',     Theo:     'David',
  Cecilia:  'Isabella', Isabella: 'Cecilia',
  Maria:    'Sarah',    Sarah:    'Maria',
  Olivia:   'Sofia',   Sofia:    'Olivia',
  Lucas:    'Isaac',   Isaac:    'Lucas',
  Oliver:   'William', William:  'Oliver',
  Phillip:  'Benjamin', Benjamin: 'Phillip',
};

// ---------------------------------------------------------------------------
// Referência dos 64 estímulos extraída da planilha G1P1
// [blockNumber, trialInBlock, distributorChar, endowment, dDist, rDist]
// ---------------------------------------------------------------------------

export type RawStimulusRow = [number, number, string, number, number, number];

export const RAW_STIMULI: RawStimulusRow[] = [
  // Bloco 1
  [1,  1, 'Lucas',    16, 12,  4],
  [1,  2, 'Alice',     4,  3,  1],
  [1,  3, 'Cecilia',  12,  6,  6],
  [1,  4, 'David',     8,  6,  2],
  [1,  5, 'Laura',     4,  2,  2],
  [1,  6, 'Maria',    20, 15,  5],
  [1,  7, 'Sarah',    20, 10, 10],
  [1,  8, 'Isabella', 12,  9,  3],
  [1,  9, 'Olivia',   32, 16, 16],
  [1, 10, 'Theo',      8,  4,  4],
  [1, 11, 'Oliver',   24, 18,  6],
  [1, 12, 'Phillip',  28, 21,  7],
  [1, 13, 'William',  24, 12, 12],
  [1, 14, 'Sofia',    32, 24,  8],
  [1, 15, 'Benjamin', 28, 14, 14],
  [1, 16, 'Isaac',    16,  8,  8],
  // Bloco 2
  [2,  1, 'Cecilia',  20, 15,  5],
  [2,  2, 'Isaac',    24, 18,  6],
  [2,  3, 'Alice',    12,  6,  6],
  [2,  4, 'Isabella', 20, 10, 10],
  [2,  5, 'William',  32, 24,  8],
  [2,  6, 'David',    16,  8,  8],
  [2,  7, 'Laura',    12,  9,  3],
  [2,  8, 'Olivia',    8,  6,  2],
  [2,  9, 'Lucas',    24, 12, 12],
  [2, 10, 'Oliver',   32, 16, 16],
  [2, 11, 'Sofia',     8,  4,  4],
  [2, 12, 'Benjamin',  4,  3,  1],
  [2, 13, 'Theo',     16, 12,  4],
  [2, 14, 'Maria',    28, 14, 14],
  [2, 15, 'Phillip',   4,  2,  2],
  [2, 16, 'Sarah',    28, 21,  7],
  // Bloco 3
  [3,  1, 'Theo',     24, 12, 12],
  [3,  2, 'Sofia',    16, 12,  4],
  [3,  3, 'Olivia',   16,  8,  8],
  [3,  4, 'Benjamin', 12,  6,  6],
  [3,  5, 'Maria',     4,  3,  1],
  [3,  6, 'David',    24, 18,  6],
  [3,  7, 'Sarah',     4,  2,  2],
  [3,  8, 'Phillip',  12,  9,  3],
  [3,  9, 'Isaac',    32, 16, 16],
  [3, 10, 'Lucas',    32, 24,  8],
  [3, 11, 'Laura',    20, 10, 10],
  [3, 12, 'William',   8,  4,  4],
  [3, 13, 'Alice',    20, 15,  5],
  [3, 14, 'Oliver',    8,  6,  2],
  [3, 15, 'Isabella', 28, 21,  7],
  [3, 16, 'Cecilia',  28, 14, 14],
  // Bloco 4
  [4,  1, 'Cecilia',   4,  3,  1],
  [4,  2, 'Sofia',    24, 12, 12],
  [4,  3, 'Olivia',   24, 18,  6],
  [4,  4, 'Maria',    12,  6,  6],
  [4,  5, 'Lucas',     8,  4,  4],
  [4,  6, 'Sarah',    12,  9,  3],
  [4,  7, 'Benjamin', 20, 15,  5],
  [4,  8, 'Oliver',   16,  8,  8],
  [4,  9, 'Phillip',  20, 10, 10],
  [4, 10, 'William',  16, 12,  4],
  [4, 11, 'Alice',    28, 14, 14],
  [4, 12, 'Isabella',  4,  2,  2],
  [4, 13, 'Theo',     32, 24,  8],
  [4, 14, 'Isaac',     8,  6,  2],
  [4, 15, 'Laura',    28, 21,  7],
  [4, 16, 'David',    32, 16, 16],
];

// ---------------------------------------------------------------------------
// Tipos de descritor (sem Prisma)
// ---------------------------------------------------------------------------

export type StimulusDescriptor = {
  endowment: number;
  distributorDistribution: number;
  receptorDistribution: number;
  distributorCharacter: string;
  receptorCharacter: string;
  upsertKey: { distributorCharacter: string; distributorDistribution: number; receptorDistribution: number };
};

export type TrialTemplateDescriptor = {
  sequenceVariant: SequenceVariant;
  blockNumber: number;
  trialInBlock: number;
  stimulusKey: string;
};

// ---------------------------------------------------------------------------
// Builders puros
// ---------------------------------------------------------------------------

/**
 * Gera os 64 descritores de Stimulus únicos a partir de RAW_STIMULI.
 * Lança erro explícito se algum distribuidor não tiver receptor em RECEPTOR_PAIR.
 */
export function buildStimulusDescriptors(): StimulusDescriptor[] {
  const seen = new Set<string>();
  const result: StimulusDescriptor[] = [];

  for (const [blockNumber, trialInBlock, dist, endowment, dDist, rDist] of RAW_STIMULI) {
    const receptorChar = RECEPTOR_PAIR[dist];
    if (receptorChar === undefined) {
      throw new Error(
        `Distribuidor sem receptor definido: "${dist}" (bloco ${blockNumber}, tentativa ${trialInBlock}). ` +
        `Adicione o par em RECEPTOR_PAIR antes de continuar.`
      );
    }

    const key = `${dist}|${dDist}|${rDist}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        endowment,
        distributorDistribution: dDist,
        receptorDistribution: rDist,
        distributorCharacter: dist,
        receptorCharacter: receptorChar,
        upsertKey: { distributorCharacter: dist, distributorDistribution: dDist, receptorDistribution: rDist },
      });
    }
  }

  return result;
}

/**
 * Gera os 256 descritores de TrialTemplate (4 variantes × 64 posições).
 * Cada posição (blockNumber, trialInBlock) aponta para a mesma chave de Stimulus
 * em todas as variantes — assunção MVP de ordem compartilhada.
 */
export function buildTrialTemplateDescriptors(): TrialTemplateDescriptor[] {
  const result: TrialTemplateDescriptor[] = [];

  for (const variant of VARIANTS) {
    for (const [blockNumber, trialInBlock, dist, , dDist, rDist] of RAW_STIMULI) {
      result.push({
        sequenceVariant: variant,
        blockNumber,
        trialInBlock,
        stimulusKey: `${dist}|${dDist}|${rDist}`,
      });
    }
  }

  return result;
}
