import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/http/app';

// ---------------------------------------------------------------------------
// Mocks — apenas services, sem Prisma no router
// ---------------------------------------------------------------------------

vi.mock('../../src/services/session.service', () => ({
  createSession:  vi.fn(),
  addParticipant: vi.fn(),
  startSession:   vi.fn(),
  getSession:     vi.fn(),
}));

// participant.service é importado pelo app via participant.router — mockar para isolar Prisma
vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(),
  deriveStage: vi.fn(),
}));
import * as sessionService from '../../src/services/session.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  id: 'sess-001',
  researcherId: 'res-001',
  name: 'Turma A',
  sequenceVariant: 'ABAC',
  status: 'WAITING',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: null,
  completedAt: null,
};

const mockParticipant = {
  id: 'sp-001',
  sessionId: 'sess-001',
  slot: 'P1',
  displayName: 'Alice',
  participantCode: 'G1P1',
  accessToken: 'token-abc',
  joinedAt: null,
  lastSeenAt: null,
  createdAt: new Date().toISOString(),
};

// Participante sem accessToken — shape retornado por getSession
const mockParticipantPublic = {
  id: 'sp-001',
  slot: 'P1',
  displayName: 'Alice',
  participantCode: 'G1P1',
  joinedAt: null,
  lastSeenAt: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => { vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// POST /sessions
// ---------------------------------------------------------------------------

describe('POST /sessions', () => {
  it('201 com body válido', async () => {
    vi.mocked(sessionService.createSession).mockResolvedValue(mockSession as never);
    const res = await request(app).post('/sessions').send({
      researcherId: 'res-001', name: 'Turma A', sequenceVariant: 'ABAC',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sess-001');
    expect(sessionService.createSession).toHaveBeenCalledWith('res-001', 'Turma A', 'ABAC');
  });

  it('400 sem researcherId', async () => {
    const res = await request(app).post('/sessions').send({ name: 'X', sequenceVariant: 'ABAC' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/researcherId/);
  });

  it('400 sem name', async () => {
    const res = await request(app).post('/sessions').send({ researcherId: 'r', sequenceVariant: 'ABAC' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('400 com sequenceVariant inválida', async () => {
    const res = await request(app).post('/sessions').send({
      researcherId: 'r', name: 'X', sequenceVariant: 'INVALID',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sequenceVariant/);
  });

  it('400 sem body', async () => {
    const res = await request(app).post('/sessions').send({});
    expect(res.status).toBe(400);
  });

  it.each(['ABAC', 'ACAB', 'BCBC', 'CBCB'])('201 para variante válida %s', async (variant) => {
    vi.mocked(sessionService.createSession).mockResolvedValue({ ...mockSession, sequenceVariant: variant } as never);
    const res = await request(app).post('/sessions').send({
      researcherId: 'r', name: 'X', sequenceVariant: variant,
    });
    expect(res.status).toBe(201);
  });

  it('400 para JSON malformado', async () => {
    const res = await request(app)
      .post('/sessions')
      .set('Content-Type', 'application/json')
      .send('{invalid json}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformado/i);
  });

  it('409 para erro Prisma P2002 (unique constraint)', async () => {
    const prismaError = Object.assign(new Error('unique'), { code: 'P2002' });
    vi.mocked(sessionService.createSession).mockRejectedValue(prismaError);
    const res = await request(app).post('/sessions').send({
      researcherId: 'r', name: 'X', sequenceVariant: 'ABAC',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/duplicado/i);
  });

  it('500 para erro inesperado do service', async () => {
    vi.mocked(sessionService.createSession).mockRejectedValue(new Error('DB explodiu'));
    const res = await request(app).post('/sessions').send({
      researcherId: 'r', name: 'X', sequenceVariant: 'ABAC',
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /sessions/:sessionId/participants
// ---------------------------------------------------------------------------

describe('POST /sessions/:sessionId/participants', () => {
  it('201 com body válido', async () => {
    vi.mocked(sessionService.addParticipant).mockResolvedValue(mockParticipant as never);
    const res = await request(app)
      .post('/sessions/sess-001/participants')
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(201);
    expect(res.body.slot).toBe('P1');
    expect(sessionService.addParticipant).toHaveBeenCalledWith('sess-001', 'P1', 'Alice', 'G1P1');
  });

  it('400 com slot inválido', async () => {
    const res = await request(app)
      .post('/sessions/sess-001/participants')
      .send({ slot: 'P3', displayName: 'X', participantCode: 'G1P3' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/P1|P2/);
  });

  it('400 sem displayName', async () => {
    const res = await request(app)
      .post('/sessions/sess-001/participants')
      .send({ slot: 'P2', participantCode: 'G1P2' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/displayName/);
  });

  it('400 sem participantCode', async () => {
    const res = await request(app)
      .post('/sessions/sess-001/participants')
      .send({ slot: 'P2', displayName: 'Bob' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/participantCode/);
  });

  it('409 quando SessionBootstrapError (slot duplicado)', async () => {
    vi.mocked(sessionService.addParticipant).mockRejectedValue(
      new SessionBootstrapError('Slot P1 já ocupado.')
    );
    const res = await request(app)
      .post('/sessions/sess-001/participants')
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/P1/);
  });

  it('409 para erro Prisma P2002 (participantCode duplicado)', async () => {
    const prismaError = Object.assign(new Error('unique'), { code: 'P2002' });
    vi.mocked(sessionService.addParticipant).mockRejectedValue(prismaError);
    const res = await request(app)
      .post('/sessions/sess-001/participants')
      .send({ slot: 'P2', displayName: 'Bob', participantCode: 'G1P1' });
    expect(res.status).toBe(409);
  });

  it('404 para erro Prisma P2025 (session inexistente)', async () => {
    const prismaError = Object.assign(new Error('not found'), { code: 'P2025' });
    vi.mocked(sessionService.addParticipant).mockRejectedValue(prismaError);
    const res = await request(app)
      .post('/sessions/sess-999/participants')
      .send({ slot: 'P1', displayName: 'Alice', participantCode: 'G1P1' });
    expect(res.status).toBe(404);
  });

  it('404 para erro Prisma P2003 (FK violation)', async () => {
    const prismaError = Object.assign(new Error('fk'), { code: 'P2003' });
    vi.mocked(sessionService.addParticipant).mockRejectedValue(prismaError);
    const res = await request(app)
      .post('/sessions/sess-999/participants')
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
    const res = await request(app).post('/sessions/sess-001/start').send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(sessionService.startSession).toHaveBeenCalledWith('sess-001');
  });

  it('404 quando sessão não existe', async () => {
    vi.mocked(sessionService.startSession).mockRejectedValue(
      new SessionBootstrapError('Session não encontrada: sess-999')
    );
    const res = await request(app).post('/sessions/sess-999/start').send();
    expect(res.status).toBe(404);
  });

  it('409 quando sessão não está WAITING', async () => {
    vi.mocked(sessionService.startSession).mockRejectedValue(
      new SessionBootstrapError('Session sess-001 não está em WAITING (status atual: IN_PROGRESS).')
    );
    const res = await request(app).post('/sessions/sess-001/start').send();
    expect(res.status).toBe(409);
  });

  it('409 quando faltam participantes', async () => {
    vi.mocked(sessionService.startSession).mockRejectedValue(
      new SessionBootstrapError('Session sess-001 requer exatamente P1 e P2.')
    );
    const res = await request(app).post('/sessions/sess-001/start').send();
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
    const res = await request(app).get('/sessions/sess-001');
    expect(res.status).toBe(200);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body._count.attempts).toBe(64);
    expect(sessionService.getSession).toHaveBeenCalledWith('sess-001');
    // accessToken não deve aparecer na listagem de participantes
    expect(res.body.participants[0].accessToken).toBeUndefined();
    expect(res.body.participants[0].id).toBe('sp-001');
    expect(res.body.participants[0].slot).toBe('P1');
  });

  it('404 quando sessão não existe', async () => {
    vi.mocked(sessionService.getSession).mockResolvedValue(null as never);
    const res = await request(app).get('/sessions/sess-999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/sess-999/);
  });

  it('404 para erro Prisma P2025', async () => {
    const prismaError = Object.assign(new Error('not found'), { code: 'P2025' });
    vi.mocked(sessionService.getSession).mockRejectedValue(prismaError);
    const res = await request(app).get('/sessions/sess-001');
    expect(res.status).toBe(404);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(sessionService.getSession).mockRejectedValue(new Error('timeout'));
    const res = await request(app).get('/sessions/sess-001');
    expect(res.status).toBe(500);
  });
});
