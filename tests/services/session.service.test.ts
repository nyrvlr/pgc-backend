/**
 * session.service.test.ts
 * Testes unitários de ownership e listagem no session.service.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    session:            { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    sessionParticipant: { create: vi.fn(), findMany: vi.fn() },
    trialTemplate:      { findMany: vi.fn() },
    attempt:            { createMany: vi.fn() },
    $transaction:       vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({
      session:            { findUnique: vi.fn(), update: vi.fn() },
      sessionParticipant: { findMany: vi.fn() },
      trialTemplate:      { findMany: vi.fn() },
      attempt:            { createMany: vi.fn() },
    })),
  },
}));

import {
  createSession,
  addParticipant,
  startSession,
  getSession,
  listSessions,
} from '../../src/services/session.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';

const RES_A = 'res-A';
const RES_B = 'res-B';
const SESS_ID = 'sess-001';

const sessionOfA = { id: SESS_ID, researcherId: RES_A, status: 'WAITING', sequenceVariant: 'ABAC', name: 'T' };

beforeEach(() => { vi.resetAllMocks(); });

// ---------------------------------------------------------------------------
// createSession — usa researcherId do serviço (nunca do body)
// ---------------------------------------------------------------------------

describe('createSession', () => {
  it('cria sessão com researcherId passado pelo service (do JWT)', async () => {
    vi.mocked(prisma.session.create).mockResolvedValue(sessionOfA as never);
    await createSession(RES_A, 'Turma A', 'ABAC');
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ researcherId: RES_A }),
    });
  });
});

// ---------------------------------------------------------------------------
// addParticipant — ownership
// ---------------------------------------------------------------------------

describe('addParticipant — ownership', () => {
  it('lança erro (404-semântico) se sessão pertence a outra pesquisadora', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(sessionOfA as never); // sessão de A
    await expect(addParticipant(SESS_ID, RES_B, 'P1', 'Alice', 'G1P1'))
      .rejects.toThrow(SessionBootstrapError);
    await expect(addParticipant(SESS_ID, RES_B, 'P1', 'Alice', 'G1P1'))
      .rejects.toThrow(/não encontrada/);
    // Nunca deve criar o participante
    expect(prisma.sessionParticipant.create).not.toHaveBeenCalled();
  });

  it('lança erro se sessão inexistente (mesmo erro — não revela existência)', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null as never);
    await expect(addParticipant(SESS_ID, RES_A, 'P1', 'Alice', 'G1P1'))
      .rejects.toThrow(/não encontrada/);
    expect(prisma.sessionParticipant.create).not.toHaveBeenCalled();
  });

  it('cria participante quando ownership é válida', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(sessionOfA as never);
    vi.mocked(prisma.sessionParticipant.create).mockResolvedValue({ id: 'sp-001' } as never);
    await addParticipant(SESS_ID, RES_A, 'P1', 'Alice', 'G1P1');
    expect(prisma.sessionParticipant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sessionId: SESS_ID, slot: 'P1' }),
    });
  });
});

// ---------------------------------------------------------------------------
// startSession — ownership
// ---------------------------------------------------------------------------

describe('startSession — ownership', () => {
  it('lança erro se sessão pertence a outra pesquisadora', async () => {
    // Configura o mock do tx.session.findUnique para retornar sessão de A
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        session: {
          findUnique: vi.fn().mockResolvedValue(sessionOfA), // sessão de A
          update: vi.fn(),
        },
        sessionParticipant: { findMany: vi.fn() },
        trialTemplate: { findMany: vi.fn() },
        attempt: { createMany: vi.fn() },
      };
      return cb(tx);
    });

    await expect(startSession(SESS_ID, RES_B)).rejects.toThrow(/não encontrada/);
  });
});

// ---------------------------------------------------------------------------
// getSession — ownership
// ---------------------------------------------------------------------------

describe('getSession — ownership', () => {
  it('lança erro se sessão pertence a outra pesquisadora', async () => {
    vi.mocked(prisma.session.findUnique)
      .mockResolvedValueOnce(sessionOfA as never)  // loadOwnedSession
      .mockResolvedValueOnce(sessionOfA as never); // findUnique final
    await expect(getSession(SESS_ID, RES_B)).rejects.toThrow(/não encontrada/);
  });

  it('lança erro se sessão inexistente', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null as never);
    await expect(getSession(SESS_ID, RES_A)).rejects.toThrow(/não encontrada/);
  });

  it('retorna sessão quando ownership é válida', async () => {
    const fullSession = { ...sessionOfA, participants: [], _count: { attempts: 0 } };
    vi.mocked(prisma.session.findUnique)
      .mockResolvedValueOnce(sessionOfA as never)    // loadOwnedSession
      .mockResolvedValueOnce(fullSession as never);  // findUnique com include
    const result = await getSession(SESS_ID, RES_A);
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listSessions — retorna somente sessões da pesquisadora
// ---------------------------------------------------------------------------

describe('listSessions', () => {
  it('filtra por researcherId e ordena da mais recente para mais antiga', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([sessionOfA] as never);
    await listSessions(RES_A);
    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { researcherId: RES_A },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('pesquisadora B não vê sessões de A', async () => {
    // Simula findMany retornando apenas sessões do filtro — pesquisadora B não tem sessões
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    const result = await listSessions(RES_B);
    expect(result).toHaveLength(0);
    // Garante que o filtro usa RES_B, não RES_A
    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { researcherId: RES_B } })
    );
  });

  it('retorna lista vazia quando pesquisadora não tem sessões', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    const result = await listSessions(RES_A);
    expect(result).toEqual([]);
  });
});
