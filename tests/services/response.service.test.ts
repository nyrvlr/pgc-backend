import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    sessionParticipant: { findUnique: vi.fn(), findMany: vi.fn() },
    attempt:  { findUnique: vi.fn(), findFirst: vi.fn() },
    response: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    session:  { update: vi.fn() },
    trialRecord: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/services/trial.service', () => ({
  recordJudgment:    vi.fn(),
  recordPunishment:  vi.fn(),
  finalizeAttempt:   vi.fn(),
  acknowledgeResult: vi.fn(),
}));

vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(),
}));

import { submitJudgment, submitPunishment, submitAcknowledge } from '../../src/services/response.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';
import * as trialService from '../../src/services/trial.service';
import * as participantService from '../../src/services/participant.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSp         = { id: 'sp-001', sessionId: 'sess-001', accessToken: 'tok', session: { status: 'IN_PROGRESS' } };
const mockAttempt    = { id: 'att-001', sessionId: 'sess-001', globalNumber: 5,  completedAt: null };
const mockAttemptDone  = { id: 'att-001', sessionId: 'sess-001', globalNumber: 5,  completedAt: new Date() };
const mockAttempt64Done = { id: 'att-064', sessionId: 'sess-001', globalNumber: 64, completedAt: new Date() };
const twoParticipants   = [{ id: 'sp-001' }, { id: 'sp-002' }];

const mockStateWaiting    = { stage: 'WAITING_JUDGMENT_PARTNER' };
const mockStateResult     = { stage: 'RESULT' };
const mockStateWaitResult = { stage: 'WAITING_RESULT_PARTNER' };
const mockStateCompleted  = { stage: 'COMPLETED' };

// ---------------------------------------------------------------------------
// Helpers — configuram todos os mocks necessários para o caminho feliz.
// Cada helper é auto-suficiente: não depende de estado de testes anteriores.
// ---------------------------------------------------------------------------

function setupJudgmentHappy() {
  vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
  vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
  vi.mocked(prisma.attempt.findFirst)
    .mockResolvedValueOnce({ id: 'att-001' } as never) // firstPending
    .mockResolvedValueOnce(null as never);              // hasPendingResult → sem pendente
  vi.mocked(prisma.response.findUnique).mockResolvedValue(null as never);
  vi.mocked(trialService.recordJudgment).mockResolvedValue(undefined as never);
  vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateWaiting as never);
}

/**
 * Configura o caminho feliz de submitPunishment.
 * A sequência de mockResolvedValueOnce segue a ordem exata de chamadas no service:
 *   1. resolveActive → sessionParticipant.findUnique
 *   2. resolveActive → attempt.findUnique
 *   3. attempt.findFirst (primeiro pendente)
 *   4. sessionParticipant.findMany (bothHaveField)
 *   5. response.findUnique × 2 (bothHaveField judgment: sp-001, sp-002)
 *   6. response.findUnique (getOwnResponse — punishment prévio)
 *   7. response.findUnique × 2 (bothHaveField punishment: sp-001, sp-002)
 */
function setupPunishmentHappy(bothPunished = false) {
  vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
  vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
  vi.mocked(prisma.attempt.findFirst)
    .mockResolvedValueOnce({ id: 'att-001' } as never) // firstPending
    .mockResolvedValueOnce(null as never);              // hasPendingResult → sem pendente
  vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue(twoParticipants as never);
  vi.mocked(trialService.recordPunishment).mockResolvedValue(undefined as never);
  vi.mocked(trialService.finalizeAttempt).mockResolvedValue(undefined as never);
  vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateResult as never);

  // bothHaveField('judgment'): sp-001 e sp-002 ambos têm
  vi.mocked(prisma.response.findUnique)
    .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
    .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
    // getOwnResponse: sem punishment prévio
    .mockResolvedValueOnce(null as never);

  // bothHaveField('punishment')
  if (bothPunished) {
    vi.mocked(prisma.response.findUnique)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never);
  } else {
    vi.mocked(prisma.response.findUnique)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never)
      .mockResolvedValueOnce(null as never); // sp-002 ainda não puniu
  }
}

// resetAllMocks garante que implementações (mockResolvedValue) não vazam entre testes
beforeEach(() => { vi.resetAllMocks(); });

// ===========================================================================
// submitJudgment — validações
// ===========================================================================

