import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/http/app';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/services/session.service', () => ({
  createSession:  vi.fn(),
  addParticipant: vi.fn(),
  startSession:   vi.fn(),
  getSession:     vi.fn(),
  listSessions:   vi.fn(),
}));

vi.mock('../../src/services/auth.service', () => ({
  login:         vi.fn(),
  verifyToken:   vi.fn(),
  getResearcher: vi.fn(),
}));

vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(), deriveStage: vi.fn(),
}));
vi.mock('../../src/services/response.service', () => ({
  submitJudgment: vi.fn(), submitPunishment: vi.fn(), submitAcknowledge: vi.fn(),
}));

import * as sessionService from '../../src/services/session.service';
import * as authService from '../../src/services/auth.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RES_ID   = 'res-001';
const BEARER   = 'Bearer valid.jwt.token';

const mockSession = {
  id: 'sess-001', researcherId: RES_ID, name: 'Turma A', sequenceVariant: 'ABAC',
  status: 'WAITING', createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), startedAt: null, completedAt: null,
};

const mockParticipant = {
  id: 'sp-001', sessionId: 'sess-001', slot: 'P1', displayName: 'Alice',
  participantCode: 'G1P1', accessToken: 'token-abc',
  joinedAt: null, lastSeenAt: null, createdAt: new Date().toISOString(),
};

const mockParticipantPublic = {
  id: 'sp-001', slot: 'P1', displayName: 'Alice', participantCode: 'G1P1',
  joinedAt: null, lastSeenAt: null, createdAt: new Date().toISOString(),
};

function authOk() {
  vi.mocked(authService.verifyToken).mockReturnValue(RES_ID);
}

beforeEach(() => {
  vi.resetAllMocks();
  // Por padrão, token sempre válido — testes de 401 sobrescrevem
  authOk();
});

// ---------------------------------------------------------------------------
// 401 sem token — todas as rotas /sessions
// ---------------------------------------------------------------------------

