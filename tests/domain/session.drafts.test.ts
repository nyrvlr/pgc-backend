import { describe, expect, it } from 'vitest';
import {
  buildAttemptDrafts,
  SessionBootstrapError,
  type TrialTemplateWithStimulus,
} from '../../src/services/session.drafts';
import { SEQUENCE_MAP } from '../../src/domain/experiment.types';
import { RAW_STIMULI } from '../../src/prisma/seed-data';

// ---------------------------------------------------------------------------
// Fixture: gera templates sintéticos a partir de RAW_STIMULI
// Usa os dados reais de posição e estímulo — sem banco.
// ---------------------------------------------------------------------------

function makeTemplates(variant: 'ABAC' | 'ACAB' | 'BCBC' | 'CBCB'): TrialTemplateWithStimulus[] {
  return RAW_STIMULI.map(([blockNumber, trialInBlock, dist, endowment, dDist, rDist], i) => ({
    id: `tmpl-${variant}-${i}`,
    sequenceVariant: variant,
    blockNumber,
    trialInBlock,
    stimulus: {
      endowment,
      distributorDistribution: dDist,
      receptorDistribution: rDist,
      distributorCharacter: dist,
      receptorCharacter: `receptor-${dist}`, // par não precisa ser real para estes testes
    },
  }));
}

const SESSION_ID = 'session-test-001';

// ---------------------------------------------------------------------------
// Contagem e estrutura
// ---------------------------------------------------------------------------

describe('buildAttemptDrafts — contagem e estrutura', () => {
  it('gera exatamente 64 drafts para ABAC', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    expect(drafts.length).toBe(64);
  });

  it('gera exatamente 64 drafts para cada variante', () => {
    for (const variant of ['ABAC', 'ACAB', 'BCBC', 'CBCB'] as const) {
      const drafts = buildAttemptDrafts(SESSION_ID, variant, makeTemplates(variant));
      expect(drafts.length, `variante ${variant}`).toBe(64);
    }
  });

  it('gera 16 drafts por bloco', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    for (let b = 1; b <= 4; b++) {
      const count = drafts.filter(d => d.blockNumber === b).length;
      expect(count, `bloco ${b}`).toBe(16);
    }
  });

  it('todos os sessionId são iguais ao passado como argumento', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    expect(drafts.every(d => d.sessionId === SESSION_ID)).toBe(true);
  });

  it('todos os sessionSequenceVariant batem com a variante passada', () => {
    for (const variant of ['ABAC', 'ACAB', 'BCBC', 'CBCB'] as const) {
      const drafts = buildAttemptDrafts(SESSION_ID, variant, makeTemplates(variant));
      expect(drafts.every(d => d.sessionSequenceVariant === variant)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// globalNumber
// ---------------------------------------------------------------------------

describe('buildAttemptDrafts — globalNumber', () => {
  it('globalNumbers vão de 1 a 64 sem lacunas', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    const gns = drafts.map(d => d.globalNumber).sort((a, b) => a - b);
    expect(gns).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });

  it('globalNumber 16 = bloco 1 trial 16', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    const d = drafts.find(d => d.globalNumber === 16)!;
    expect(d.blockNumber).toBe(1);
    expect(d.trialInBlock).toBe(16);
  });

  it('globalNumber 17 = bloco 2 trial 1', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    const d = drafts.find(d => d.globalNumber === 17)!;
    expect(d.blockNumber).toBe(2);
    expect(d.trialInBlock).toBe(1);
  });

  it('globalNumber 64 = bloco 4 trial 16', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    const d = drafts.find(d => d.globalNumber === 64)!;
    expect(d.blockNumber).toBe(4);
    expect(d.trialInBlock).toBe(16);
  });

  it('formula globalNumber = (blockNumber-1)*16 + trialInBlock', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    for (const d of drafts) {
      expect(d.globalNumber).toBe((d.blockNumber - 1) * 16 + d.trialInBlock);
    }
  });
});

// ---------------------------------------------------------------------------
// Condições — derivadas de SEQUENCE_MAP, nunca duplicadas
// ---------------------------------------------------------------------------

