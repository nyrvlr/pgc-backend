import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/http/app';

vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(), deriveStage: vi.fn(),
}));
vi.mock('../../src/services/response.service', () => ({
  submitJudgment: vi.fn(), submitPunishment: vi.fn(), submitAcknowledge: vi.fn(),
}));
vi.mock('../../src/services/session.service', () => ({
  createSession: vi.fn(), addParticipant: vi.fn(), startSession: vi.fn(), getSession: vi.fn(),
}));

import * as participantService from '../../src/services/participant.service';
import * as responseService from '../../src/services/response.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';

const BEARER = 'Bearer valid-token';
const mockState = {
  participant: { id: 'sp-001', slot: 'P1', displayName: 'Alice', participantCode: 'G1P1',
    joinedAt: null, lastSeenAt: null, createdAt: new Date().toISOString() },
  session: { id: 'sess-001', name: 'Turma A', status: 'IN_PROGRESS' },
  stage: 'JUDGMENT',
  currentAttempt: { id: 'att-001', endowment: 32, distributorDistribution: 24,
    receptorDistribution: 8, distributorCharacter: 'Lucas', receptorCharacter: 'Isaac' },
  trialResult: null,
};

beforeEach(() => { vi.clearAllMocks(); });

// ===========================================================================
// GET /participant/me
// ===========================================================================

describe('GET /participant/me', () => {
  it('200 com token válido', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockState as never);
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('JUDGMENT');
  });

  it('não expõe accessToken nem sequenceVariant', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockState as never);
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.body.participant.accessToken).toBeUndefined();
    expect(res.body.session.sequenceVariant).toBeUndefined();
    expect(res.body.currentAttempt?.condition).toBeUndefined();
    expect(res.body.currentAttempt?.blockNumber).toBeUndefined();
    expect(res.body.currentAttempt?.globalNumber).toBeUndefined();
  });

  it('401 sem Authorization header', async () => {
    const res = await request(app).get('/participant/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authorization/i);
  });

  it('401 com header malformado (sem Bearer)', async () => {
    const res = await request(app).get('/participant/me').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/malformado|Bearer/i);
  });

  it('401 com token inválido', async () => {
    vi.mocked(participantService.getParticipantState).mockRejectedValue(
      new SessionBootstrapError('Token inválido ou participante não encontrado.')
    );
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.status).toBe(401);
  });

  it('200 com stage WAITING_SESSION', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(
      { ...mockState, stage: 'WAITING_SESSION', currentAttempt: null } as never
    );
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.body.stage).toBe('WAITING_SESSION');
    expect(res.body.currentAttempt).toBeNull();
  });

  it('200 com stage WAITING_JUDGMENT_PARTNER', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(
      { ...mockState, stage: 'WAITING_JUDGMENT_PARTNER' } as never
    );
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.body.stage).toBe('WAITING_JUDGMENT_PARTNER');
  });

  it('200 com stage RESULT e trialResult preenchido', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue({
      ...mockState, stage: 'RESULT',
      trialResult: { ownIndividualCost: 1, ownCoinsAfter: 79, punishmentApplied: true,
        distributorResult: { character: 'Lucas', finalCoins: 8, coinsLost: 16 },
        culturalConsequence: 3, groupCoinsAfter: 3 },
    } as never);
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.body.stage).toBe('RESULT');
    expect(res.body.trialResult.ownIndividualCost).toBe(1);
    expect(res.body.trialResult.distributorResult).toBeTruthy();
  });

  it('200 com stage COMPLETED e currentAttempt null', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(
      { ...mockState, stage: 'COMPLETED', currentAttempt: null } as never
    );
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.body.stage).toBe('COMPLETED');
    expect(res.body.currentAttempt).toBeNull();
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(participantService.getParticipantState).mockRejectedValue(new Error('DB'));
    const res = await request(app).get('/participant/me').set('Authorization', BEARER);
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// POST /participant/attempts/:attemptId/judgment
// ===========================================================================