describe('submitJudgment — validações', () => {
  it('token inválido → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null as never);
    await expect(submitJudgment('bad', 'att-001', 'Just')).rejects.toThrow(/inválido/);
  });

  it('Session não IN_PROGRESS → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(
      { ...mockSp, session: { status: 'WAITING' } } as never
    );
    // resolveActive carrega attempt antes de verificar session.status
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    await expect(submitJudgment('tok', 'att-001', 'Just')).rejects.toThrow(/IN_PROGRESS/);
  });

  it('Attempt inexistente → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null as never);
    await expect(submitJudgment('tok', 'att-999', 'Just')).rejects.toThrow(/não encontrado/);
  });

  it('Attempt de outra Session → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(
      { ...mockAttempt, sessionId: 'sess-OUTRA' } as never
    );
    await expect(submitJudgment('tok', 'att-001', 'Just')).rejects.toThrow(/não pertence/);
  });

  it('Attempt já finalizado sem resposta → erro (não busca firstPending)', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(null as never);
    await expect(submitJudgment('tok', 'att-001', 'Just')).rejects.toThrow(/finalizado/);
    expect(prisma.attempt.findFirst).not.toHaveBeenCalled();
  });

  it('Attempt fora de ordem → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({ id: 'att-002' } as never);
    await expect(submitJudgment('tok', 'att-001', 'Just')).rejects.toThrow(/não é o próximo/);
  });

  it('retry com mesmo judgment é idempotente', async () => {
    setupJudgmentHappy();
    // sobrescreve o response.findUnique configurado no helper
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never
    );
    await submitJudgment('tok', 'att-001', 'Just');
    expect(trialService.recordJudgment).not.toHaveBeenCalled();
  });

  it('valor diferente ao registrado → 409', async () => {
    setupJudgmentHappy();
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never
    );
    await expect(submitJudgment('tok', 'att-001', 'Unjust')).rejects.toThrow(/Julgamento já registrado/);
  });

  it('chama recordJudgment com sp.id correto', async () => {
    setupJudgmentHappy();
    await submitJudgment('tok', 'att-001', 'Just');
    expect(trialService.recordJudgment).toHaveBeenCalledWith('att-001', 'sp-001', 'Just');
  });

  it('nunca chama finalizeAttempt', async () => {
    setupJudgmentHappy();
    await submitJudgment('tok', 'att-001', 'Just');
    expect(trialService.finalizeAttempt).not.toHaveBeenCalled();
  });

  it('retry com mesmo valor após Attempt finalizado → idempotente', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never
    );
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateResult as never);
    const result = await submitJudgment('tok', 'att-001', 'Just');
    expect(trialService.recordJudgment).not.toHaveBeenCalled();
    expect(result).toBe(mockStateResult);
  });

  it('valor diferente após Attempt finalizado → 409', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never
    );
    await expect(submitJudgment('tok', 'att-001', 'Unjust')).rejects.toThrow(/Julgamento já registrado/);
  });
});

// ===========================================================================
// submitPunishment — bloqueio antes do segundo judgment
// ===========================================================================

describe('submitPunishment — bloqueia se parceiro não julgou', () => {
  it('parceiro sem judgment → 409', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst)
      .mockResolvedValueOnce({ id: 'att-001' } as never) // firstPending
      .mockResolvedValueOnce(null as never);              // hasPendingResult → sem pendente
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue(twoParticipants as never);
    // bothHaveField('judgment'): sp-001 tem, sp-002 não tem
    vi.mocked(prisma.response.findUnique)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
      .mockResolvedValueOnce(null as never);
    await expect(submitPunishment('tok', 'att-001', 'Punish'))
      .rejects.toThrow(/Aguardando julgamento do parceiro/);
    expect(trialService.recordPunishment).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// submitPunishment — validações
// ===========================================================================

describe('submitPunishment — validações', () => {
  it('token inválido → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null as never);
    await expect(submitPunishment('bad', 'att-001', 'Punish')).rejects.toThrow(/inválido/);
  });

  it('Session não IN_PROGRESS → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(
      { ...mockSp, session: { status: 'WAITING' } } as never
    );
    // resolveActive carrega attempt antes de verificar session.status
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    await expect(submitPunishment('tok', 'att-001', 'Punish')).rejects.toThrow(/IN_PROGRESS/);
  });

  it('Attempt inexistente → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null as never);
    await expect(submitPunishment('tok', 'att-999', 'Punish')).rejects.toThrow(/não encontrado/);
  });

  it('Attempt de outra Session → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(
      { ...mockAttempt, sessionId: 'sess-OUTRA' } as never
    );
    await expect(submitPunishment('tok', 'att-001', 'Punish')).rejects.toThrow(/não pertence/);
  });

  it('Attempt já finalizado sem resposta → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(null as never);
    await expect(submitPunishment('tok', 'att-001', 'Punish')).rejects.toThrow(/finalizado/);
  });

  it('Attempt fora de ordem → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst).mockResolvedValue({ id: 'att-002' } as never);
    await expect(submitPunishment('tok', 'att-001', 'Punish')).rejects.toThrow(/não é o próximo/);
  });

  it('valor diferente ao registrado → 409', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst)
      .mockResolvedValueOnce({ id: 'att-001' } as never) // firstPending
      .mockResolvedValueOnce(null as never);              // hasPendingResult → sem pendente
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue(twoParticipants as never);
    // bothHaveField('judgment'): ambos têm
    vi.mocked(prisma.response.findUnique)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
      // getOwnResponse: punishment já registrado
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never);
    await expect(submitPunishment('tok', 'att-001', 'NoPunish')).rejects.toThrow(/já registrada/);
  });
});

