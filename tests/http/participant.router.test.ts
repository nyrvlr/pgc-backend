import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/http/app';

vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(),
  deriveStage: vi.fn(),
}));

// session.service é importado pelo app via session.router — mockar para isolar Prisma
vi.mock('../../src/services/session.service', () => ({
  createSession:  vi.fn(),
  addParticipant: vi.fn(),
  startSession:   vi.fn(),
  getSession:     vi.fn(),
}));

import * as participantService from '../../src/services/participant.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';

const mockState = {
  participant: {
    id: 'sp-001',
    slot: 'P1',
    displayName: 'Alice',
    participantCode: 'G1P1',
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  session: { id: 'sess-001', name: 'Turma A', status: 'IN_PROGRESS' },
  stage: 'JUDGMENT',
  currentAttempt: {
    id: 'att-001',
    endowment: 32,
    distributorDistribution: 24,
    receptorDistribution: 8,
    distributorCharacter: 'Lucas',
    receptorCharacter: 'Isaac',
  },
};

beforeEach(() => { vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// GET /participant/me
// ---------------------------------------------------------------------------

describe('GET /participant/me', () => {
  it('200 com token válido', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockState as never);
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer valid-token-123');
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('JUDGMENT');
    expect(res.body.participant.slot).toBe('P1');
    expect(participantService.getParticipantState).toHaveBeenCalledWith('valid-token-123');
  });

  it('não expõe accessToken do participante', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockState as never);
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer valid-token-123');
    expect(res.status).toBe(200);
    expect(res.body.participant.accessToken).toBeUndefined();
  });

  it('não expõe sequenceVariant nem condition', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue(mockState as never);
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer valid-token-123');
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
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/malformado|Bearer/i);
  });

  it('401 com header Bearer sem token', async () => {
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('401 com token inválido (SessionBootstrapError)', async () => {
    vi.mocked(participantService.getParticipantState).mockRejectedValue(
      new SessionBootstrapError('Token inválido ou participante não encontrado.')
    );
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer token-inexistente');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido/i);
  });

  it('200 com stage WAITING_SESSION quando sessão ainda não iniciou', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue({
      ...mockState,
      session: { ...mockState.session, status: 'WAITING' },
      stage: 'WAITING_SESSION',
      currentAttempt: null,
    } as never);
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer token-abc');
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('WAITING_SESSION');
    expect(res.body.currentAttempt).toBeNull();
  });

  it('200 com stage COMPLETED e currentAttempt null', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue({
      ...mockState,
      stage: 'COMPLETED',
      currentAttempt: null,
    } as never);
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer token-abc');
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('COMPLETED');
    expect(res.body.currentAttempt).toBeNull();
  });

  it('200 com stage WAITING_PARTNER', async () => {
    vi.mocked(participantService.getParticipantState).mockResolvedValue({
      ...mockState,
      stage: 'WAITING_PARTNER',
    } as never);
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer token-abc');
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('WAITING_PARTNER');
  });

  it('500 para erro inesperado do service', async () => {
    vi.mocked(participantService.getParticipantState).mockRejectedValue(new Error('DB timeout'));
    const res = await request(app)
      .get('/participant/me')
      .set('Authorization', 'Bearer token-abc');
    expect(res.status).toBe(500);
  });
});