describe('POST /participant/attempts/:id/judgment', () => {
  it('200 com Just válido — retorna estado atualizado', async () => {
    vi.mocked(responseService.submitJudgment).mockResolvedValue(
      { ...mockState, stage: 'WAITING_JUDGMENT_PARTNER' } as never
    );
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('WAITING_JUDGMENT_PARTNER');
    expect(responseService.submitJudgment).toHaveBeenCalledWith('valid-token', 'att-001', 'Just');
  });

  it('200 com Unjust válido', async () => {
    vi.mocked(responseService.submitJudgment).mockResolvedValue(mockState as never);
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Unjust' });
    expect(res.status).toBe(200);
  });

  it('400 com valor inválido', async () => {
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Just|Unjust/);
  });

  it('400 sem body', async () => {
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({});
    expect(res.status).toBe(400);
  });

  it('401 sem token', async () => {
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .send({ judgment: 'Just' });
    expect(res.status).toBe(401);
  });

  it('401 com token inválido', async () => {
    vi.mocked(responseService.submitJudgment).mockRejectedValue(
      new SessionBootstrapError('Token inválido ou participante não encontrado.')
    );
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(401);
  });

  it('404 quando Attempt não encontrado', async () => {
    vi.mocked(responseService.submitJudgment).mockRejectedValue(
      new SessionBootstrapError('Attempt não encontrado: att-999')
    );
    const res = await request(app).post('/participant/attempts/att-999/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(404);
  });

  it('409 quando Attempt fora de ordem', async () => {
    vi.mocked(responseService.submitJudgment).mockRejectedValue(
      new SessionBootstrapError('Attempt att-005 não é o próximo a ser respondido.')
    );
    const res = await request(app).post('/participant/attempts/att-005/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(409);
  });

  it('409 quando Attempt de outra Session', async () => {
    vi.mocked(responseService.submitJudgment).mockRejectedValue(
      new SessionBootstrapError('Attempt att-001 não pertence à Session do participante.')
    );
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(409);
  });

  it('409 quando Attempt já finalizado', async () => {
    vi.mocked(responseService.submitJudgment).mockRejectedValue(
      new SessionBootstrapError('Attempt att-001 já foi finalizado.')
    );
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(409);
  });

  it('resposta não expõe dados do parceiro, condition ou variante', async () => {
    vi.mocked(responseService.submitJudgment).mockResolvedValue(
      { ...mockState, stage: 'WAITING_JUDGMENT_PARTNER' } as never
    );
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.body.session?.sequenceVariant).toBeUndefined();
    expect(res.body.currentAttempt?.condition).toBeUndefined();
    expect(res.body.currentAttempt?.globalNumber).toBeUndefined();
    expect(res.body.currentAttempt?.blockNumber).toBeUndefined();
    expect(res.body.trialResult?.culturant).toBeUndefined();
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(responseService.submitJudgment).mockRejectedValue(new Error('DB timeout'));
    const res = await request(app).post('/participant/attempts/att-001/judgment')
      .set('Authorization', BEARER).send({ judgment: 'Just' });
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// POST /participant/attempts/:attemptId/punishment
// ===========================================================================

describe('POST /participant/attempts/:id/punishment', () => {
  it('200 com Punish válido', async () => {
    vi.mocked(responseService.submitPunishment).mockResolvedValue(
      { ...mockState, stage: 'WAITING_PUNISHMENT_PARTNER' } as never
    );
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'Punish' });
    expect(res.status).toBe(200);
    expect(responseService.submitPunishment).toHaveBeenCalledWith('valid-token', 'att-001', 'Punish');
  });

  it('200 com NoPunish válido', async () => {
    vi.mocked(responseService.submitPunishment).mockResolvedValue(mockState as never);
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'NoPunish' });
    expect(res.status).toBe(200);
  });

  it('400 com valor inválido', async () => {
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Punish|NoPunish/);
  });

  it('400 sem body', async () => {
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({});
    expect(res.status).toBe(400);
  });

  it('401 sem token', async () => {
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .send({ punishment: 'Punish' });
    expect(res.status).toBe(401);
  });

  it('409 parceiro não julgou ainda', async () => {
    vi.mocked(responseService.submitPunishment).mockRejectedValue(
      new SessionBootstrapError('Aguardando julgamento do parceiro antes de aceitar decisão de punição.')
    );
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'Punish' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/parceiro/i);
  });

  it('409 quando julgamento ainda não feito (trial.service)', async () => {
    vi.mocked(responseService.submitPunishment).mockRejectedValue(
      new SessionBootstrapError('Participante sp-001 ainda não registrou julgamento para Attempt att-001.')
    );
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'Punish' });
    expect(res.status).toBe(409);
  });

  it('409 quando Attempt de outra Session', async () => {
    vi.mocked(responseService.submitPunishment).mockRejectedValue(
      new SessionBootstrapError('Attempt att-001 não pertence à Session do participante.')
    );
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'Punish' });
    expect(res.status).toBe(409);
  });

  it('404 quando Attempt não encontrado', async () => {
    vi.mocked(responseService.submitPunishment).mockRejectedValue(
      new SessionBootstrapError('Attempt não encontrado: att-999')
    );
    const res = await request(app).post('/participant/attempts/att-999/punishment')
      .set('Authorization', BEARER).send({ punishment: 'Punish' });
    expect(res.status).toBe(404);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(responseService.submitPunishment).mockRejectedValue(new Error('DB timeout'));
    const res = await request(app).post('/participant/attempts/att-001/punishment')
      .set('Authorization', BEARER).send({ punishment: 'Punish' });
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// POST /participant/attempts/:attemptId/result/acknowledge
// ===========================================================================

describe('POST /participant/attempts/:id/result/acknowledge', () => {
  it('200 com ack bem-sucedido → WAITING_RESULT_PARTNER', async () => {
    vi.mocked(responseService.submitAcknowledge).mockResolvedValue(
      { ...mockState, stage: 'WAITING_RESULT_PARTNER' } as never
    );
    const res = await request(app).post('/participant/attempts/att-001/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('WAITING_RESULT_PARTNER');
    expect(responseService.submitAcknowledge).toHaveBeenCalledWith('valid-token', 'att-001');
  });

  it('200 após trial 64 → COMPLETED', async () => {
    vi.mocked(responseService.submitAcknowledge).mockResolvedValue(
      { ...mockState, stage: 'COMPLETED', currentAttempt: null } as never
    );
    const res = await request(app).post('/participant/attempts/att-064/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('COMPLETED');
  });

  it('401 sem token', async () => {
    const res = await request(app).post('/participant/attempts/att-001/result/acknowledge').send();
    expect(res.status).toBe(401);
  });

  it('401 com token inválido', async () => {
    vi.mocked(responseService.submitAcknowledge).mockRejectedValue(
      new SessionBootstrapError('Token inválido ou participante não encontrado.')
    );
    const res = await request(app).post('/participant/attempts/att-001/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.status).toBe(401);
  });

  it('409 attempt não finalizado', async () => {
    vi.mocked(responseService.submitAcknowledge).mockRejectedValue(
      new SessionBootstrapError('Attempt att-001 ainda não foi finalizado.')
    );
    const res = await request(app).post('/participant/attempts/att-001/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.status).toBe(409);
  });

  it('404 attempt não encontrado', async () => {
    vi.mocked(responseService.submitAcknowledge).mockRejectedValue(
      new SessionBootstrapError('Attempt não encontrado: att-999')
    );
    const res = await request(app).post('/participant/attempts/att-999/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.status).toBe(404);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(responseService.submitAcknowledge).mockRejectedValue(new Error('DB'));
    const res = await request(app).post('/participant/attempts/att-001/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.status).toBe(500);
  });

  it('resposta não expõe condition, variante ou bloco', async () => {
    vi.mocked(responseService.submitAcknowledge).mockResolvedValue(
      { ...mockState, stage: 'WAITING_RESULT_PARTNER' } as never
    );
    const res = await request(app).post('/participant/attempts/att-001/result/acknowledge')
      .set('Authorization', BEARER).send();
    expect(res.body.session?.sequenceVariant).toBeUndefined();
    expect(res.body.currentAttempt?.condition).toBeUndefined();
    expect(res.body.currentAttempt?.blockNumber).toBeUndefined();
    expect(res.body.currentAttempt?.globalNumber).toBeUndefined();
  });
});
