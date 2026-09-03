/**
 * trial.service.finalize.test.ts
 * Testes unitários de finalizeAttempt() — foco em idempotência e P2002.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// prisma.$transaction executa o callback diretamente com mockTx
const mockTx = {
  attempt:    { findUnique: vi.fn(), update: vi.fn() },
  response:   { findMany: vi.fn() },
  trialRecord:{ create: vi.fn() },
  session:    { update: vi.fn() },
};

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
    trialRecord:  { findUnique: vi.fn() },
  },
}));

// resolveTrialFromDb retorna dados fixos válidos
vi.mock('../../src/services/trial.resolver', () => ({
  resolveTrialFromDb: vi.fn(() => ({
    consensus: true,
    culturant: 'Cp',
    p1IndividualCost: 1,
    p2IndividualCost: 1,
    punishmentApplied: true,
    distributorFinal: 8,
    distributorLost: 16,
    culturalConsequence: 3,
    p1CoinsAfter: 79,
    p2CoinsAfter: 79,
    groupCoinsAfter: 3,
    disagreementCountAfter: 0,
  })),
}));

import { finalizeAttempt } from '../../src/services/trial.service';
import { prisma } from '../../src/config/prisma';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATTEMPT_ID = 'att-001';
const SESSION_ID = 'sess-001';

const attemptBase = {
  id:           ATTEMPT_ID,
  sessionId:    SESSION_ID,
  globalNumber: 5,
  condition:    'A',
  endowment:    32,
  distributorDistribution: 24,
  receptorDistribution:    8,
  distributorCharacter: 'Lucas',
  receptorCharacter:    'Isaac',
  completedAt:  null,
  session:      { status: 'IN_PROGRESS' },
  trialRecord:  null,
};

const existingRecord = { id: 'tr-001', attemptId: ATTEMPT_ID };
const twoResponses = [
  { sessionParticipant: { slot: 'P1' }, judgment: 'Just',   punishment: 'Punish' },
  { sessionParticipant: { slot: 'P2' }, judgment: 'Unjust', punishment: 'Punish' },
];

const prevAttemptWithRecord = {
  trialRecord: {
    p1CoinsAfter: 80, p2CoinsAfter: 80,
    groupCoinsAfter: 0, disagreementCountAfter: 0,
  },
};

function setupHappyPath() {
  vi.mocked(mockTx.attempt.findUnique)
    .mockResolvedValueOnce(attemptBase)           // attempt principal
    .mockResolvedValueOnce(prevAttemptWithRecord); // attempt anterior (globalNumber > 1)
  vi.mocked(mockTx.response.findMany).mockResolvedValue(twoResponses);
  vi.mocked(mockTx.trialRecord.create).mockResolvedValue(existingRecord);
  (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> })
    .$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)
    );
}

beforeEach(() => {
  vi.resetAllMocks();
  (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> })
    .$transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)
    );
});

// ---------------------------------------------------------------------------
// Idempotência — TrialRecord já existe
// ---------------------------------------------------------------------------

describe('finalizeAttempt — idempotência', () => {
  it('retorna TrialRecord existente sem criar novo', async () => {
    vi.mocked(mockTx.attempt.findUnique).mockResolvedValue({
      ...attemptBase,
      trialRecord: existingRecord,
    });
    const result = await finalizeAttempt(ATTEMPT_ID);
    expect(result).toBe(existingRecord);
    expect(mockTx.trialRecord.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Recuperação de P2002 (race condition)
// ---------------------------------------------------------------------------

describe('finalizeAttempt — recuperação de P2002', () => {
  it('P2002 → busca e retorna o TrialRecord criado pela outra transação', async () => {
    const p2002 = Object.assign(new Error('unique constraint'), { code: 'P2002' });
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> })
      .$transaction.mockRejectedValueOnce(p2002);
    vi.mocked(prisma.trialRecord.findUnique).mockResolvedValue(existingRecord as never);

    const result = await finalizeAttempt(ATTEMPT_ID);

    expect(result).toBe(existingRecord);
    expect(prisma.trialRecord.findUnique).toHaveBeenCalledWith({
      where: { attemptId: ATTEMPT_ID },
    });
  });

  it('P2002 mas sem TrialRecord existente → relança o erro', async () => {
    const p2002 = Object.assign(new Error('unique constraint'), { code: 'P2002' });
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> })
      .$transaction.mockRejectedValueOnce(p2002);
    vi.mocked(prisma.trialRecord.findUnique).mockResolvedValue(null as never);

    await expect(finalizeAttempt(ATTEMPT_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('erro não-P2002 → relança sem buscar TrialRecord', async () => {
    const other = Object.assign(new Error('other'), { code: 'P2025' });
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> })
      .$transaction.mockRejectedValueOnce(other);

    await expect(finalizeAttempt(ATTEMPT_ID)).rejects.toMatchObject({ code: 'P2025' });
    expect(prisma.trialRecord.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// NÃO conclui Session
// ---------------------------------------------------------------------------

describe('finalizeAttempt — não conclui Session', () => {
  it('não chama session.update mesmo para trial 64', async () => {
    vi.mocked(mockTx.attempt.findUnique)
      .mockResolvedValueOnce({ ...attemptBase, globalNumber: 64, session: { status: 'IN_PROGRESS' } })
      .mockResolvedValueOnce(prevAttemptWithRecord);
    vi.mocked(mockTx.response.findMany).mockResolvedValue(twoResponses);
    vi.mocked(mockTx.trialRecord.create).mockResolvedValue(existingRecord);

    await finalizeAttempt(ATTEMPT_ID);

    expect(mockTx.session.update).not.toHaveBeenCalled();
  });
});