describe('401 sem token de autenticação', () => {
  it('POST /sessions → 401', async () => {
    vi.mocked(authService.verifyToken).mockImplementation(() => {
      throw new SessionBootstrapError('Token JWT inválido ou expirado.');
    });
    const res = await request(app).post('/sessions').send({ name: 'X', sequenceVariant: 'ABAC' });
    expect(res.status).toBe(401);
  });

  it('GET /sessions → 401 sem header', async () => {
    const res = await request(app).get('/sessions');
    // sem header Authorization → middleware rejeita antes de chamar verifyToken
    expect(res.status).toBe(401);
  });

  it('GET /sessions/:id → 401 sem header', async () => {
    const res = await request(app).get('/sessions/sess-001');
    expect(res.status).toBe(401);
  });

  it('POST /sessions/:id/start → 401 sem header', async () => {
    const res = await request(app).post('/sessions/sess-001/start').send();
    expect(res.status).toBe(401);
  });

  it('POST /sessions/:id/participants → 401 sem header', async () => {
    const res = await request(app).post('/sessions/sess-001/participants').send({});
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /sessions — listagem própria
// ---------------------------------------------------------------------------

describe('GET /sessions', () => {
  it('200 retorna lista de sessões da pesquisadora', async () => {
    vi.mocked(sessionService.listSessions).mockResolvedValue([mockSession] as never);
    const res = await request(app).get('/sessions').set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('sess-001');
    expect(sessionService.listSessions).toHaveBeenCalledWith(RES_ID);
  });

  it('200 com lista vazia quando não há sessões', async () => {
    vi.mocked(sessionService.listSessions).mockResolvedValue([]);
    const res = await request(app).get('/sessions').set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(sessionService.listSessions).mockRejectedValue(new Error('DB'));
    const res = await request(app).get('/sessions').set('Authorization', BEARER);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /sessions
// ---------------------------------------------------------------------------

describe('POST /sessions', () => {
  it('201 com body válido — researcherId vem do JWT', async () => {
    vi.mocked(sessionService.createSession).mockResolvedValue(mockSession as never);
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ name: 'Turma A', sequenceVariant: 'ABAC' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sess-001');
    // researcherId extraído do JWT, não do body
    expect(sessionService.createSession).toHaveBeenCalledWith(RES_ID, 'Turma A', 'ABAC');
  });

  it('researcherId enviado no body é ignorado — usa o do JWT', async () => {
    vi.mocked(sessionService.createSession).mockResolvedValue(mockSession as never);
    await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ researcherId: 'res-MALICIOSO', name: 'X', sequenceVariant: 'ABAC' });
    // Nunca deve usar res-MALICIOSO
    expect(sessionService.createSession).toHaveBeenCalledWith(RES_ID, 'X', 'ABAC');
    expect(sessionService.createSession).not.toHaveBeenCalledWith('res-MALICIOSO', expect.anything(), expect.anything());
  });

  it('400 sem name', async () => {
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ sequenceVariant: 'ABAC' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('400 com sequenceVariant inválida', async () => {
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ name: 'X', sequenceVariant: 'INVALID' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sequenceVariant/);
  });

  it('400 sem body', async () => {
    const res = await request(app).post('/sessions').set('Authorization', BEARER).send({});
    expect(res.status).toBe(400);
  });

  it.each(['ABAC', 'ACAB', 'BCBC', 'CBCB'])('201 para variante válida %s', async (variant) => {
    vi.mocked(sessionService.createSession).mockResolvedValue({ ...mockSession, sequenceVariant: variant } as never);
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ name: 'X', sequenceVariant: variant });
    expect(res.status).toBe(201);
  });

  it('400 para JSON malformado', async () => {
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .set('Content-Type', 'application/json').send('{invalid json}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformado/i);
  });

  it('409 para erro Prisma P2002', async () => {
    vi.mocked(sessionService.createSession).mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    );
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ name: 'X', sequenceVariant: 'ABAC' });
    expect(res.status).toBe(409);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(sessionService.createSession).mockRejectedValue(new Error('DB'));
    const res = await request(app).post('/sessions').set('Authorization', BEARER)
      .send({ name: 'X', sequenceVariant: 'ABAC' });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/participants
// ---------------------------------------------------------------------------

describe('POST /sessions/:sessionId/participants', () => {
  it('201 com body válido', async () => {
    vi.mocked(sessionService.addParticipant).mockResolvedValue(mockParticipant as never);
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(201);
    expect(sessionService.addParticipant).toHaveBeenCalledWith('sess-001', RES_ID, 'P1', 'Alice', 'G1P1');
  });

  it('404 quando sessão pertence a outra pesquisadora', async () => {
    vi.mocked(sessionService.addParticipant).mockRejectedValue(
      new SessionBootstrapError('Session não encontrada: sess-001')
    );
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(404);
  });

  it('400 com slot inválido', async () => {
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P3', displayName: 'X', participantCode: 'G1P3' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/P1|P2/);
  });

  it('400 sem displayName', async () => {
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P2', participantCode: 'G1P2' });
    expect(res.status).toBe(400);
  });

  it('400 sem participantCode', async () => {
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P2', displayName: 'Bob' });
    expect(res.status).toBe(400);
  });

  it('409 SessionBootstrapError (slot duplicado)', async () => {
    vi.mocked(sessionService.addParticipant).mockRejectedValue(
      new SessionBootstrapError('Slot P1 já ocupado.')
    );
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(409);
  });

  it('409 Prisma P2002', async () => {
    vi.mocked(sessionService.addParticipant).mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    );
    const res = await request(app).post('/sessions/sess-001/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P2', displayName: 'Bob', participantCode: 'G1P1' });
    expect(res.status).toBe(409);
  });

  it('404 Prisma P2025', async () => {
    vi.mocked(sessionService.addParticipant).mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'P2025' })
    );
    const res = await request(app).post('/sessions/sess-999/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(404);
  });

  it('404 Prisma P2003', async () => {
    vi.mocked(sessionService.addParticipant).mockRejectedValue(
      Object.assign(new Error('fk'), { code: 'P2003' })
    );
    const res = await request(app).post('/sessions/sess-999/participants')
      .set('Authorization', BEARER)
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/start
// ---------------------------------------------------------------------------

describe('POST /sessions/:sessionId/start', () => {
  it('200 com sessão iniciada', async () => {
    const started = { ...mockSession, status: 'IN_PROGRESS', startedAt: new Date().toISOString() };
    vi.mocked(sessionService.startSession).mockResolvedValue(started as never);
    const res = await request(app).post('/sessions/sess-001/start').set('Authorization', BEARER).send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(sessionService.startSession).toHaveBeenCalledWith('sess-001', RES_ID);
  });

  it('404 quando sessão pertence a outra pesquisadora', async () => {
    vi.mocked(sessionService.startSession).mockRejectedValue(
      new SessionBootstrapError('Session não encontrada: sess-001')
    );
    const res = await request(app).post('/sessions/sess-001/start').set('Authorization', BEARER).send();
    expect(res.status).toBe(404);
  });

  it('409 quando sessão não está WAITING', async () => {
    vi.mocked(sessionService.startSession).mockRejectedValue(
      new SessionBootstrapError('Session sess-001 não está em WAITING (status atual: IN_PROGRESS).')
    );
    const res = await request(app).post('/sessions/sess-001/start').set('Authorization', BEARER).send();
    expect(res.status).toBe(409);
  });

  it('409 quando faltam participantes', async () => {
    vi.mocked(sessionService.startSession).mockRejectedValue(
      new SessionBootstrapError('Session sess-001 requer exatamente P1 e P2.')
    );
    const res = await request(app).post('/sessions/sess-001/start').set('Authorization', BEARER).send();
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /sessions/:sessionId
// ---------------------------------------------------------------------------

describe('GET /sessions/:sessionId', () => {
  it('200 com sessão, participantes e contagem de attempts', async () => {
    const fullSession = { ...mockSession, participants: [mockParticipantPublic], _count: { attempts: 64 } };
    vi.mocked(sessionService.getSession).mockResolvedValue(fullSession as never);
    const res = await request(app).get('/sessions/sess-001').set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body._count.attempts).toBe(64);
    expect(sessionService.getSession).toHaveBeenCalledWith('sess-001', RES_ID);
    expect(res.body.participants[0].accessToken).toBeUndefined();
    expect(res.body.participants[0].id).toBe('sp-001');
  });

  it('404 quando sessão pertence a outra pesquisadora (mesmo erro que inexistente)', async () => {
    vi.mocked(sessionService.getSession).mockRejectedValue(
      new SessionBootstrapError('Session não encontrada: sess-001')
    );
    const res = await request(app).get('/sessions/sess-001').set('Authorization', BEARER);
    expect(res.status).toBe(404);
  });

  it('404 quando sessão não existe', async () => {
    vi.mocked(sessionService.getSession).mockResolvedValue(null as never);
    const res = await request(app).get('/sessions/sess-999').set('Authorization', BEARER);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/sess-999/);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(sessionService.getSession).mockRejectedValue(new Error('timeout'));
    const res = await request(app).get('/sessions/sess-001').set('Authorization', BEARER);
    expect(res.status).toBe(500);
  });
});
