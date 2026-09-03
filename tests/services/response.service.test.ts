import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mocks declarados antes de qualquer import do módulo testado
vi.mock('../../src/config/prisma', () => ({
  prisma: {
    sessionParticipant: { findUnique: vi.fn() },
    attempt: {
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
    },
    response: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/services/trial.service', () => ({
  recordJudgment:   vi.fn(),
  recordPunishment: vi.fn(),
}));

vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(),
}));

import { submitJudgment, submitPunishment } from '../../src/services/response.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';
import * as trialService from '../../src/services/trial.service';
import * as participantService from '../../src/services/participant.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSp = {
  id: 'sp-001',
  sessionId: 'sess-001',
  accessToken: 'tok-abc',
  session: { status: 'IN_PROGRESS' },
};

const mockAttempt = {
  id: 'att-001',
  sessionId: 'sess-001',
  globalNumber: 5,
  completedAt: null,
};

const mockState = { stage: 'PUNISHMENT' };

function setupHappyPath() {
  vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
  vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
  vi.mocked(prisma.attempt.findFirst).mockResolvedValue({ id: 'att-001' } as never);
  vi.mocked(prisma.response.findUnique).mockResolvedValue(null as never);
  vi.mocked(trialService.recordJudgment).mockResolvedValue(undefined as never);
  vi.mocked(trialService.recordPunishment).mockResolvedValue(undefined as never);
  vi.mocked(participantService.getParticipantState).mockResolvedValue(mockState as never);
}

beforeEach(() => { vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// Validações de entrada — submitJudgment
// ---------------------------------------------------------------------------

describe('submitJudgment — validações', () => {
  it('lança 401 para token inválido (participante não encontrado)', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null as never);
    await expect(submitJudgment('bad-token', 'att-001', 'Just'))
      .rejects.toThrow(SessionBootstrapError);
    await expect(submitJudgment('bad-token', 'att-001', 'Just'))
      .rejects.toThrow(/inválido/);
  });

  it('lança erro para Session não IN_PROGRESS (WAITING)', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue({
      ...mockSp, session: { status: 'WAITING' },
    } as never);
    await expect(submitJudgment('tok-abc', 'att-001', 'Just'))
      .rejects.toThrow(SessionBootstrapError);
    await expect(submitJudgment('tok-abc', 'att-001', 'Just'))
      .rejects.toThrow(/IN_PROGRESS/);
  });

  it('lança erro para Session não IN_PROGRESS (COMPLETED)', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue({
      ...mockSp, session: { status: 'COMPLETED' },
    } as never);
    await expect(submitJudgment('tok-abc', 'att-001', 'Just'))
      .rejects.toThrow(SessionBootstrapError);
  });

  it('lança 404 para Attempt inexistente', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null as never);
    await expect(submitJudgment('tok-abc', 'att-999', 'Just'))
      .rejects.toThrow(/não encontrado/);
  });

  it('lança erro para Attempt de outra Session', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      ...mockAttempt, sessionId: 'sess-OUTRA',
    } as never);
    await expect(submitJudgment('tok-abc', 'att-001', 'Just'))
      .rejects.toThrow(/não pertence/);
  });

  it('lança erro para Attempt já finalizado — antes de verificar ordem', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      ...mockAttempt, completedAt: new Date(),
    } as never);
    await expect(submitJudgment('tok-abc', 'att-001', 'Just'))
      .rejects.toThrow(/finalizado/);
    // findFirst NÃO deve ser chamado — completedAt é verificado antes
    expect(prisma.attempt.findFirst).not.toHaveBeenCalled();
  });

  it('lança erro para Attempt fora de ordem', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    // Primeiro pendente é outro attempt
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({ id: 'att-002' } as never);
    await expect(submitJudgment('tok-abc', 'att-001', 'Just'))
      .rejects.toThrow(/não é o próximo/);
  });
});

// ---------------------------------------------------------------------------
// Idempotência e conflito de judgment
// ---------------------------------------------------------------------------

