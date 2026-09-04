/**
 * auth.service.test.ts
 * Testes unitários de auth.service.ts com Prisma e bcrypt mockados.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    researcher: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/config/env', () => ({
  env: { jwtSecret: 'test-secret-32-chars-long-enough!' },
}));

import { login, verifyToken, getResearcher } from '../../src/services/auth.service';
import { SessionBootstrapError } from '../../src/services/session.drafts';
import { prisma } from '../../src/config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const HASH = bcrypt.hashSync('senha123', 10);

const mockResearcher = {
  id:           'res-001',
  name:         'Luiza Caldas',
  email:        'luiza@unb.br',
  passwordHash: HASH,
};

beforeEach(() => { vi.resetAllMocks(); });

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('login — sucesso', () => {
  it('retorna token e dados públicos sem passwordHash', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(mockResearcher as never);
    const result = await login('luiza@unb.br', 'senha123');

    expect(result.token).toBeTruthy();
    expect(result.researcher.id).toBe('res-001');
    expect(result.researcher.name).toBe('Luiza Caldas');
    expect(result.researcher.email).toBe('luiza@unb.br');
    expect((result.researcher as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('JWT contém somente sub (researcherId)', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(mockResearcher as never);
    const { token } = await login('luiza@unb.br', 'senha123');
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.sub).toBe('res-001');
    expect(payload.email).toBeUndefined();
    expect(payload.name).toBeUndefined();
    expect(payload.passwordHash).toBeUndefined();
  });
});

describe('login — falha', () => {
  it('senha incorreta → 401 sem revelar se email existe', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(mockResearcher as never);
    await expect(login('luiza@unb.br', 'errada')).rejects.toThrow(SessionBootstrapError);
    await expect(login('luiza@unb.br', 'errada')).rejects.toThrow(/Credenciais inválidas/);
  });

  it('email não encontrado → mesmo erro genérico (não revela ausência)', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(null as never);
    await expect(login('naoexiste@unb.br', 'qualquer')).rejects.toThrow(SessionBootstrapError);
    await expect(login('naoexiste@unb.br', 'qualquer')).rejects.toThrow(/Credenciais inválidas/);
  });

  it('erro de email não encontrado é indistinguível do erro de senha incorreta', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(null as never);
    let errNotFound: Error | null = null;
    try { await login('x@x.com', 'y'); } catch (e) { errNotFound = e as Error; }

    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(mockResearcher as never);
    let errWrongPwd: Error | null = null;
    try { await login('luiza@unb.br', 'errada'); } catch (e) { errWrongPwd = e as Error; }

    expect(errNotFound?.message).toBe(errWrongPwd?.message);
  });
});

// ---------------------------------------------------------------------------
// verifyToken
// ---------------------------------------------------------------------------

describe('login — timing attack safe', () => {
  it('email inexistente ainda chama bcrypt.compare com hash bcrypt válido (2b$10$)', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(null as never);
    const spy = vi.spyOn(bcrypt, 'compare');
    try { await login('naoexiste@unb.br', 'qualquer'); } catch { /* esperado */ }

    expect(spy).toHaveBeenCalledTimes(1);
    const hashUsado = spy.mock.calls[0][1] as string;
    // O hash deve ser um hash bcrypt real, não um placeholder inválido
    expect(hashUsado).toMatch(/^\$2[ab]\$\d+\$/);
  });
});

describe('verifyToken', () => {
  it('token válido retorna researcherId', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(mockResearcher as never);
    const { token } = await login('luiza@unb.br', 'senha123');
    const id = verifyToken(token);
    expect(id).toBe('res-001');
  });

  it('token adulterado → lança SessionBootstrapError', () => {
    expect(() => verifyToken('nao.e.um.jwt')).toThrow(SessionBootstrapError);
    expect(() => verifyToken('nao.e.um.jwt')).toThrow(/inválido/);
  });

  it('token de secret diferente → lança SessionBootstrapError', () => {
    const alien = jwt.sign({ sub: 'res-001' }, 'outro-secret');
    expect(() => verifyToken(alien)).toThrow(SessionBootstrapError);
  });

  it('JWT sem campo sub → lança SessionBootstrapError', () => {
    const noSub = jwt.sign({ role: 'researcher' }, 'test-secret-32-chars-long-enough!');
    expect(() => verifyToken(noSub)).toThrow(SessionBootstrapError);
    expect(() => verifyToken(noSub)).toThrow(/inválido/);
  });

  it('JWT com sub não-string (número) → lança SessionBootstrapError', () => {
    const numSub = jwt.sign({ sub: 12345 }, 'test-secret-32-chars-long-enough!');
    expect(() => verifyToken(numSub)).toThrow(SessionBootstrapError);
    expect(() => verifyToken(numSub)).toThrow(/inválido/);
  });
});

// ---------------------------------------------------------------------------
// getResearcher
// ---------------------------------------------------------------------------

describe('getResearcher', () => {
  it('retorna dados públicos sem passwordHash', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue({
      id: 'res-001', name: 'Luiza Caldas', email: 'luiza@unb.br',
    } as never);
    const result = await getResearcher('res-001');
    expect(result.id).toBe('res-001');
    expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('researcher não encontrada → lança SessionBootstrapError', async () => {
    vi.mocked(prisma.researcher.findUnique).mockResolvedValue(null as never);
    await expect(getResearcher('nao-existe')).rejects.toThrow(SessionBootstrapError);
    await expect(getResearcher('nao-existe')).rejects.toThrow(/não encontrada/);
  });
});
