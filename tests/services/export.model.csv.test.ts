/**
 * export.model.csv.test.ts
 * Testa serializeModelExportCsv — sem banco, sem I/O.
 */

import { describe, expect, it } from 'vitest';
import { serializeModelExportCsv, MODEL_COLUMNS } from '../../src/services/export.model.csv';
import type { ExportRow } from '../../src/domain/export.contract';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    sessionId: 'sess-001', sessionName: 'Turma A',
    sequenceVariant: 'ABAC', sessionStatus: 'COMPLETED',
    p1ParticipantCode: 'G1P1', p2ParticipantCode: 'G1P2',
    globalNumber: 1, blockNumber: 1, trialInBlock: 1,
    condition: 'A',
    endowment: 16,
    distributorCharacter: 'Lucas', receptorCharacter: 'Isaac',
    distributorDistribution: 12, receptorDistribution: 4,   // Desigual
    p1Judgment: 'Unjust', p1JudgmentAt: new Date(),
    p1Punishment: 'Punish', p1PunishmentAt: new Date(),
    p1ResultAcknowledgedAt: new Date(),
    p2Judgment: 'Unjust', p2JudgmentAt: new Date(),
    p2Punishment: 'NoPunish', p2PunishmentAt: new Date(),
    p2ResultAcknowledgedAt: new Date(),
    consensus: false, culturant: 'D',
    p1IndividualCost: 1, p2IndividualCost: 0,
    punishmentApplied: false,
    distributorFinal: 4, distributorLost: 8,
    culturalConsequence: 0,
    p1CoinsAfter: 79, p2CoinsAfter: 80,
    groupCoinsAfter: 0, disagreementCountAfter: 1,
    attemptStartedAt: new Date(), attemptCompletedAt: new Date(),
    ...overrides,
  };
}

function fields(csv: string, lineIndex = 1): string[] {
  return csv.split('\n')[lineIndex].split(',');
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — cabeçalho', () => {
  it('[] retorna somente o cabeçalho sem \\n', () => {
    const csv = serializeModelExportCsv([]);
    expect(csv).toBe(MODEL_COLUMNS.join(','));
    expect(csv.includes('\n')).toBe(false);
  });

  it('cabeçalho contém exatamente 24 colunas', () => {
    const [header] = serializeModelExportCsv([makeRow()]).split('\n');
    expect(header.split(',').length).toBe(24);
  });

  it('ordem do cabeçalho é exatamente a especificada', () => {
    const [header] = serializeModelExportCsv([makeRow()]).split('\n');
    expect(header).toBe(MODEL_COLUMNS.join(','));
  });
});

// ---------------------------------------------------------------------------
// Mapeamento de Condition
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — Condition', () => {
  it('A no bloco 1 → A', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'A', blockNumber: 1 })]));
    expect(f[0]).toBe('A');
  });

  it('A no bloco 3 → Aa', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'A', blockNumber: 3 })]));
    expect(f[0]).toBe('Aa');
  });

  it('B → B', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'B', blockNumber: 2 })]));
    expect(f[0]).toBe('B');
  });

  it('C no bloco 4 → C (não vira Aa)', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'C', blockNumber: 4 })]));
    expect(f[0]).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// D Final e D Lost potenciais
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — D Final e D Lost potenciais', () => {
  it('desigual 12/4: D Final=4, D Lost=8', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 12, receptorDistribution: 4,
    })]));
    expect(f[6]).toBe('4');   // D Final
    expect(f[7]).toBe('8');   // D Lost
  });

  it('desigual 24/8: D Final=8, D Lost=16 (exemplo G1P1)', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 24, receptorDistribution: 8,
    })]));
    expect(f[6]).toBe('8');
    expect(f[7]).toBe('16');
  });

  it('igual 6/6: D Final=3, D Lost=3', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 6, receptorDistribution: 6,
    })]));
    expect(f[6]).toBe('3');
    expect(f[7]).toBe('3');
  });

  it('punishmentApplied=false não muda D Final/D Lost (valores potenciais)', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 12, receptorDistribution: 4,
      punishmentApplied: false,
    })]));
    expect(f[6]).toBe('4');   // D Final potencial
    expect(f[7]).toBe('8');   // D Lost potencial
  });
});

// ---------------------------------------------------------------------------
// Igual/Desigual
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — Igual/Desigual', () => {
  it('distribuições iguais → E', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 6, receptorDistribution: 6,
    })]));
    expect(f[8]).toBe('E');
  });

  it('distribuições desiguais → U', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 12, receptorDistribution: 4,
    })]));
    expect(f[8]).toBe('U');
  });
});

// ---------------------------------------------------------------------------
// Judgment (j/i) e Punishment (1/0)
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — judgment e punishment', () => {
  it('Just → j', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      p1Judgment: 'Just', p2Judgment: 'Just',
    })]));
    expect(f[9]).toBe('j');   // BOY = P1 judgment
    expect(f[10]).toBe('j');  // GIRL = P2 judgment
  });

  it('Unjust → i', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      p1Judgment: 'Unjust', p2Judgment: 'Unjust',
    })]));
    expect(f[9]).toBe('i');
    expect(f[10]).toBe('i');
  });

  it('null → vazio', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      p1Judgment: null, p2Judgment: null,
      p1Punishment: null, p2Punishment: null,
    })]));
    expect(f[9]).toBe('');    // P1 judgment
    expect(f[10]).toBe('');   // P2 judgment
    expect(f[11]).toBe('');   // P1 punishment
    expect(f[12]).toBe('');   // P2 punishment
  });

  it('Punish → 1, NoPunish → 0', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      p1Punishment: 'Punish', p2Punishment: 'NoPunish',
    })]));
    expect(f[11]).toBe('1');  // BOY = P1 punishment
    expect(f[12]).toBe('0');  // GIRL = P2 punishment
  });
});