describe('submitJudgment — idempotência e conflito', () => {
  it('retry com mesmo valor é idempotente — não chama recordJudgment', async () => {
    setupHappyPath();
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: null } as never
    );
    const result = await submitJudgment('tok-abc', 'att-001', 'Just');
    expect(trialService.recordJudgment).not.toHaveBeenCalled();
    expect(result).toBe(mockState);
  });

  it('valor diferente ao registrado lança SessionBootstrapError', async () => {
    setupHappyPath();
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: null } as never
    );
    await expect(submitJudgment('tok-abc', 'att-001', 'Unjust'))
      .rejects.toThrow(SessionBootstrapError);
    await expect(submitJudgment('tok-abc', 'att-001', 'Unjust'))
      .rejects.toThrow(/Julgamento já registrado/);
    expect(trialService.recordJudgment).not.toHaveBeenCalled();
  });

  it('sem resposta existente chama recordJudgment com sp.id correto', async () => {
    setupHappyPath();
    await submitJudgment('tok-abc', 'att-001', 'Just');
    expect(trialService.recordJudgment).toHaveBeenCalledWith('att-001', 'sp-001', 'Just');
  });

  it('retorna getParticipantState após persistência bem-sucedida', async () => {
    setupHappyPath();
    const result = await submitJudgment('tok-abc', 'att-001', 'Unjust');
    expect(participantService.getParticipantState).toHaveBeenCalledWith('tok-abc');
    expect(result).toBe(mockState);
  });
});

// ---------------------------------------------------------------------------
// Validações de entrada — submitPunishment
// ---------------------------------------------------------------------------

describe('submitPunishment — validações', () => {
  it('lança erro para token inválido', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null as never);
    await expect(submitPunishment('bad', 'att-001', 'Punish'))
      .rejects.toThrow(/inválido/);
  });

  it('lança erro para Attempt inexistente', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null as never);
    await expect(submitPunishment('tok-abc', 'att-999', 'Punish'))
      .rejects.toThrow(/não encontrado/);
  });

  it('lança erro para Attempt já finalizado — antes de verificar ordem', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      ...mockAttempt, completedAt: new Date(),
    } as never);
    await expect(submitPunishment('tok-abc', 'att-001', 'Punish'))
      .rejects.toThrow(/finalizado/);
    expect(prisma.attempt.findFirst).not.toHaveBeenCalled();
  });

  it('lança erro para Attempt fora de ordem', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({ id: 'att-002' } as never);
    await expect(submitPunishment('tok-abc', 'att-001', 'Punish'))
      .rejects.toThrow(/não é o próximo/);
  });
});

// ---------------------------------------------------------------------------
// Idempotência e conflito de punishment
// ---------------------------------------------------------------------------

describe('submitPunishment — idempotência e conflito', () => {
  it('retry com mesmo valor é idempotente — não chama recordPunishment', async () => {
    setupHappyPath();
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { punishment: 'Punish' } as never
    );
    const result = await submitPunishment('tok-abc', 'att-001', 'Punish');
    expect(trialService.recordPunishment).not.toHaveBeenCalled();
    expect(result).toBe(mockState);
  });

  it('valor diferente ao registrado lança SessionBootstrapError', async () => {
    setupHappyPath();
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { punishment: 'Punish' } as never
    );
    await expect(submitPunishment('tok-abc', 'att-001', 'NoPunish'))
      .rejects.toThrow(SessionBootstrapError);
    await expect(submitPunishment('tok-abc', 'att-001', 'NoPunish'))
      .rejects.toThrow(/já registrada/);
    expect(trialService.recordPunishment).not.toHaveBeenCalled();
  });

  it('sem resposta existente chama recordPunishment com sp.id correto', async () => {
    setupHappyPath();
    await submitPunishment('tok-abc', 'att-001', 'NoPunish');
    expect(trialService.recordPunishment).toHaveBeenCalledWith('att-001', 'sp-001', 'NoPunish');
  });

  it('retorna getParticipantState após persistência bem-sucedida', async () => {
    setupHappyPath();
    const result = await submitPunishment('tok-abc', 'att-001', 'Punish');
    expect(participantService.getParticipantState).toHaveBeenCalledWith('tok-abc');
    expect(result).toBe(mockState);
  });
});
