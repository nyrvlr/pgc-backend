/**
 * export.contract.test.ts
 * Valida o contrato de exportação científica — sem banco, sem I/O.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import { EXPORT_COLUMNS, type ExportRow } from '../../src/domain/export.contract';

// ---------------------------------------------------------------------------
// 1. Ordem exata de EXPORT_COLUMNS
// ---------------------------------------------------------------------------

describe('EXPORT_COLUMNS — ordem exata', () => {
  const EXPECTED_ORDER = [
    'sessionId',
    'sessionName',
    'sequenceVariant',
    'sessionStatus',
    'p1ParticipantCode',
    'p2ParticipantCode',
    'globalNumber',
    'blockNumber',
    'trialInBlock',
    'condition',
    'endowment',
    'distributorCharacter',
    'receptorCharacter',
    'distributorDistribution',
    'receptorDistribution',
    'p1Judgment',
    'p1JudgmentAt',
    'p1Punishment',
    'p1PunishmentAt',
    'p1ResultAcknowledgedAt',
    'p2Judgment',
    'p2JudgmentAt',
    'p2Punishment',
    'p2PunishmentAt',
    'p2ResultAcknowledgedAt',
    'consensus',
    'culturant',
    'p1IndividualCost',
    'p2IndividualCost',
    'punishmentApplied',
    'distributorFinal',
    'distributorLost',
    'culturalConsequence',
    'p1CoinsAfter',
    'p2CoinsAfter',
    'groupCoinsAfter',
    'disagreementCountAfter',
    'attemptStartedAt',
    'attemptCompletedAt',
  ] as const;

  it('contém exatamente 39 colunas', () => {
    expect(EXPORT_COLUMNS.length).toBe(39);
  });

  it('ordem é exatamente a especificada', () => {
    expect([...EXPORT_COLUMNS]).toEqual([...EXPECTED_ORDER]);
  });

  it('cada coluna está na posição correta', () => {
    EXPECTED_ORDER.forEach((col, i) => {
      expect(EXPORT_COLUMNS[i]).toBe(col);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Nenhuma coluna proibida está presente
// ---------------------------------------------------------------------------

describe('EXPORT_COLUMNS — ausência de campos proibidos', () => {
  const FORBIDDEN = [
    'displayName',
    'accessToken',
    'passwordHash',
    'password',
    'email',
    'researcherName',
    'researcherId',
    'APtype',
    'joinedAt',
    'lastSeenAt',
  ];

  it.each(FORBIDDEN)('"%s" não aparece nas colunas', (forbidden) => {
    expect(EXPORT_COLUMNS).not.toContain(forbidden);
  });
});

// ---------------------------------------------------------------------------
// 3. Sem colunas duplicadas
// ---------------------------------------------------------------------------

describe('EXPORT_COLUMNS — sem duplicatas', () => {
  it('todas as colunas são únicas', () => {
    const unique = new Set(EXPORT_COLUMNS);
    expect(unique.size).toBe(EXPORT_COLUMNS.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Contrato aceita null para sessões/tentativas incompletas
// ---------------------------------------------------------------------------

describe('ExportRow — suporte a null para dados incompletos', () => {
  it('linha com tentativa incompleta (respostas/resultado null) é válida', () => {
    const incompleteRow: ExportRow = {
      // Sessão (obrigatórios)
      sessionId:          'sess-001',
      sessionName:        'Turma A',
      sequenceVariant:    'ABAC',
      sessionStatus:      'IN_PROGRESS',
      p1ParticipantCode:  'G1P1',
      p2ParticipantCode:  'G1P2',
      // Posição e estímulo (obrigatórios)
      globalNumber:            1,
      blockNumber:             1,
      trialInBlock:            1,
      condition:               'A',
      endowment:               32,
      distributorCharacter:    'Lucas',
      receptorCharacter:       'Isaac',
      distributorDistribution: 24,
      receptorDistribution:    8,
      // Respostas P1 — null (não respondeu ainda)
      p1Judgment:             null,
      p1JudgmentAt:           null,
      p1Punishment:           null,
      p1PunishmentAt:         null,
      p1ResultAcknowledgedAt: null,
      // Respostas P2 — null
      p2Judgment:             null,
      p2JudgmentAt:           null,
      p2Punishment:           null,
      p2PunishmentAt:         null,
      p2ResultAcknowledgedAt: null,
      // Resultado — null (não finalizado)
      consensus:              null,
      culturant:              null,
      p1IndividualCost:       null,
      p2IndividualCost:       null,
      punishmentApplied:      null,
      distributorFinal:       null,
      distributorLost:        null,
      culturalConsequence:    null,
      p1CoinsAfter:           null,
      p2CoinsAfter:           null,
      groupCoinsAfter:        null,
      disagreementCountAfter: null,
      // Timestamps — null
      attemptStartedAt:   null,
      attemptCompletedAt: null,
    };

    // Compilação TypeScript já valida o tipo; aqui confirmamos valores em runtime
    expect(incompleteRow.p1Judgment).toBeNull();
    expect(incompleteRow.consensus).toBeNull();
    expect(incompleteRow.culturant).toBeNull();
    expect(incompleteRow.attemptCompletedAt).toBeNull();
    // Campos obrigatórios presentes
    expect(incompleteRow.sessionId).toBe('sess-001');
    expect(incompleteRow.endowment).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// 5. Contrato suporta uma linha completa
// ---------------------------------------------------------------------------

describe('ExportRow — linha completa', () => {
  it('linha com todos os campos preenchidos é válida', () => {
    const now = new Date('2024-10-24T10:00:00Z');

    const completeRow: ExportRow = {
      sessionId:          'sess-001',
      sessionName:        'Turma A — Dupla 3',
      sequenceVariant:    'ABAC',
      sessionStatus:      'COMPLETED',
      p1ParticipantCode:  'G1P1',
      p2ParticipantCode:  'G1P2',
      globalNumber:            5,
      blockNumber:             1,
      trialInBlock:            5,
      condition:               'A',
      endowment:               32,
      distributorCharacter:    'Lucas',
      receptorCharacter:       'Isaac',
      distributorDistribution: 24,
      receptorDistribution:    8,
      p1Judgment:             'Unjust',
      p1JudgmentAt:           now,
      p1Punishment:           'Punish',
      p1PunishmentAt:         now,
      p1ResultAcknowledgedAt: now,
      p2Judgment:             'Unjust',
      p2JudgmentAt:           now,
      p2Punishment:           'Punish',
      p2PunishmentAt:         now,
      p2ResultAcknowledgedAt: now,
      consensus:              true,
      culturant:              'Cp',
      p1IndividualCost:       1,
      p2IndividualCost:       1,
      punishmentApplied:      true,
      distributorFinal:       8,
      distributorLost:        16,
      culturalConsequence:    3,
      p1CoinsAfter:           79,
      p2CoinsAfter:           79,
      groupCoinsAfter:        3,
      disagreementCountAfter: 0,
      attemptStartedAt:   now,
      attemptCompletedAt: now,
    };

    // Confirma que todos os 39 campos estão presentes
    const presentKeys = Object.keys(completeRow);
    expect(presentKeys.length).toBe(EXPORT_COLUMNS.length);

    // Confirma que os campos correspondem exatamente às colunas
    const sortedPresent   = [...presentKeys].sort();
    const sortedColumns   = [...EXPORT_COLUMNS].sort();
    expect(sortedPresent).toEqual(sortedColumns);

    // Spot-checks de valores
    expect(completeRow.culturant).toBe('Cp');
    expect(completeRow.consensus).toBe(true);
    expect(completeRow.punishmentApplied).toBe(true);
    expect(completeRow.p1CoinsAfter).toBe(79);
    expect(completeRow.disagreementCountAfter).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Testes de tipo — contratos de valores permitidos
// ---------------------------------------------------------------------------

describe('ExportRow — tipos restritos de campos numéricos específicos', () => {
  it('p1IndividualCost aceita 0, 1 e null — não aceita outros números', () => {
    expectTypeOf<ExportRow['p1IndividualCost']>().toEqualTypeOf<0 | 1 | null>();
  });

  it('p2IndividualCost aceita 0, 1 e null — não aceita outros números', () => {
    expectTypeOf<ExportRow['p2IndividualCost']>().toEqualTypeOf<0 | 1 | null>();
  });

  it('culturalConsequence aceita 0, 3 e null — não aceita outros números', () => {
    expectTypeOf<ExportRow['culturalConsequence']>().toEqualTypeOf<0 | 3 | null>();
  });
});