// ---------------------------------------------------------------------------
// Norm P1 / Norm P2
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — Norm', () => {
  it('U + Unjust → SN', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 12, receptorDistribution: 4, // U
      p1Judgment: 'Unjust', p2Judgment: 'Unjust',
    })]));
    expect(f[15]).toBe('SN');  // Norm P1
    expect(f[16]).toBe('SN');  // Norm P2
  });

  it('E + Just → SN', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 6, receptorDistribution: 6, // E
      p1Judgment: 'Just', p2Judgment: 'Just',
    })]));
    expect(f[15]).toBe('SN');
    expect(f[16]).toBe('SN');
  });

  it('U + Just → NN', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 12, receptorDistribution: 4, // U
      p1Judgment: 'Just', p2Judgment: 'Just',
    })]));
    expect(f[15]).toBe('NN');
    expect(f[16]).toBe('NN');
  });

  it('E + Unjust → NN', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      distributorDistribution: 6, receptorDistribution: 6, // E
      p1Judgment: 'Unjust', p2Judgment: 'Unjust',
    })]));
    expect(f[15]).toBe('NN');
    expect(f[16]).toBe('NN');
  });

  it('null judgment → vazio', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      p1Judgment: null, p2Judgment: null,
    })]));
    expect(f[15]).toBe('');
    expect(f[16]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// D (indicator de desacordo) e D Cumulated
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — D e D Cumulated', () => {
  it('culturant=D → D=1', () => {
    const f = fields(serializeModelExportCsv([makeRow({ culturant: 'D' })]));
    expect(f[20]).toBe('1');
  });

  it('culturant=Cp → D=0', () => {
    const f = fields(serializeModelExportCsv([makeRow({ culturant: 'Cp' })]));
    expect(f[20]).toBe('0');
  });

  it('culturant=null → D vazio', () => {
    const f = fields(serializeModelExportCsv([makeRow({ culturant: null })]));
    expect(f[20]).toBe('');
  });

  it('disagreementCountAfter=3 → D Cumulated=3', () => {
    const f = fields(serializeModelExportCsv([makeRow({ disagreementCountAfter: 3 })]));
    expect(f[21]).toBe('3');
  });

  it('disagreementCountAfter=null → D Cumulated vazio', () => {
    const f = fields(serializeModelExportCsv([makeRow({ disagreementCountAfter: null })]));
    expect(f[21]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// APtype
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — APtype', () => {
  it('sem culturant → APtype vazio', () => {
    const f = fields(serializeModelExportCsv([makeRow({ culturant: null })]));
    expect(f[22]).toBe('');
  });

  it('A + Cp → APa', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'A', blockNumber: 1, culturant: 'Cp' })]));
    expect(f[22]).toBe('APa');
  });

  it('A + Cnp → APa', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'A', blockNumber: 1, culturant: 'Cnp' })]));
    expect(f[22]).toBe('APa');
  });

  it('A + D → D', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'A', blockNumber: 1, culturant: 'D' })]));
    expect(f[22]).toBe('D');
  });

  it('Aa (A bloco 3) + Cp → APa', () => {
    const f = fields(serializeModelExportCsv([makeRow({ condition: 'A', blockNumber: 3, culturant: 'Cp' })]));
    expect(f[22]).toBe('APa');
  });

  it('B + U + Cnp → APb', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'B', blockNumber: 2,
      distributorDistribution: 12, receptorDistribution: 4, // U
      culturant: 'Cnp',
    })]));
    expect(f[22]).toBe('APb');
  });

  it('B + E + Cp → APb', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'B', blockNumber: 2,
      distributorDistribution: 6, receptorDistribution: 6, // E
      culturant: 'Cp',
    })]));
    expect(f[22]).toBe('APb');
  });

  it('B + D → APd', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'B', blockNumber: 2, culturant: 'D',
    })]));
    expect(f[22]).toBe('APd');
  });

  it('B + U + Cp → APd (não é APb)', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'B', blockNumber: 2,
      distributorDistribution: 12, receptorDistribution: 4, // U
      culturant: 'Cp',
    })]));
    expect(f[22]).toBe('APd');
  });

  it('C + E + Cnp → APc', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'C', blockNumber: 4,
      distributorDistribution: 6, receptorDistribution: 6, // E
      culturant: 'Cnp',
    })]));
    expect(f[22]).toBe('APc');
  });

  it('C + U + Cp → APc', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'C', blockNumber: 4,
      distributorDistribution: 12, receptorDistribution: 4, // U
      culturant: 'Cp',
    })]));
    expect(f[22]).toBe('APc');
  });

  it('C + D → APd', () => {
    const f = fields(serializeModelExportCsv([makeRow({
      condition: 'C', blockNumber: 4, culturant: 'D',
    })]));
    expect(f[22]).toBe('APd');
  });
});

// ---------------------------------------------------------------------------
// COMENTÁRIOS sempre vazio
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — COMENTÁRIOS', () => {
  it('campo COMENTÁRIOS é sempre vazio', () => {
    const f = fields(serializeModelExportCsv([makeRow()]));
    expect(f[23]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Linha de dados tem 24 campos
// ---------------------------------------------------------------------------

describe('serializeModelExportCsv — estrutura', () => {
  it('linha de dados tem exatamente 24 campos', () => {
    const f = fields(serializeModelExportCsv([makeRow()]));
    expect(f.length).toBe(24);
  });

  it('múltiplas linhas geram múltiplas linhas de dados', () => {
    const csv = serializeModelExportCsv([makeRow({ trialInBlock: 1 }), makeRow({ trialInBlock: 2 })]);
    expect(csv.split('\n').length).toBe(3); // header + 2 data
  });
});
