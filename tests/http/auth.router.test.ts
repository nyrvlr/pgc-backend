/**
 * auth.router.test.ts
 * Testes HTTP de /auth/login e /auth/me com services mockados.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/http/app';

vi.mock('../../src/services/auth.service', () => ({
  login:         vi.fn(),
  verifyToken:   vi.fn(),
  getResearcher: vi.fn(),
}));

// Mocks das outras rotas para isolar app.ts
vi.mock('../../src/services/session.service', () => ({
  createSession: vi.fn(), addParticipant: vi.fn(),
  startSession:  vi.fn(), getSession: vi.fn(),
}));
vi.mock('../../src/services/participant.service', () => ({
  getParticipantState: vi.fn(), deriveStage: vi.fn(),
}));
vi.mock('../../src/services/response.service', () => ({
  submitJudgment: vi.fn(), submitPunishment: vi.fn(), submitAcknowledge: vi.fn(),
}));

import * as authService from '../../src/services/auth.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';

const BEARER = 'Bearer valid.jwt.token';

const mockLoginResult = {
  token: 'signed.jwt.token',
  researcher: { id: 'res-001', name: 'Luiza Caldas', email: 'luiza@unb.br' },
};

beforeEach(() => { vi.resetAllMocks(); });

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
  it('200 com credenciais válidas — retorna token e researcher sem passwordHash', async () => {
    vi.mocked(authService.login).mockResolvedValue(mockLoginResult);
    const res = await request(app).post('/auth/login')
      .send({ email: 'luiza@unb.br', password: 'senha123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('signed.jwt.token');
    expect(res.body.researcher.id).toBe('res-001');
    expect(res.body.researcher.passwordHash).toBeUndefined();
    expect(authService.login).toHaveBeenCalledWith('luiza@unb.br', 'senha123');
  });

  it('400 sem email', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/);
  });

  it('400 sem password', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/);
  });

  it('400 sem body', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('401 com credenciais inválidas', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new SessionBootstrapError('Credenciais inválidas.')
    );
    const res = await request(app).post('/auth/login')
      .send({ email: 'luiza@unb.br', password: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Credenciais inválidas/);
  });

  it('400 para JSON malformado', async () => {
    const res = await request(app).post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{malformado}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/malformado/i);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error('DB down'));
    const res = await request(app).post('/auth/login')
      .send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(500);
  });

  it('resposta não expõe passwordHash', async () => {
    vi.mocked(authService.login).mockResolvedValue(mockLoginResult);
    const res = await request(app).post('/auth/login')
      .send({ email: 'luiza@unb.br', password: 'senha123' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('Hash');
  });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

describe('GET /auth/me', () => {
  it('200 com token válido — retorna researcher sem passwordHash', async () => {
    vi.mocked(authService.verifyToken).mockReturnValue('res-001');
    vi.mocked(authService.getResearcher).mockResolvedValue(
      { id: 'res-001', name: 'Luiza Caldas', email: 'luiza@unb.br' }
    );
    const res = await request(app).get('/auth/me').set('Authorization', BEARER);

    expect(res.status).toBe(200);
    expect(res.body.researcher.id).toBe('res-001');
    expect(res.body.researcher.passwordHash).toBeUndefined();
    expect(authService.verifyToken).toHaveBeenCalledWith('valid.jwt.token');
    expect(authService.getResearcher).toHaveBeenCalledWith('res-001');
  });

  it('401 sem Authorization header', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authorization/i);
  });

  it('401 com header malformado (sem Bearer)', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/malformado|Bearer/i);
  });

  it('401 com token inválido', async () => {
    vi.mocked(authService.verifyToken).mockImplementation(() => {
      throw new SessionBootstrapError('Token JWT inválido ou expirado.');
    });
    const res = await request(app).get('/auth/me').set('Authorization', BEARER);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido/);
  });

  it('401 quando researcher não encontrada (token válido mas researcher deletada)', async () => {
    vi.mocked(authService.verifyToken).mockReturnValue('res-deletada');
    vi.mocked(authService.getResearcher).mockRejectedValue(
      new SessionBootstrapError('Pesquisadora não encontrada.')
    );
    const res = await request(app).get('/auth/me').set('Authorization', BEARER);
    expect(res.status).toBe(401);
  });

  it('500 para erro inesperado', async () => {
    vi.mocked(authService.verifyToken).mockReturnValue('res-001');
    vi.mocked(authService.getResearcher).mockRejectedValue(new Error('DB down'));
    const res = await request(app).get('/auth/me').set('Authorization', BEARER);
    expect(res.status).toBe(500);
  });
});
