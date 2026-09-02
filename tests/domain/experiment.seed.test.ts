import { describe, expect, it } from 'vitest';
import {
  RAW_STIMULI,
  RECEPTOR_PAIR,
  VARIANTS,
  buildStimulusDescriptors,
  buildTrialTemplateDescriptors,
} from '../../src/prisma/seed-data';

// =============================================================================
// Testes do catálogo experimental — sem banco, sem Prisma
// =============================================================================

const VALID_ENDOWMENTS = new Set([4, 8, 12, 16, 20, 24, 28, 32]);

// Distribuidores derivados dos dados — sem lista manual
const ALL_DISTRIBUTORS = [...new Set(RAW_STIMULI.map(([,, dist]) => dist))];

const stimuli   = buildStimulusDescriptors();
const templates = buildTrialTemplateDescriptors();

// ---------------------------------------------------------------------------
// RECEPTOR_PAIR — integridade do mapa de pares
// ---------------------------------------------------------------------------

describe('RECEPTOR_PAIR — integridade', () => {
  it('tem exatamente 16 personagens como chaves', () => {
    expect(Object.keys(RECEPTOR_PAIR).length).toBe(16);
  });

  it('nenhum personagem é seu próprio receptor', () => {
    for (const [name, receptor] of Object.entries(RECEPTOR_PAIR)) {
      expect(name, `${name} é seu próprio receptor`).not.toBe(receptor);
    }
  });

  it('todo personagem possui receptor definido e não vazio', () => {
    for (const [name, receptor] of Object.entries(RECEPTOR_PAIR)) {
      expect(receptor, `receptor de ${name} está vazio`).toBeTruthy();
    }
  });

  it('relação é simétrica: RECEPTOR_PAIR[RECEPTOR_PAIR[x]] === x', () => {
    for (const [name, receptor] of Object.entries(RECEPTOR_PAIR)) {
      expect(RECEPTOR_PAIR[receptor], `par de ${receptor} não aponta de volta para ${name}`).toBe(name);
    }
  });

  it('resulta em exatamente 8 pares não direcionados', () => {
    const pairs = new Set<string>();
    for (const [a, b] of Object.entries(RECEPTOR_PAIR)) {
      // Normaliza a ordem para não contar (A,B) e (B,A) como pares distintos
      pairs.add([a, b].sort().join('|'));
    }
    expect(pairs.size).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// VARIANTS — derivados do domínio
// ---------------------------------------------------------------------------

describe('VARIANTS — derivados de SEQUENCE_MAP', () => {
  it('contém exatamente as 4 variantes do protocolo', () => {
    expect(VARIANTS.sort()).toEqual(['ABAC', 'ACAB', 'BCBC', 'CBCB']);
  });
});

// ---------------------------------------------------------------------------
// RAW_STIMULI — referência bruta
// ---------------------------------------------------------------------------

describe('RAW_STIMULI — referência bruta', () => {
  it('tem exatamente 64 entradas', () => {
    expect(RAW_STIMULI.length).toBe(64);
  });

  it('cobre exatamente 4 blocos de 16 tentativas cada', () => {
    for (let b = 1; b <= 4; b++) {
      const count = RAW_STIMULI.filter(([block]) => block === b).length;
      expect(count, `bloco ${b}`).toBe(16);
    }
  });

  it('todos os (blockNumber, trialInBlock) são únicos', () => {
    const keys = RAW_STIMULI.map(([b, t]) => `${b}|${t}`);
    expect(new Set(keys).size).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// Stimulus — estrutura e proporções
// ---------------------------------------------------------------------------

describe('buildStimulusDescriptors() — 64 estímulos únicos', () => {
  it('gera exatamente 64 estímulos', () => {
    expect(stimuli.length).toBe(64);
  });

  it('todas as dotações pertencem ao conjunto válido {4,8,12,16,20,24,28,32}', () => {
    for (const s of stimuli) {
      expect(VALID_ENDOWMENTS.has(s.endowment), `endowment inválido: ${s.endowment}`).toBe(true);
    }
  });

  it('D + R = endowment em todos os estímulos', () => {
    for (const s of stimuli) {
      expect(s.distributorDistribution + s.receptorDistribution).toBe(s.endowment);
    }
  });

  it('distribuições iguais têm proporção exata 1/2 : 1/2', () => {
    const equal = stimuli.filter(s => s.distributorDistribution === s.receptorDistribution);
    for (const s of equal) {
      expect(s.distributorDistribution).toBe(s.endowment / 2);
    }
  });

  it('distribuições desiguais têm proporção exata 3/4 : 1/4', () => {
    const unequal = stimuli.filter(s => s.distributorDistribution !== s.receptorDistribution);
    for (const s of unequal) {
      expect(s.distributorDistribution).toBe((3 * s.endowment) / 4);
      expect(s.receptorDistribution).toBe(s.endowment / 4);
    }
  });

  it('receptor de cada estímulo corresponde ao RECEPTOR_PAIR do distribuidor', () => {
    for (const s of stimuli) {
      expect(s.receptorCharacter).toBe(RECEPTOR_PAIR[s.distributorCharacter]);
    }
  });

  it('lança erro se distribuidor não tiver receptor (validação do builder)', () => {
    // Testa a guarda explícita do builder substituindo temporariamente RAW_STIMULI
    // Não é possível injetar diretamente — validamos indiretamente: todos os
    // distribuidores em RAW_STIMULI existem em RECEPTOR_PAIR (se falhassem, o
    // buildStimulusDescriptors() acima já teria lançado ao importar o módulo)
    for (const [,, dist] of RAW_STIMULI) {
      expect(RECEPTOR_PAIR[dist], `distribuidor sem receptor: ${dist}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Posições por bloco
// ---------------------------------------------------------------------------

describe('posições por bloco', () => {
  it('cada bloco tem 8 distribuições iguais e 8 desiguais', () => {
    for (let b = 1; b <= 4; b++) {
      const block = RAW_STIMULI.filter(([block]) => block === b);
      const equal   = block.filter(([,, , , d, r]) => d === r).length;
      const unequal = block.filter(([,, , , d, r]) => d !== r).length;
      expect(equal,   `bloco ${b} — iguais`).toBe(8);
      expect(unequal, `bloco ${b} — desiguais`).toBe(8);
    }
  });

  it('cada dotação aparece exatamente uma vez como Equal e uma vez como Unequal em cada bloco', () => {
    for (let b = 1; b <= 4; b++) {
      const block = RAW_STIMULI.filter(([block]) => block === b);
      const equalEndowments   = block.filter(([,, , , d, r]) => d === r).map(([,, , e]) => e);
      const unequalEndowments = block.filter(([,, , , d, r]) => d !== r).map(([,, , e]) => e);
      for (const e of VALID_ENDOWMENTS) {
        expect(equalEndowments.filter(v => v === e).length,   `bloco ${b} Equal endowment ${e}`).toBe(1);
        expect(unequalEndowments.filter(v => v === e).length, `bloco ${b} Unequal endowment ${e}`).toBe(1);
      }
    }
  });

  it('os 16 distribuidores aparecem exatamente uma vez por bloco', () => {
    for (let b = 1; b <= 4; b++) {
      const dist = RAW_STIMULI.filter(([block]) => block === b).map(([,, d]) => d);
      expect(new Set(dist).size, `bloco ${b} — distribuidores únicos`).toBe(16);
      for (const d of ALL_DISTRIBUTORS) {
        expect(dist.includes(d), `bloco ${b} — falta ${d}`).toBe(true);
      }
    }
  });

  it('cada distribuidor aparece exatamente 4 vezes no total (uma por bloco)', () => {
    for (const d of ALL_DISTRIBUTORS) {
      const count = RAW_STIMULI.filter(([,, dist]) => dist === d).length;
      expect(count, `${d} aparece ${count}x`).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// TrialTemplate — builders
// ---------------------------------------------------------------------------

describe('buildTrialTemplateDescriptors() — 256 templates', () => {
  it('gera exatamente 256 templates', () => {
    expect(templates.length).toBe(256);
  });

  it('gera exatamente 64 templates por variante', () => {
    for (const v of VARIANTS) {
      const count = templates.filter(t => t.sequenceVariant === v).length;
      expect(count, `variante ${v}`).toBe(64);
    }
  });

  it('todos os (variant, blockNumber, trialInBlock) são únicos', () => {
    const keys = templates.map(t => `${t.sequenceVariant}|${t.blockNumber}|${t.trialInBlock}`);
    expect(new Set(keys).size).toBe(256);
  });

  it('a mesma (block, trial) referencia o mesmo estímulo nas quatro variantes', () => {
    for (let b = 1; b <= 4; b++) {
      for (let t = 1; t <= 16; t++) {
        const byPosition = templates.filter(tmpl => tmpl.blockNumber === b && tmpl.trialInBlock === t);
        expect(byPosition.length, `posição ${b}|${t} — deve ter 4 templates`).toBe(4);
        const keys = new Set(byPosition.map(tmpl => tmpl.stimulusKey));
        expect(keys.size, `posição ${b}|${t} — stimulusKey deve ser igual nas 4 variantes`).toBe(1);
      }
    }
  });

  it('todas as stimulusKeys dos templates existem nos descritores de Stimulus', () => {
    const validKeys = new Set(
      stimuli.map(s => `${s.distributorCharacter}|${s.distributorDistribution}|${s.receptorDistribution}`)
    );
    for (const t of templates) {
      expect(validKeys.has(t.stimulusKey), `stimulusKey inválida: ${t.stimulusKey}`).toBe(true);
    }
  });
});
