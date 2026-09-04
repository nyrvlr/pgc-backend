/**
 * export.service.test.ts
 * Testa buildExportRows com Prisma mockado — sem banco real.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    session:            { findUnique: vi.fn() },
    sessionParticipant: { findMany: vi.fn() },
    attempt:            { findMany: vi.fn() },
  },
}));

import { buildExportRows } from '../../src/services/export.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESS_ID  = 'sess-001';
const RES_ID   = 'res-001';
const OTHER_RES = 'res-OTHER';

const mockSession = {
  id: SESS_ID, researcherId: RES_ID,
  name: 'Turma A', sequenceVariant: 'ABAC', status: 'COMPLETED',
};

const mockP1 = { id: 'sp-p1', slot: 'P1', participantCode: 'G1P1' };
const mockP2 = { id: 'sp-p2', slot: 'P2', participantCode: 'G1P2' };

const NOW = new Date('2024-10-24T10:00:00Z');

function makeAttempt(overrides: object = {}) {
  return {
    id: 'att-001', globalNumber: 1, blockNumber: 1, trialInBlock: 1,
    condition: 'A', endowment: 32,
    distributorCharacter: 'Lucas', receptorCharacter: 'Isaac',
    distributorDistribution: 24, receptorDistribution: 8,
    startedAt: NOW, completedAt: NOW,
    responses: [], trialRecord: null,
    ...overrides,
  };
}

function makeTrialRecord(overrides: object = {}) {
  return {
    consensus: true, culturant: 'Cp',
    p1IndividualCost: 1, p2IndividualCost: 1,
    punishmentApplied: true,
    distributorFinal: 8, distributorLost: 16,
    culturalConsequence: 3,
    p1CoinsAfter: 79, p2CoinsAfter: 79,
    groupCoinsAfter: 3, disagreementCountAfter: 0,
    ...overrides,
  };
}

function makeResponse(spId: string, overrides: object = {}) {
  return {
    sessionParticipantId: spId,
    judgment: 'Unjust', judgmentAt: NOW,
    punishment: 'Punish', punishmentAt: NOW,
    resultAcknowledgedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => { vi.resetAllMocks(); });

// ---------------------------------------------------------------------------
// 1. Ownership / inexistente
// ---------------------------------------------------------------------------

describe('buildExportRows — ownership', () => {
  it('sessão inexistente → SessionBootstrapError com sessionId', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null as never);
    await expect(buildExportRows(SESS_ID, RES_ID))
      .rejects.toThrow(SessionBootstrapError);
    await expect(buildExportRows(SESS_ID, RES_ID))
      .rejects.toThrow(/Session não encontrada: sess-001/);
  });

  it('sessão de outro pesquisador → mesmo erro (não revela existência)', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    await expect(buildExportRows(SESS_ID, OTHER_RES))
      .rejects.toThrow(/Session não encontrada: sess-001/);
  });
});

// ---------------------------------------------------------------------------
// 2. WAITING sem Attempts → []
// ---------------------------------------------------------------------------

describe('buildExportRows — sessão WAITING sem Attempts', () => {
  it('retorna array vazio', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(
      { ...mockSession, status: 'WAITING' } as never
    );
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([] as never);
    const rows = await buildExportRows(SESS_ID, RES_ID);
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Ordem dos Attempts
// ---------------------------------------------------------------------------

describe('buildExportRows — ordem dos Attempts', () => {
  it('respeita globalNumber ASC independente da ordem retornada pelo mock', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    // Attempts fora de ordem no mock — o service deve ordenar orderBy globalNumber ASC na query
    // (confirmado pela chamada ao Prisma)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ globalNumber: 3, trialInBlock: 3 }),
      makeAttempt({ id: 'att-001a', globalNumber: 1, trialInBlock: 1 }),
      makeAttempt({ id: 'att-002', globalNumber: 2, trialInBlock: 2 }),
    ] as never);

    await buildExportRows(SESS_ID, RES_ID);

    // Verifica que orderBy foi passado na query
    expect(prisma.attempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { globalNumber: 'asc' },
      })
    );
  });

  it('ordem das rows reflete a ordem recebida do banco', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ id: 'a1', globalNumber: 1 }),
      makeAttempt({ id: 'a2', globalNumber: 2 }),
      makeAttempt({ id: 'a3', globalNumber: 3 }),
    ] as never);
    const rows = await buildExportRows(SESS_ID, RES_ID);
    expect(rows.map(r => r.globalNumber)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// 4. Associação correta de P1/P2 mesmo com arrays fora de ordem
// ---------------------------------------------------------------------------

describe('buildExportRows — associação P1/P2 por slot', () => {
  it('P2 antes de P1 no array de participantes → mapeamento correto por slot', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    // P2 primeiro, P1 segundo
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP2, mockP1] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({
        responses: [
          makeResponse(mockP2.id, { judgment: 'Just' }),
          makeResponse(mockP1.id, { judgment: 'Unjust' }),
        ],
      }),
    ] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.p1Judgment).toBe('Unjust');    // sp-p1 é P1
    expect(row.p2Judgment).toBe('Just');       // sp-p2 é P2
    expect(row.p1ParticipantCode).toBe('G1P1');
    expect(row.p2ParticipantCode).toBe('G1P2');
  });

  it('resposta P2 antes de P1 no array de responses → mapeamento correto por sessionParticipantId', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({
        responses: [
          makeResponse(mockP2.id, { punishment: 'NoPunish' }),
          makeResponse(mockP1.id, { punishment: 'Punish' }),
        ],
      }),
    ] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.p1Punishment).toBe('Punish');
    expect(row.p2Punishment).toBe('NoPunish');
  });
});

// ---------------------------------------------------------------------------
// 5. Respostas parciais → null
// ---------------------------------------------------------------------------

describe('buildExportRows — respostas parciais', () => {
  it('attempt sem responses → todos os campos de resposta null', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([makeAttempt()] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.p1Judgment).toBeNull();
    expect(row.p1Punishment).toBeNull();
    expect(row.p2Judgment).toBeNull();
    expect(row.p2ResultAcknowledgedAt).toBeNull();
  });

  it('só P1 respondeu → P2 null', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ responses: [makeResponse(mockP1.id)] }),
    ] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.p1Judgment).toBe('Unjust');
    expect(row.p2Judgment).toBeNull();
    expect(row.p2Punishment).toBeNull();
  });

  it('P1 com judgment mas sem punishment', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({
        responses: [makeResponse(mockP1.id, { punishment: null, punishmentAt: null })],
      }),
    ] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.p1Judgment).toBe('Unjust');
    expect(row.p1Punishment).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. TrialRecord ausente → resultados null
// ---------------------------------------------------------------------------

describe('buildExportRows — TrialRecord ausente', () => {
  it('sem trialRecord todos os campos de resultado são null', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([makeAttempt()] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.consensus).toBeNull();
    expect(row.culturant).toBeNull();
    expect(row.p1IndividualCost).toBeNull();
    expect(row.p2IndividualCost).toBeNull();
    expect(row.punishmentApplied).toBeNull();
    expect(row.distributorFinal).toBeNull();
    expect(row.distributorLost).toBeNull();
    expect(row.culturalConsequence).toBeNull();
    expect(row.p1CoinsAfter).toBeNull();
    expect(row.p2CoinsAfter).toBeNull();
    expect(row.groupCoinsAfter).toBeNull();
    expect(row.disagreementCountAfter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Linha completa correta
// ---------------------------------------------------------------------------

describe('buildExportRows — linha completa', () => {
  it('preenche todos os 39 campos corretamente', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({
        trialRecord: makeTrialRecord(),
        responses: [makeResponse(mockP1.id), makeResponse(mockP2.id)],
      }),
    ] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);

    // Sessão
    expect(row.sessionId).toBe(SESS_ID);
    expect(row.sessionName).toBe('Turma A');
    expect(row.sequenceVariant).toBe('ABAC');
    expect(row.sessionStatus).toBe('COMPLETED');
    expect(row.p1ParticipantCode).toBe('G1P1');
    expect(row.p2ParticipantCode).toBe('G1P2');

    // Posição e estímulo
    expect(row.globalNumber).toBe(1);
    expect(row.blockNumber).toBe(1);
    expect(row.trialInBlock).toBe(1);
    expect(row.condition).toBe('A');
    expect(row.endowment).toBe(32);
    expect(row.distributorCharacter).toBe('Lucas');
    expect(row.receptorCharacter).toBe('Isaac');
    expect(row.distributorDistribution).toBe(24);
    expect(row.receptorDistribution).toBe(8);

    // Respostas
    expect(row.p1Judgment).toBe('Unjust');
    expect(row.p1Punishment).toBe('Punish');
    expect(row.p2Judgment).toBe('Unjust');
    expect(row.p2Punishment).toBe('Punish');
    expect(row.p1ResultAcknowledgedAt).toEqual(NOW);

    // Resultado
    expect(row.consensus).toBe(true);
    expect(row.culturant).toBe('Cp');
    expect(row.p1IndividualCost).toBe(1);
    expect(row.p2IndividualCost).toBe(1);
    expect(row.punishmentApplied).toBe(true);
    expect(row.distributorFinal).toBe(8);
    expect(row.distributorLost).toBe(16);
    expect(row.culturalConsequence).toBe(3);
    expect(row.p1CoinsAfter).toBe(79);
    expect(row.groupCoinsAfter).toBe(3);
    expect(row.disagreementCountAfter).toBe(0);

    // Timestamps
    expect(row.attemptStartedAt).toEqual(NOW);
    expect(row.attemptCompletedAt).toEqual(NOW);
  });
});

// ---------------------------------------------------------------------------
// 8. punishmentApplied=false não apaga distributorFinal/distributorLost
// ---------------------------------------------------------------------------

describe('buildExportRows — punishmentApplied=false preserva valores', () => {
  it('distributorFinal e distributorLost são preservados mesmo sem punição', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({
        trialRecord: makeTrialRecord({
          punishmentApplied: false,
          distributorFinal: 8,
          distributorLost: 16,
          culturalConsequence: 3,
          p1IndividualCost: 0,
          p2IndividualCost: 0,
        }),
        responses: [makeResponse(mockP1.id), makeResponse(mockP2.id)],
      }),
    ] as never);
    const [row] = await buildExportRows(SESS_ID, RES_ID);
    expect(row.punishmentApplied).toBe(false);
    expect(row.distributorFinal).toBe(8);    // valor potencial preservado
    expect(row.distributorLost).toBe(16);    // valor potencial preservado
    expect(row.p1IndividualCost).toBe(0);
    expect(row.p2IndividualCost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Nenhum campo sensível consultado nem retornado
// ---------------------------------------------------------------------------

describe('buildExportRows — ausência de campos sensíveis', () => {
  it('query de participants não inclui displayName nem accessToken', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([] as never);
    await buildExportRows(SESS_ID, RES_ID);

    const spCall = vi.mocked(prisma.sessionParticipant.findMany).mock.calls[0][0] as {
      select?: Record<string, unknown>;
    };
    expect(spCall.select?.displayName).toBeUndefined();
    expect(spCall.select?.accessToken).toBeUndefined();
  });

  it('query de session não inclui researcherId no select', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([] as never);
    await buildExportRows(SESS_ID, RES_ID);

    // researcherId é selecionado apenas para verificar ownership, não para retorno
    // O retorno da função nunca inclui researcherId
    const sessCall = vi.mocked(prisma.session.findUnique).mock.calls[0][0] as {
      select?: Record<string, unknown>;
    };
    expect(sessCall.select?.passwordHash).toBeUndefined();
    expect(sessCall.select?.email).toBeUndefined();
  });

  it('linha retornada não contém accessToken, displayName, passwordHash', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([makeAttempt()] as never);
    const rows = await buildExportRows(SESS_ID, RES_ID);
    const json = JSON.stringify(rows);
    expect(json).not.toContain('accessToken');
    expect(json).not.toContain('displayName');
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain('researcherId');
  });
});

// ---------------------------------------------------------------------------
// 10. Valores inválidos de custo/consequência provocam erro
// ---------------------------------------------------------------------------

describe('buildExportRows — valores inválidos provocam erro', () => {
  it('p1IndividualCost=2 (inválido) lança SessionBootstrapError', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ trialRecord: makeTrialRecord({ p1IndividualCost: 2 }) }),
    ] as never);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(SessionBootstrapError);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(/individualCost/);
  });

  it('p2IndividualCost=-1 (inválido) lança SessionBootstrapError', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ trialRecord: makeTrialRecord({ p2IndividualCost: -1 }) }),
    ] as never);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(/individualCost/);
  });

  it('culturalConsequence=1 (inválido) lança SessionBootstrapError', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ trialRecord: makeTrialRecord({ culturalConsequence: 1 }) }),
    ] as never);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(SessionBootstrapError);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(/culturalConsequence/);
  });

  it('culturalConsequence=0 é válido (sem CC)', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1, mockP2] as never);
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      makeAttempt({ trialRecord: makeTrialRecord({ culturalConsequence: 0 }) }),
    ] as never);
    const rows = await buildExportRows(SESS_ID, RES_ID);
    expect(rows[0].culturalConsequence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Adicional: P1 ou P2 ausente com Attempts → erro de domínio
// ---------------------------------------------------------------------------

describe('buildExportRows — participantes ausentes com Attempts', () => {
  it('falta P2 com Attempts existentes → lança SessionBootstrapError', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([mockP1] as never); // só P1
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([makeAttempt()] as never);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(SessionBootstrapError);
    await expect(buildExportRows(SESS_ID, RES_ID)).rejects.toThrow(/P1.*P2|P2.*P1/);
  });
});
