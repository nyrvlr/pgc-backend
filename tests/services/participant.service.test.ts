/**
 * participant.service.test.ts
 * Testes diretos de getParticipantState() com Prisma mockado.
 * Sem banco, sem Neon.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    sessionParticipant: { findUnique: vi.fn(), update: vi.fn() },
    attempt: { findFirst: vi.fn() },
  },
}));

import { getParticipantState } from '../../src/services/participant.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SP_ID   = 'sp-001';
const SESS_ID = 'sess-001';
const ATT_ID  = 'att-001';
const NOW     = new Date('2024-01-01T10:00:00Z');

const mockSpBase = {
  id:              SP_ID,
  sessionId:       SESS_ID,
  slot:            'P1',
  displayName:     'Alice',
  participantCode: 'G1P1',
  accessToken:     'tok-abc',       // nunca deve aparecer na resposta
  joinedAt:        NOW,
  lastSeenAt:      NOW,
  createdAt:       NOW,
  session: { id: SESS_ID, name: 'Turma A', status: 'IN_PROGRESS', sequenceVariant: 'ABAC' },
};

const mockAttemptBase = {
  id:                      ATT_ID,
  endowment:               32,
  distributorDistribution: 24,
  receptorDistribution:    8,
  distributorCharacter:    'Lucas',
  receptorCharacter:       'Isaac',
  // campos internos que nunca devem aparecer na resposta pública
  condition:               'A',
  blockNumber:             1,
  globalNumber:            5,
  completedAt:             null,
  trialRecord:             null,
  responses:               [] as Array<{
    sessionParticipantId: string;
    judgment: string | null;
    punishment: string | null;
    resultAcknowledgedAt: Date | null;
  }>,
};

const mockTrialRecord = {
  p1IndividualCost:    1,
  p2IndividualCost:    1,
  p1CoinsAfter:        79,
  p2CoinsAfter:        79,
  punishmentApplied:   true,
  distributorFinal:    8,
  distributorLost:     16,
  culturalConsequence: 3,
  groupCoinsAfter:     3,
};

const mockTrialRecordNoPunish = {
  ...mockTrialRecord,
  punishmentApplied:   false,
  distributorFinal:    24,
  distributorLost:     0,
  culturalConsequence: 3,
  groupCoinsAfter:     3,
};

function ownResponse(
  judgment: string | null = null,
  punishment: string | null = null,
  ack: Date | null = null,
) {
  return { sessionParticipantId: SP_ID, judgment, punishment, resultAcknowledgedAt: ack };
}

function partnerResponse(
  judgment: string | null = null,
  punishment: string | null = null,
  ack: Date | null = null,
) {
  return { sessionParticipantId: 'sp-002', judgment, punishment, resultAcknowledgedAt: ack };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.sessionParticipant.update).mockResolvedValue(undefined as never);
});

// ---------------------------------------------------------------------------
// Token inválido
// ---------------------------------------------------------------------------

describe('accessToken inválido', () => {
  it('lança SessionBootstrapError quando sp não encontrado', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null as never);
    await expect(getParticipantState('tok-invalido')).rejects.toThrow(SessionBootstrapError);
    await expect(getParticipantState('tok-invalido')).rejects.toThrow(/inválido/);
  });
});

// ---------------------------------------------------------------------------
// Sessão WAITING
// ---------------------------------------------------------------------------

describe('sessão WAITING', () => {
  it('retorna WAITING_SESSION com currentAttempt null e trialResult null', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue({
      ...mockSpBase, session: { ...mockSpBase.session, status: 'WAITING' },
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('WAITING_SESSION');
    expect(result.currentAttempt).toBeNull();
    expect(result.trialResult).toBeNull();
    // attempt.findFirst NÃO deve ser chamado para WAITING
    expect(prisma.attempt.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sessão COMPLETED
// ---------------------------------------------------------------------------

describe('sessão COMPLETED', () => {
  it('retorna COMPLETED com currentAttempt null e trialResult null', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue({
      ...mockSpBase, session: { ...mockSpBase.session, status: 'COMPLETED' },
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('COMPLETED');
    expect(result.currentAttempt).toBeNull();
    expect(result.trialResult).toBeNull();
    expect(prisma.attempt.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// IN_PROGRESS — estágios progressivos
// ---------------------------------------------------------------------------

describe('IN_PROGRESS — JUDGMENT', () => {
  it('primeira tentativa sem resposta → JUDGMENT', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      responses: [],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('JUDGMENT');
    expect(result.currentAttempt).not.toBeNull();
    expect(result.currentAttempt?.id).toBe(ATT_ID);
    expect(result.trialResult).toBeNull();
  });
});

describe('IN_PROGRESS — WAITING_JUDGMENT_PARTNER', () => {
  it('próprio julgou, parceiro ainda não → WAITING_JUDGMENT_PARTNER', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      responses: [ownResponse('Just')], // só o próprio
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('WAITING_JUDGMENT_PARTNER');
    expect(result.trialResult).toBeNull();
  });
});

describe('IN_PROGRESS — PUNISHMENT', () => {
  it('ambos julgaram, punição própria ausente → PUNISHMENT', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      responses: [ownResponse('Just'), partnerResponse('Unjust')],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('PUNISHMENT');
    expect(result.trialResult).toBeNull();
  });
});

describe('IN_PROGRESS — WAITING_PUNISHMENT_PARTNER', () => {
  it('próprio puniu, parceiro ainda não → WAITING_PUNISHMENT_PARTNER', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      responses: [ownResponse('Just', 'Punish'), partnerResponse('Unjust')], // parceiro sem punishment
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('WAITING_PUNISHMENT_PARTNER');
    expect(result.trialResult).toBeNull();
  });

  it('ambos puniram MAS attempt não finalizado → WAITING_PUNISHMENT_PARTNER', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt: null,     // não finalizado
      trialRecord: null,
      responses: [ownResponse('Just', 'Punish'), partnerResponse('Unjust', 'NoPunish')],
    } as never);

    const result = await getParticipantState('tok-abc');

    // attemptFinalized=false → nunca RESULT
    expect(result.stage).toBe('WAITING_PUNISHMENT_PARTNER');
    expect(result.trialResult).toBeNull();
  });
});

describe('IN_PROGRESS — RESULT', () => {
  it('tentativa finalizada (completedAt + trialRecord), próprio sem ack → RESULT com trialResult não nulo', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt:  new Date(),
      trialRecord:  mockTrialRecord,
      responses: [ownResponse('Just', 'Punish'), partnerResponse('Unjust', 'Punish')],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('RESULT');
    // RESULT nunca pode existir com trialResult null
    expect(result.trialResult).not.toBeNull();
    expect(result.trialResult?.punishmentApplied).toBe(true);
    expect(result.trialResult?.ownIndividualCost).toBe(1);   // P1 cost
    expect(result.trialResult?.ownCoinsAfter).toBe(79);      // P1 coins
    expect(result.trialResult?.culturalConsequence).toBe(3);
    expect(result.trialResult?.groupCoinsAfter).toBe(3);
    // distributorResult presente quando punishmentApplied=true
    expect(result.trialResult?.distributorResult).not.toBeNull();
    expect(result.trialResult?.distributorResult?.character).toBe('Lucas');
    expect(result.trialResult?.distributorResult?.finalCoins).toBe(8);
    expect(result.trialResult?.distributorResult?.coinsLost).toBe(16);
  });

  it('punishmentApplied=false → distributorResult null', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt:  new Date(),
      trialRecord:  mockTrialRecordNoPunish,
      responses: [ownResponse('Just', 'NoPunish'), partnerResponse('Just', 'NoPunish')],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('RESULT');
    expect(result.trialResult?.punishmentApplied).toBe(false);
    // distributorResult deve ser null quando punishmentApplied=false
    expect(result.trialResult?.distributorResult).toBeNull();
    expect(result.trialResult?.culturalConsequence).toBe(3); // culturalConsequence independente
  });

  it('P2 recebe ownCost e ownCoinsAfter corretos (p2IndividualCost / p2CoinsAfter)', async () => {
    const spP2 = { ...mockSpBase, id: 'sp-002', slot: 'P2', accessToken: 'tok-p2' };
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(spP2 as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt:  new Date(),
      trialRecord:  { ...mockTrialRecord, p2IndividualCost: 0, p2CoinsAfter: 80 },
      responses: [
        { sessionParticipantId: SP_ID,    judgment: 'Just',   punishment: 'Punish',   resultAcknowledgedAt: null },
        { sessionParticipantId: 'sp-002', judgment: 'Unjust', punishment: 'NoPunish', resultAcknowledgedAt: null },
      ],
    } as never);

    const result = await getParticipantState('tok-p2');

    expect(result.trialResult?.ownIndividualCost).toBe(0);  // p2IndividualCost
    expect(result.trialResult?.ownCoinsAfter).toBe(80);     // p2CoinsAfter
  });
});

describe('IN_PROGRESS — WAITING_RESULT_PARTNER', () => {
  it('próprio deu ack, parceiro ainda não → WAITING_RESULT_PARTNER', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt:  new Date(),
      trialRecord:  mockTrialRecord,
      responses: [
        ownResponse('Just', 'Punish', NOW),      // próprio com ack
        partnerResponse('Unjust', 'Punish', null), // parceiro sem ack
      ],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('WAITING_RESULT_PARTNER');
    expect(result.trialResult).not.toBeNull(); // resultado ainda visível
  });
});

// ---------------------------------------------------------------------------
// Seleção de attempt ativo
// ---------------------------------------------------------------------------

describe('seleção de attempt ativo', () => {
  it('tentativa finalizada com ack pendente → selecionada antes da próxima incompleta', async () => {
    // Simula: attempt N finalizado mas ack pendente → deve ser retornado, não o N+1
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      id:           'att-N',
      completedAt:  new Date(),
      trialRecord:  mockTrialRecord,
      responses: [ownResponse('Just', 'Punish', null), partnerResponse('Just', 'Punish', null)],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.currentAttempt?.id).toBe('att-N');
    expect(result.stage).toBe('RESULT');
    expect(prisma.attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: SESS_ID,
          OR: expect.arrayContaining([
            { completedAt: null },
            expect.objectContaining({
              completedAt: { not: null },
              trialRecord: { isNot: null },
              responses: { some: { resultAcknowledgedAt: null } },
            }),
          ]),
        }),
        orderBy: { globalNumber: 'asc' },
      })
    );
  });

  it('após ambos os acks, attempt.findFirst retorna a próxima tentativa incompleta', async () => {
    // Simula: findFirst retornou o próximo attempt (sem completedAt)
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      id:          'att-N+1',
      completedAt: null,
      trialRecord: null,
      responses:   [],
    } as never);

    const result = await getParticipantState('tok-abc');

    expect(result.currentAttempt?.id).toBe('att-N+1');
    expect(result.stage).toBe('JUDGMENT');
    expect(prisma.attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: SESS_ID,
          OR: expect.arrayContaining([
            { completedAt: null },
            expect.objectContaining({
              completedAt: { not: null },
              trialRecord: { isNot: null },
              responses: { some: { resultAcknowledgedAt: null } },
            }),
          ]),
        }),
        orderBy: { globalNumber: 'asc' },
      })
    );
  });

  it('nenhum attempt ativo → stage COMPLETED (todos finalizados com ambos os acks)', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue(null as never);

    const result = await getParticipantState('tok-abc');

    expect(result.stage).toBe('COMPLETED');
    expect(result.currentAttempt).toBeNull();
    expect(prisma.attempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: SESS_ID,
          OR: expect.arrayContaining([
            { completedAt: null },
            expect.objectContaining({
              completedAt: { not: null },
              trialRecord: { isNot: null },
              responses: { some: { resultAcknowledgedAt: null } },
            }),
          ]),
        }),
        orderBy: { globalNumber: 'asc' },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Segurança: campos proibidos na resposta
// ---------------------------------------------------------------------------

describe('não expõe campos proibidos', () => {
  it('accessToken nunca aparece na resposta', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue(null as never);

    const result = await getParticipantState('tok-abc');
    const json = JSON.stringify(result);

    expect(json).not.toContain('tok-abc');
    expect((result.participant as Record<string, unknown>).accessToken).toBeUndefined();
  });

  it('session não expõe sequenceVariant', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue(null as never);

    const result = await getParticipantState('tok-abc');

    expect((result.session as Record<string, unknown>).sequenceVariant).toBeUndefined();
  });

  it('currentAttempt não expõe condition, blockNumber, globalNumber', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase, responses: [],
    } as never);

    const result = await getParticipantState('tok-abc');
    const att = result.currentAttempt as Record<string, unknown>;

    expect(att.condition).toBeUndefined();
    expect(att.blockNumber).toBeUndefined();
    expect(att.globalNumber).toBeUndefined();
  });

  it('trialResult não expõe culturant', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt: new Date(),
      trialRecord: { ...mockTrialRecord, culturant: 'Cp' }, // campo interno
      responses: [ownResponse('Just', 'Punish'), partnerResponse('Just', 'Punish')],
    } as never);

    const result = await getParticipantState('tok-abc');
    const tr = result.trialResult as Record<string, unknown>;

    expect(tr.culturant).toBeUndefined();
  });

  it('resposta nunca expõe julgamento ou punição do parceiro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      responses: [ownResponse('Just', 'Punish'), partnerResponse('Unjust', 'NoPunish')],
    } as never);

    const result = await getParticipantState('tok-abc');
    const json = JSON.stringify(result);

    // 'Unjust' e 'NoPunish' são as respostas do parceiro — não devem aparecer
    // (próprio usou 'Just' e 'Punish')
    expect(json).not.toContain('Unjust');
    expect(json).not.toContain('NoPunish');
  });

  it('currentAttempt expõe somente os campos públicos esperados', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase, responses: [],
    } as never);

    const result = await getParticipantState('tok-abc');
    const att = result.currentAttempt!;
    const keys = Object.keys(att).sort();

    expect(keys).toEqual([
      'distributorCharacter',
      'distributorDistribution',
      'endowment',
      'id',
      'receptorCharacter',
      'receptorDistribution',
    ]);
  });

  it('trialResult expõe somente os campos públicos esperados (punishmentApplied=true)', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSpBase as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({
      ...mockAttemptBase,
      completedAt: new Date(),
      trialRecord: mockTrialRecord,
      responses: [ownResponse('Just', 'Punish'), partnerResponse('Just', 'Punish')],
    } as never);

    const result = await getParticipantState('tok-abc');
    const tr = result.trialResult!;
    const keys = Object.keys(tr).sort();

    expect(keys).toEqual([
      'culturalConsequence',
      'distributorResult',
      'groupCoinsAfter',
      'ownCoinsAfter',
      'ownIndividualCost',
      'punishmentApplied',
    ]);
  });
});
