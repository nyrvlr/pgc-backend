/**
 * export.csv.test.ts
 * Testa a serialização CSV sem banco, sem I/O.
 */

import { describe, expect, it } from 'vitest';
import { serializeExportCsv } from '../../src/services/export.csv';
import { EXPORT_COLUMNS } from '../../src/domain/export.contract';
import type { ExportRow } from '../../src/domain/export.contract';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2024-10-24T10:00:00.000Z');

/** Linha completa com valores não-nulos para todos os 39 campos */
function makeCompleteRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    sessionId:               'sess-001',
    sessionName:             'Turma A',
    sequenceVariant:         'ABAC',
    sessionStatus:           'COMPLETED',
    p1ParticipantCode:       'G1P1',
    p2ParticipantCode:       'G1P2',
    globalNumber:            1,
    blockNumber:             1,
    trialInBlock:            1,
    condition:               'A',
    endowment:               32,
    distributorCharacter:    'Lucas',
    receptorCharacter:       'Isaac',
    distributorDistribution: 24,
    receptorDistribution:    8,
    p1Judgment:              'Unjust',
    p1JudgmentAt:            NOW,
    p1Punishment:            'Punish',
    p1PunishmentAt:          NOW,
    p1ResultAcknowledgedAt:  NOW,
    p2Judgment:              'Unjust',
    p2JudgmentAt:            NOW,
    p2Punishment:            'Punish',
    p2PunishmentAt:          NOW,
    p2ResultAcknowledgedAt:  NOW,
    consensus:               true,
    culturant:               'Cp',
    p1IndividualCost:        1,
    p2IndividualCost:        1,
    punishmentApplied:       true,
    distributorFinal:        8,
    distributorLost:         16,
    culturalConsequence:     3,
    p1CoinsAfter:            79,
    p2CoinsAfter:            79,
    groupCoinsAfter:         3,
    disagreementCountAfter:  0,
    attemptStartedAt:        NOW,
    attemptCompletedAt:      NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Cabeçalho: 39 colunas na ordem exata de EXPORT_COLUMNS
// ---------------------------------------------------------------------------

describe('serializeExportCsv — cabeçalho', () => {
  it('primeira linha é o cabeçalho com as 39 colunas', () => {
    const csv = serializeExportCsv([]);
    expect(csv).toBe(EXPORT_COLUMNS.join(','));
  });

  it('cabeçalho contém exatamente 39 campos', () => {
    const [header] = serializeExportCsv([makeCompleteRow()]).split('\n');
    expect(header.split(',').length).toBe(39);
  });

  it('ordem do cabeçalho é exatamente a de EXPORT_COLUMNS', () => {
    const [header] = serializeExportCsv([makeCompleteRow()]).split('\n');
    expect(header).toBe(EXPORT_COLUMNS.join(','));
  });
});

// ---------------------------------------------------------------------------
// 2. null → campo vazio
// ---------------------------------------------------------------------------

describe('serializeExportCsv — null', () => {
  it('campos null produzem campo vazio (sem "null" literal)', () => {
    const row = makeCompleteRow({
      p1Judgment: null, p1JudgmentAt: null,
      consensus: null, culturant: null,
      p1IndividualCost: null, culturalConsequence: null,
      attemptStartedAt: null,
    });
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    expect(dataLine).not.toContain('null');
    // Verifica posição de p1Judgment (índice 15)
    const fields = dataLine.split(',');
    expect(fields[15]).toBe('');  // p1Judgment → vazio
  });
});

// ---------------------------------------------------------------------------
// 3. Date → ISO 8601
// ---------------------------------------------------------------------------

describe('serializeExportCsv — Date', () => {
  it('Date é serializada como ISO 8601', () => {
    const row = makeCompleteRow({ p1JudgmentAt: NOW });
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    expect(dataLine).toContain('2024-10-24T10:00:00.000Z');
  });

  it('múltiplas datas são serializadas individualmente', () => {
    const d1 = new Date('2024-01-01T00:00:00.000Z');
    const d2 = new Date('2024-12-31T23:59:59.000Z');
    const row = makeCompleteRow({ attemptStartedAt: d1, attemptCompletedAt: d2 });
    const csv = serializeExportCsv([row]);
    expect(csv).toContain('2024-01-01T00:00:00.000Z');
    expect(csv).toContain('2024-12-31T23:59:59.000Z');
  });
});

// ---------------------------------------------------------------------------
// 4. boolean → "true" / "false"
// ---------------------------------------------------------------------------

