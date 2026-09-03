/**
 * trial.service.acknowledge.test.ts
 * Testes unitários de acknowledgeResult() em trial.service.ts.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// vi.mock é içado pelo Vitest, mas as variáveis declaradas no escopo do módulo
// não são acessíveis dentro da factory. A solução é definir as funções de mock
// via vi.fn() e acessá-las depois do import.
// ---------------------------------------------------------------------------

vi.mock('../../src/config/prisma', () => {
  const mockTx = {
    attempt:  { findUnique: vi.fn() },
    response: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    session:  { updateMany: vi.fn() },
  };
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb(mockTx);
  });
  return {
    prisma: {
      $transaction: mockTransaction,
      __mockTx: mockTx,              // exposto para os testes acessarem
      __mockTransaction: mockTransaction,
    },
  };
});

// Também precisa mockar trial.resolver para que o import de trial.service não falhe
vi.mock('../../src/services/trial.resolver', () => ({
  resolveTrialFromDb: vi.fn(),
}));

import { acknowledgeResult } from '../../src/services/trial.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';

// Acessa os mocks internos expostos pela factory
const p = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  __mockTx: {
    attempt:  { findUnique: ReturnType<typeof vi.fn> };
    response: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    session:  { updateMany: ReturnType<typeof vi.fn> };
  };
  __mockTransaction: ReturnType<typeof vi.fn>;
};

// Atalhos legíveis
let tx: typeof p.__mockTx;
let txn: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATT_ID  = 'att-001';
const SP_ID   = 'sp-001';
const SESS_ID = 'sess-001';

const attemptFinalized   = { globalNumber: 5,  sessionId: SESS_ID, completedAt: new Date(), trialRecord: { id: 'tr-001' } };
const attempt64Finalized = { globalNumber: 64, sessionId: SESS_ID, completedAt: new Date(), trialRecord: { id: 'tr-064' } };

const responseWithAck    = { resultAcknowledgedAt: new Date() };
const responseWithoutAck = { resultAcknowledgedAt: null };

const bothAcked    = [{ resultAcknowledgedAt: new Date() }, { resultAcknowledgedAt: new Date() }];
const onlyOneAcked = [{ resultAcknowledgedAt: new Date() }, { resultAcknowledgedAt: null }];

beforeEach(() => {
  vi.resetAllMocks();
  tx  = p.__mockTx;
  txn = p.__mockTransaction;
  // Restaura comportamento padrão da transação após reset
  txn.mockImplementation(async (cb: (t: unknown) => Promise<void>) => { await cb(tx); });
  // Re-expõe via prisma.$transaction (resetAllMocks zeraria a referência)
  (prisma as unknown as { $transaction: typeof txn }).$transaction = txn;
});

// ---------------------------------------------------------------------------
// Validações
// ---------------------------------------------------------------------------

describe('acknowledgeResult — validações', () => {
  it('Attempt não encontrado → lança erro', async () => {
    tx.attempt.findUnique.mockResolvedValue(null);
    await expect(acknowledgeResult(ATT_ID, SP_ID)).rejects.toThrow(/Attempt não encontrado/);
  });

  it('Attempt sem trialRecord → lança erro', async () => {
    tx.attempt.findUnique.mockResolvedValue({ ...attemptFinalized, trialRecord: null });
    await expect(acknowledgeResult(ATT_ID, SP_ID)).rejects.toThrow(/ainda não foi finalizado/);
  });

  it('Attempt sem completedAt → lança erro', async () => {
    tx.attempt.findUnique.mockResolvedValue({ ...attemptFinalized, completedAt: null });
    await expect(acknowledgeResult(ATT_ID, SP_ID)).rejects.toThrow(/ainda não foi finalizado/);
  });

  it('Response não encontrada → lança erro', async () => {
    tx.attempt.findUnique.mockResolvedValue(attemptFinalized);
    tx.response.findUnique.mockResolvedValue(null);
    await expect(acknowledgeResult(ATT_ID, SP_ID)).rejects.toThrow(/Resposta não encontrada/);
  });
});

// ---------------------------------------------------------------------------
// Idempotência — não retorna cedo quando ack já existe
// ---------------------------------------------------------------------------

describe('acknowledgeResult — idempotência', () => {
  it('ack já existente: não chama response.update mas lê allAcked', async () => {
    tx.attempt.findUnique.mockResolvedValue(attemptFinalized);
    tx.response.findUnique.mockResolvedValue(responseWithAck);
    tx.response.findMany.mockResolvedValue(onlyOneAcked);
    await acknowledgeResult(ATT_ID, SP_ID);
    expect(tx.response.update).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  it('ack já existente + ambos ackaram + trial 64: conclui Session mesmo assim', async () => {
    tx.attempt.findUnique.mockResolvedValue(attempt64Finalized);
    tx.response.findUnique.mockResolvedValue(responseWithAck);
    tx.response.findMany.mockResolvedValue(bothAcked);
    await acknowledgeResult('att-064', SP_ID);
    expect(tx.response.update).not.toHaveBeenCalled();
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { id: SESS_ID, status: 'IN_PROGRESS' },
      data:  expect.objectContaining({ status: 'COMPLETED' }),
    });
  });
});

// ---------------------------------------------------------------------------
// Fluxo normal
// ---------------------------------------------------------------------------

describe('acknowledgeResult — ack novo', () => {
  it('grava resultAcknowledgedAt quando ainda não existe', async () => {
    tx.attempt.findUnique.mockResolvedValue(attemptFinalized);
    tx.response.findUnique.mockResolvedValue(responseWithoutAck);
    tx.response.findMany.mockResolvedValue(onlyOneAcked);
    await acknowledgeResult(ATT_ID, SP_ID);
    expect(tx.response.update).toHaveBeenCalledWith({
      where: { attemptId_sessionParticipantId: { attemptId: ATT_ID, sessionParticipantId: SP_ID } },
      data:  expect.objectContaining({ resultAcknowledgedAt: expect.any(Date) }),
    });
  });

  it('trial intermediário com ambos ackados: não atualiza Session', async () => {
    tx.attempt.findUnique.mockResolvedValue(attemptFinalized); // globalNumber=5
    tx.response.findUnique.mockResolvedValue(responseWithoutAck);
    tx.response.findMany.mockResolvedValue(bothAcked);
    await acknowledgeResult(ATT_ID, SP_ID);
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  it('trial 64 com ambos ackados: atualiza Session para COMPLETED', async () => {
    tx.attempt.findUnique.mockResolvedValue(attempt64Finalized);
    tx.response.findUnique.mockResolvedValue(responseWithoutAck);
    tx.response.findMany.mockResolvedValue(bothAcked);
    await acknowledgeResult('att-064', SP_ID);
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { id: SESS_ID, status: 'IN_PROGRESS' },
      data:  expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
    });
  });

  it('parceiro ainda não ackiu: não atualiza Session', async () => {
    tx.attempt.findUnique.mockResolvedValue(attempt64Finalized);
    tx.response.findUnique.mockResolvedValue(responseWithoutAck);
    tx.response.findMany.mockResolvedValue(onlyOneAcked);
    await acknowledgeResult('att-064', SP_ID);
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Atomicidade — transação Serializable + retry P2034
// ---------------------------------------------------------------------------

describe('acknowledgeResult — atomicidade e retry', () => {
  it('usa isolationLevel Serializable', async () => {
    tx.attempt.findUnique.mockResolvedValue(attemptFinalized);
    tx.response.findUnique.mockResolvedValue(responseWithoutAck);
    tx.response.findMany.mockResolvedValue(onlyOneAcked);
    await acknowledgeResult(ATT_ID, SP_ID);
    expect(txn).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('P2034 na primeira tentativa → retry e sucesso na segunda', async () => {
    const p2034 = Object.assign(new Error('serialization'), { code: 'P2034' });
    txn
      .mockRejectedValueOnce(p2034)
      .mockImplementationOnce(async (cb: (t: unknown) => Promise<void>) => {
        tx.attempt.findUnique.mockResolvedValue(attemptFinalized);
        tx.response.findUnique.mockResolvedValue(responseWithoutAck);
        tx.response.findMany.mockResolvedValue(onlyOneAcked);
        await cb(tx);
      });
    await expect(acknowledgeResult(ATT_ID, SP_ID)).resolves.toBeUndefined();
    expect(txn).toHaveBeenCalledTimes(2);
  });

  it('P2034 em todas as 3 tentativas → relança o erro', async () => {
    const p2034 = Object.assign(new Error('serialization'), { code: 'P2034' });
    txn.mockRejectedValue(p2034);
    await expect(acknowledgeResult(ATT_ID, SP_ID)).rejects.toMatchObject({ code: 'P2034' });
    expect(txn).toHaveBeenCalledTimes(3);
  });

  it('erro não-P2034 → não faz retry, relança imediatamente', async () => {
    const other = Object.assign(new Error('unique'), { code: 'P2002' });
    txn.mockRejectedValueOnce(other);
    await expect(acknowledgeResult(ATT_ID, SP_ID)).rejects.toMatchObject({ code: 'P2002' });
    expect(txn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Idempotência de conclusão de Session
// ---------------------------------------------------------------------------

describe('acknowledgeResult — Session já COMPLETED (retry pós-conclusão)', () => {
  it('Session já COMPLETED + ambos ackaram + retry → updateMany não executa (where filtra)', async () => {
    // Simula: ack próprio já existe, parceiro também, Session já COMPLETED
    tx.attempt.findUnique.mockResolvedValue(attempt64Finalized);
    tx.response.findUnique.mockResolvedValue(responseWithAck);   // ack próprio já existe
    tx.response.findMany.mockResolvedValue(bothAcked);            // ambos ackaram
    // updateMany retorna { count: 0 } pois WHERE status=IN_PROGRESS não bate
    tx.session.updateMany.mockResolvedValue({ count: 0 });

    await acknowledgeResult('att-064', SP_ID);

    // updateMany É chamado (tentativa idempotente), mas com filtro que exclui COMPLETED
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { id: SESS_ID, status: 'IN_PROGRESS' },
      data:  expect.objectContaining({ status: 'COMPLETED' }),
    });
    // response.update NÃO é chamado (ack já existia)
    expect(tx.response.update).not.toHaveBeenCalled();
  });
});