describe('buildAttemptDrafts — condições por variante', () => {
  it.each([
    ['ABAC', ['A', 'B', 'A', 'C']],
    ['ACAB', ['A', 'C', 'A', 'B']],
    ['BCBC', ['B', 'C', 'B', 'C']],
    ['CBCB', ['C', 'B', 'C', 'B']],
  ] as const)('variante %s tem condições corretas por bloco', (variant, expectedConditions) => {
    const drafts = buildAttemptDrafts(SESSION_ID, variant, makeTemplates(variant));
    for (let b = 1; b <= 4; b++) {
      const blockDrafts = drafts.filter(d => d.blockNumber === b);
      const expectedCondition = expectedConditions[b - 1];
      expect(
        blockDrafts.every(d => d.condition === expectedCondition),
        `variante ${variant} bloco ${b} deve ser ${expectedCondition}`
      ).toBe(true);
    }
  });

  it('condições correspondem exatamente a SEQUENCE_MAP', () => {
    for (const variant of ['ABAC', 'ACAB', 'BCBC', 'CBCB'] as const) {
      const expectedConditions = SEQUENCE_MAP[variant];
      const drafts = buildAttemptDrafts(SESSION_ID, variant, makeTemplates(variant));
      for (let b = 1; b <= 4; b++) {
        const blockConditions = new Set(
          drafts.filter(d => d.blockNumber === b).map(d => d.condition)
        );
        expect(blockConditions.size).toBe(1);
        expect(blockConditions.has(expectedConditions[b - 1])).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Snapshot do estímulo
// ---------------------------------------------------------------------------

describe('buildAttemptDrafts — snapshot do estímulo', () => {
  it('snapshot de cada draft bate com o TrialTemplate correspondente', () => {
    const templates = makeTemplates('ABAC');
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', templates);
    for (const draft of drafts) {
      const tmpl = templates.find(t => t.id === draft.trialTemplateId)!;
      expect(draft.endowment).toBe(tmpl.stimulus.endowment);
      expect(draft.distributorDistribution).toBe(tmpl.stimulus.distributorDistribution);
      expect(draft.receptorDistribution).toBe(tmpl.stimulus.receptorDistribution);
      expect(draft.distributorCharacter).toBe(tmpl.stimulus.distributorCharacter);
      expect(draft.receptorCharacter).toBe(tmpl.stimulus.receptorCharacter);
    }
  });

  it('todos os (blockNumber, trialInBlock) são únicos', () => {
    const drafts = buildAttemptDrafts(SESSION_ID, 'ABAC', makeTemplates('ABAC'));
    const positions = drafts.map(d => `${d.blockNumber}|${d.trialInBlock}`);
    expect(new Set(positions).size).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// Validação — erros esperados
// ---------------------------------------------------------------------------

describe('buildAttemptDrafts — validação de invariantes', () => {
  it('lança SessionBootstrapError se templates.length !== 64', () => {
    const templates = makeTemplates('ABAC').slice(0, 63);
    expect(() => buildAttemptDrafts(SESSION_ID, 'ABAC', templates))
      .toThrowError(SessionBootstrapError);
  });

  it('lança SessionBootstrapError se algum bloco tiver menos de 16 templates', () => {
    const templates = makeTemplates('ABAC');
    // Remove uma entrada do bloco 2 e adiciona duplicata no bloco 1 para manter 64
    const bloco2Idx = templates.findIndex(t => t.blockNumber === 2);
    templates.splice(bloco2Idx, 1);
    const bloco1Template = { ...templates[0], id: 'extra' };
    templates.push(bloco1Template);
    expect(() => buildAttemptDrafts(SESSION_ID, 'ABAC', templates))
      .toThrowError(SessionBootstrapError);
  });

  it('lança SessionBootstrapError quando bloco tem trial duplicado + trial ausente (64 templates no total)', () => {
    const templates = makeTemplates('ABAC');
    // No bloco 1: remove trial 8, duplica trial 7 — total ainda é 64
    const removeIdx = templates.findIndex(t => t.blockNumber === 1 && t.trialInBlock === 8);
    templates.splice(removeIdx, 1);
    const dupSource = templates.find(t => t.blockNumber === 1 && t.trialInBlock === 7)!;
    templates.push({ ...dupSource, id: 'dup-trial7' });
    expect(templates.length).toBe(64); // confirma que o total não mudou
    expect(() => buildAttemptDrafts(SESSION_ID, 'ABAC', templates))
      .toThrowError(SessionBootstrapError);
  });

  it('lança SessionBootstrapError quando trialInBlock está fora de 1..16 (ex: 0)', () => {
    const templates = makeTemplates('ABAC');
    // No bloco 3: remove trial 16, adiciona trial 0 — total é 64 mas 0 é inválido
    const removeIdx = templates.findIndex(t => t.blockNumber === 3 && t.trialInBlock === 16);
    templates.splice(removeIdx, 1);
    const source = templates.find(t => t.blockNumber === 3 && t.trialInBlock === 1)!;
    templates.push({ ...source, id: 'invalid-trial', trialInBlock: 0 });
    expect(templates.length).toBe(64);
    expect(() => buildAttemptDrafts(SESSION_ID, 'ABAC', templates))
      .toThrowError(SessionBootstrapError);
  });

  it('lança SessionBootstrapError quando trialInBlock está fora de 1..16 (ex: 17)', () => {
    const templates = makeTemplates('ABAC');
    const removeIdx = templates.findIndex(t => t.blockNumber === 2 && t.trialInBlock === 16);
    templates.splice(removeIdx, 1);
    const source = templates.find(t => t.blockNumber === 2 && t.trialInBlock === 1)!;
    templates.push({ ...source, id: 'invalid-trial-17', trialInBlock: 17 });
    expect(templates.length).toBe(64);
    expect(() => buildAttemptDrafts(SESSION_ID, 'ABAC', templates))
      .toThrowError(SessionBootstrapError);
  });

  it('lança SessionBootstrapError quando template tem sequenceVariant diferente da sessão', () => {
    const templates = makeTemplates('ABAC');
    // Substitui a sequenceVariant de um template por outra variante
    const idx = templates.findIndex(t => t.blockNumber === 4 && t.trialInBlock === 1);
    templates[idx] = { ...templates[idx], sequenceVariant: 'ACAB', id: 'wrong-variant' };
    expect(() => buildAttemptDrafts(SESSION_ID, 'ABAC', templates))
      .toThrowError(SessionBootstrapError);
  });
});