// ===========================================================================
// submitPunishment — coordenação de rodada
// ===========================================================================

describe('submitPunishment — coordenação de rodada', () => {
  it('ambos julgaram → punishment aceito (não bloqueia)', async () => {
    // Verifica que quando bothHaveField('judgment') = true,
    // recordPunishment é chamado normalmente sem lançar erro de bloqueio
    setupPunishmentHappy(false);
    await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.recordPunishment).toHaveBeenCalledWith('att-001', 'sp-001', 'Punish');
  });

  it('apenas um puniu → não chama finalizeAttempt, retorna estado WAITING_PUNISHMENT_PARTNER', async () => {
    setupPunishmentHappy(false);
    vi.mocked(participantService.getParticipantState).mockResolvedValue(
      { stage: 'WAITING_PUNISHMENT_PARTNER' } as never
    );
    const result = await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.finalizeAttempt).not.toHaveBeenCalled();
    expect((result as { stage: string }).stage).toBe('WAITING_PUNISHMENT_PARTNER');
  });

  it('ambos puniram → chama finalizeAttempt', async () => {
    setupPunishmentHappy(true);
    await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.finalizeAttempt).toHaveBeenCalledWith('att-001');
  });

  it('só um puniu → não chama finalizeAttempt', async () => {
    setupPunishmentHappy(false);
    await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.finalizeAttempt).not.toHaveBeenCalled();
  });

  it('chama recordPunishment com sp.id correto', async () => {
    setupPunishmentHappy(false);
    await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.recordPunishment).toHaveBeenCalledWith('att-001', 'sp-001', 'Punish');
  });

  it('retorno após ambos punirem chama getParticipantState', async () => {
    setupPunishmentHappy(true);
    const result = await submitPunishment('tok', 'att-001', 'Punish');
    expect(participantService.getParticipantState).toHaveBeenCalledWith('tok');
    expect(result).toBe(mockStateResult);
  });

  it('retry idempotente em attempt ativo continua verificando coordenação', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst)
      .mockResolvedValueOnce({ id: 'att-001' } as never) // firstPending
      .mockResolvedValueOnce(null as never);              // hasPendingResult → sem pendente
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue(twoParticipants as never);
    vi.mocked(trialService.finalizeAttempt).mockResolvedValue(undefined as never);
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateResult as never);
    // bothHaveField('judgment'): ambos têm
    vi.mocked(prisma.response.findUnique)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: null, resultAcknowledgedAt: null } as never)
      // getOwnResponse: punishment já existe (retry)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never)
      // bothHaveField('punishment'): ambos têm
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never)
      .mockResolvedValueOnce({ judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never);
    await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.recordPunishment).not.toHaveBeenCalled();
    expect(trialService.finalizeAttempt).toHaveBeenCalledWith('att-001');
  });
});

// ===========================================================================
// submitPunishment — idempotência pós-finalização
// ===========================================================================

