/**
 * session.drafts.ts
 * Função pura que gera os 64 drafts de Attempt a partir dos TrialTemplates
 * carregados do banco. Sem Prisma, sem efeitos colaterais.
 *
 * Separada do service para permitir testes unitários sem banco.
 */

import { SEQUENCE_MAP, type Condition, type SequenceVariant } from '../domain/experiment.types';

// ---------------------------------------------------------------------------
// Tipos de entrada e saída
// ---------------------------------------------------------------------------

/** Subconjunto do TrialTemplate com Stimulus incluído — shape do que o Prisma retorna */
export type TrialTemplateWithStimulus = {
  id: string;
  sequenceVariant: SequenceVariant;
  blockNumber: number;
  trialInBlock: number;
  stimulus: {
    endowment: number;
    distributorDistribution: number;
    receptorDistribution: number;
    distributorCharacter: string;
    receptorCharacter: string;
  };
};

/** Draft de um Attempt pronto para createMany — sem id ou timestamps */
export type AttemptDraft = {
  sessionId: string;
  sessionSequenceVariant: SequenceVariant;
  globalNumber: number;
  blockNumber: number;
  trialInBlock: number;
  condition: Condition;
  trialTemplateId: string;
  endowment: number;
  distributorDistribution: number;
  receptorDistribution: number;
  distributorCharacter: string;
  receptorCharacter: string;
};

// ---------------------------------------------------------------------------
// Erros de domínio
// ---------------------------------------------------------------------------

export class SessionBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionBootstrapError';
  }
}

// ---------------------------------------------------------------------------
// Função pura
// ---------------------------------------------------------------------------

/**
 * Gera os 64 AttemptDrafts a partir dos TrialTemplates da variante.
 *
 * Valida:
 * - exatamente 64 templates
 * - exatamente 4 blocos de 16
 * - condition derivada exclusivamente de SEQUENCE_MAP[variant][blockNumber - 1]
 *
 * Lança SessionBootstrapError se qualquer invariante for violada.
 */
export function buildAttemptDrafts(
  sessionId: string,
  sequenceVariant: SequenceVariant,
  templates: TrialTemplateWithStimulus[],
): AttemptDraft[] {
  if (templates.length !== 64) {
    throw new SessionBootstrapError(
      `Esperado 64 TrialTemplates para variante ${sequenceVariant}, encontrado ${templates.length}.`
    );
  }

  const conditions = SEQUENCE_MAP[sequenceVariant];

  // Valida sequenceVariant de cada template
  for (const t of templates) {
    if (t.sequenceVariant !== sequenceVariant) {
      throw new SessionBootstrapError(
        `Template ${t.id} tem sequenceVariant "${t.sequenceVariant}" mas a sessão usa "${sequenceVariant}".`
      );
    }
  }

  // Valida 4 blocos: exatamente trialInBlock 1..16, sem duplicatas nem lacunas
  for (let b = 1; b <= 4; b++) {
    const blockTemplates = templates.filter(t => t.blockNumber === b);
    if (blockTemplates.length !== 16) {
      throw new SessionBootstrapError(
        `Bloco ${b} da variante ${sequenceVariant} tem ${blockTemplates.length} templates (esperado 16).`
      );
    }
    const trialNumbers = blockTemplates.map(t => t.trialInBlock).sort((a, b) => a - b);
    const expected = Array.from({ length: 16 }, (_, i) => i + 1);
    const isValid = trialNumbers.every((n, i) => n === expected[i]);
    if (!isValid) {
      throw new SessionBootstrapError(
        `Bloco ${b} da variante ${sequenceVariant} tem trialInBlock inválidos: [${trialNumbers.join(', ')}]. Esperado 1..16 sem duplicatas nem lacunas.`
      );
    }
  }

  // Ordena por (blockNumber, trialInBlock) para globalNumber determinístico
  const sorted = [...templates].sort(
    (a, b) => a.blockNumber !== b.blockNumber
      ? a.blockNumber - b.blockNumber
      : a.trialInBlock - b.trialInBlock
  );

  return sorted.map((t) => {
    const condition = conditions[t.blockNumber - 1]; // SEQUENCE_MAP indexado 0..3
    const globalNumber = (t.blockNumber - 1) * 16 + t.trialInBlock;

    return {
      sessionId,
      sessionSequenceVariant: sequenceVariant,
      globalNumber,
      blockNumber: t.blockNumber,
      trialInBlock: t.trialInBlock,
      condition,
      trialTemplateId: t.id,
      endowment: t.stimulus.endowment,
      distributorDistribution: t.stimulus.distributorDistribution,
      receptorDistribution: t.stimulus.receptorDistribution,
      distributorCharacter: t.stimulus.distributorCharacter,
      receptorCharacter: t.stimulus.receptorCharacter,
    };
  });
}