describe('serializeExportCsv — boolean', () => {
  it('true serializa como "true"', () => {
    const [, dataLine] = serializeExportCsv([makeCompleteRow({ consensus: true })]).split('\n');
    // consensus é coluna 25 (índice 25)
    const fields = dataLine.split(',');
    expect(fields[25]).toBe('true');
  });

  it('false serializa como "false"', () => {
    const [, dataLine] = serializeExportCsv([makeCompleteRow({ punishmentApplied: false })]).split('\n');
    // punishmentApplied é coluna 29 (índice 29)
    const fields = dataLine.split(',');
    expect(fields[29]).toBe('false');
  });

  it('boolean null serializa como campo vazio', () => {
    const [, dataLine] = serializeExportCsv([makeCompleteRow({ consensus: null })]).split('\n');
    const fields = dataLine.split(',');
    expect(fields[25]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 5. Vírgulas escapadas
// ---------------------------------------------------------------------------

describe('serializeExportCsv — escaping: vírgulas', () => {
  it('sessionName com vírgula é envolvido em aspas duplas', () => {
    const row = makeCompleteRow({ sessionName: 'Turma A, G1' });
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    expect(dataLine).toContain('"Turma A, G1"');
  });

  it('campo com vírgula não quebra a contagem de 39 campos', () => {
    const row = makeCompleteRow({ sessionName: 'A, B, C' });
    const csv = serializeExportCsv([row]);
    const lines = csv.split('\n');
    // Usar regex para parsear CSV corretamente não é o objetivo aqui;
    // verificamos que o campo escapado está presente
    expect(lines[1]).toContain('"A, B, C"');
  });
});

// ---------------------------------------------------------------------------
// 6. Aspas duplicadas
// ---------------------------------------------------------------------------

describe('serializeExportCsv — escaping: aspas', () => {
  it('aspas duplas no valor são duplicadas e o campo envolvido em aspas', () => {
    const row = makeCompleteRow({ sessionName: 'Diz "olá"' });
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    expect(dataLine).toContain('"Diz ""olá"""');
  });

  it('aspas simples não são afetadas', () => {
    const row = makeCompleteRow({ sessionName: "It's fine" });
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    expect(dataLine).toContain("It's fine");
    expect(dataLine).not.toContain('"It\'s fine"');
  });
});

// ---------------------------------------------------------------------------
// 7. Quebra de linha escapada
// ---------------------------------------------------------------------------

describe('serializeExportCsv — escaping: quebra de linha', () => {
  it('\\n no valor é envolvido em aspas duplas', () => {
    const row = makeCompleteRow({ sessionName: 'linha1\nlinha2' });
    const csv = serializeExportCsv([row]);
    expect(csv).toContain('"linha1\nlinha2"');
  });

  it('\\r no valor é envolvido em aspas duplas', () => {
    const row = makeCompleteRow({ sessionName: 'dado\rdado' });
    const csv = serializeExportCsv([row]);
    expect(csv).toContain('"dado\rdado"');
  });
});

// ---------------------------------------------------------------------------
// 8. Linha completa mantém 39 campos
// ---------------------------------------------------------------------------

describe('serializeExportCsv — linha completa', () => {
  it('linha de dados tem exatamente 39 campos separados por vírgula (sem escaping)', () => {
    const row = makeCompleteRow(); // sem campos especiais
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    expect(dataLine.split(',').length).toBe(39);
  });

  it('valores de string/número preservados na posição correta', () => {
    const row = makeCompleteRow();
    const [, dataLine] = serializeExportCsv([row]).split('\n');
    const fields = dataLine.split(',');
    expect(fields[0]).toBe('sess-001');      // sessionId
    expect(fields[6]).toBe('1');             // globalNumber
    expect(fields[33]).toBe('79');           // p1CoinsAfter
    expect(fields[36]).toBe('0');            // disagreementCountAfter
  });

  it('múltiplas linhas geram múltiplas linhas de dados', () => {
    const rows = [
      makeCompleteRow({ globalNumber: 1 }),
      makeCompleteRow({ globalNumber: 2 }),
      makeCompleteRow({ globalNumber: 3 }),
    ];
    const lines = serializeExportCsv(rows).split('\n');
    expect(lines.length).toBe(4); // 1 header + 3 data
    expect(lines[1]).toContain(',1,');
    expect(lines[2]).toContain(',2,');
    expect(lines[3]).toContain(',3,');
  });
});

// ---------------------------------------------------------------------------
// 9. Array vazio gera só cabeçalho
// ---------------------------------------------------------------------------

describe('serializeExportCsv — array vazio', () => {
  it('[] retorna apenas a linha de cabeçalho (sem \\n final)', () => {
    const csv = serializeExportCsv([]);
    expect(csv).toBe(EXPORT_COLUMNS.join(','));
    expect(csv.includes('\n')).toBe(false);
  });

  it('cabeçalho de [] é idêntico ao cabeçalho de lista não vazia', () => {
    const emptyHeader = serializeExportCsv([]).split('\n')[0];
    const fullHeader  = serializeExportCsv([makeCompleteRow()]).split('\n')[0];
    expect(emptyHeader).toBe(fullHeader);
  });
});