describe('submitPunishment — pós-finalização', () => {
  it('retry com mesmo punishment após Attempt finalizado → idempotente', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never
    );
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateResult as never);
    const result = await submitPunishment('tok', 'att-001', 'Punish');
    expect(trialService.recordPunishment).not.toHaveBeenCalled();
    expect(result).toBe(mockStateResult);
  });

  it('retry com mesmo punishment após trial 64 / COMPLETED → idempotente', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt64Done as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: 'NoPunish', resultAcknowledgedAt: new Date() } as never
    );
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateCompleted as never);
    const result = await submitPunishment('tok', 'att-064', 'NoPunish');
    expect(result).toBe(mockStateCompleted);
  });

  it('valor diferente após Attempt finalizado → 409', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never
    );
    await expect(submitPunishment('tok', 'att-001', 'NoPunish')).rejects.toThrow(/já registrada/);
  });

  it('response.service não chama session.update diretamente', async () => {
    setupPunishmentHappy(true);
    await submitPunishment('tok', 'att-001', 'Punish');
    expect(prisma.session.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// submitAcknowledge
// ===========================================================================

describe('submitAcknowledge', () => {
  it('delega para acknowledgeResult com ids corretos', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(trialService.acknowledgeResult).mockResolvedValue(undefined as never);
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateWaitResult as never);
    const result = await submitAcknowledge('tok', 'att-001');
    expect(trialService.acknowledgeResult).toHaveBeenCalledWith('att-001', 'sp-001');
    expect(result).toBe(mockStateWaitResult);
  });

  it('ack intermediário → retorna WAITING_RESULT_PARTNER', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(trialService.acknowledgeResult).mockResolvedValue(undefined as never);
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateWaitResult as never);
    const result = await submitAcknowledge('tok', 'att-001');
    expect(result).toBe(mockStateWaitResult);
  });

  it('ack final (trial 64) → retorna COMPLETED', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt64Done as never);
    vi.mocked(trialService.acknowledgeResult).mockResolvedValue(undefined as never);
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateCompleted as never);
    const result = await submitAcknowledge('tok', 'att-064');
    expect(result).toBe(mockStateCompleted);
  });

  it('attempt ainda não finalizado → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    await expect(submitAcknowledge('tok', 'att-001')).rejects.toThrow(/ainda não foi finalizado/);
  });

  it('token inválido → erro', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null as never);
    await expect(submitAcknowledge('bad', 'att-001')).rejects.toThrow(/inválido/);
  });
});

// ===========================================================================
// Barreira de resultado pendente
// ===========================================================================

describe('barreira de resultado pendente (submitJudgment)', () => {
  it('trial N finalizada com ack pendente + judgment da trial N+1 → 409', async () => {
    // resolveActive: sp e attempt N+1 (ativo)
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never); // completedAt: null
    // firstPending aponta para este attempt (em ordem)
    vi.mocked(prisma.attempt.findFirst)
      .mockResolvedValueOnce({ id: 'att-001' } as never)  // firstPending
      .mockResolvedValueOnce({ id: 'att-prev' } as never); // hasPendingResult → encontrou pendente
    await expect(submitJudgment('tok', 'att-001', 'Just'))
      .rejects.toThrow(/Aguardando confirmação do resultado da tentativa anterior/);
    expect(trialService.recordJudgment).not.toHaveBeenCalled();
  });

  it('após ambos os acks (hasPendingResult = null), judgment da trial N+1 → permitido', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst)
      .mockResolvedValueOnce({ id: 'att-001' } as never) // firstPending
      .mockResolvedValueOnce(null as never);             // hasPendingResult → nenhum pendente
    vi.mocked(prisma.response.findUnique).mockResolvedValue(null as never);
    vi.mocked(trialService.recordJudgment).mockResolvedValue(undefined as never);
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateWaiting as never);
    await submitJudgment('tok', 'att-001', 'Just');
    expect(trialService.recordJudgment).toHaveBeenCalledWith('att-001', 'sp-001', 'Just');
  });

  it('retry do mesmo judgment na própria trial já finalizada → idempotente (não testa hasPendingResult)', async () => {
    // Attempt já finalizado: vai pelo caminho pós-finalização, não pela barreira
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttemptDone as never);
    vi.mocked(prisma.response.findUnique).mockResolvedValue(
      { judgment: 'Just', punishment: 'Punish', resultAcknowledgedAt: null } as never
    );
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockStateResult as never);
    const result = await submitJudgment('tok', 'att-001', 'Just');
    expect(trialService.recordJudgment).not.toHaveBeenCalled();
    // hasPendingResult NÃO é chamado — o fluxo retorna antes por completedAt
    expect(prisma.attempt.findFirst).not.toHaveBeenCalled();
    expect(result).toBe(mockStateResult);
  });
});

describe('barreira de resultado pendente (submitPunishment)', () => {
  it('trial N finalizada com ack pendente + punishment da trial N+1 → 409', async () => {
    vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(mockSp as never);
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(mockAttempt as never);
    vi.mocked(prisma.attempt.findFirst)
      .mockResolvedValueOnce({ id: 'att-001' } as never)  // firstPending
      .mockResolvedValueOnce({ id: 'att-prev' } as never); // hasPendingResult → pendente
    await expect(submitPunishment('tok', 'att-001', 'Punish'))
      .rejects.toThrow(/Aguardando confirmação do resultado da tentativa anterior/);
    expect(trialService.recordPunishment).not.toHaveBeenCalled();
  });
});
