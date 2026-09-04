/**
 * provision-researcher.test.ts
 * Testa a lógica pura de provisionamento — sem banco real.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/prisma', () => ({
  prisma: {
    researcher: { upsert: vi.fn() },
  },
}));

import { validateInput, provisionResearcher } from '../../src/scripts/provision-researcher';
import { prisma } from '../../src/config/prisma';
import bcrypt from 'bcryptjs';

beforeEach(() => { vi.resetAllMocks(); });

// ---------------------------------------------------------------------------
// validateInput — normalização e validação
// ---------------------------------------------------------------------------

describe('validateInput — validação', () => {
  it('lança erro quando RESEARCHER_NAME está ausente', () => {
    expect(() => validateInput(undefined, 'a@b.com', 'senha'))
      .toThrow(/RESEARCHER_NAME/);
  });

  it('lança erro quando RESEARCHER_EMAIL está ausente', () => {
    expect(() => validateInput('Luiza', undefined, 'senha'))
      .toThrow(/RESEARCHER_EMAIL/);
  });

  it('lança erro quando RESEARCHER_PASSWORD está ausente', () => {
    expect(() => validateInput('Luiza', 'a@b.com', undefined))
      .toThrow(/RESEARCHER_PASSWORD/);
  });

  it('lança erro quando qualquer campo é string vazia', () => {
    expect(() => validateInput('', 'a@b.com', 'senha')).toThrow(/RESEARCHER_NAME/);
    expect(() => validateInput('Luiza', '', 'senha')).toThrow(/RESEARCHER_EMAIL/);
    expect(() => validateInput('Luiza', 'a@b.com', '')).toThrow(/RESEARCHER_PASSWORD/);
  });

  it('lança erro quando campo é apenas espaços em branco', () => {
    expect(() => validateInput('   ', 'a@b.com', 'senha')).toThrow(/RESEARCHER_NAME/);
    expect(() => validateInput('Luiza', '   ', 'senha')).toThrow(/RESEARCHER_EMAIL/);
    expect(() => validateInput('Luiza', 'a@b.com', '   ')).toThrow(/RESEARCHER_PASSWORD/);
  });

  it('lista todos os campos ausentes na mesma mensagem de erro', () => {
    expect(() => validateInput(undefined, undefined, undefined))
      .toThrow(/RESEARCHER_NAME.*RESEARCHER_EMAIL.*RESEARCHER_PASSWORD/);
  });
});

describe('validateInput — normalização', () => {
  it('normaliza email para lowercase', () => {
    const result = validateInput('Luiza', 'Luiza@UNB.BR', 'senha');
    expect(result.email).toBe('luiza@unb.br');
  });

  it('faz trim em todos os campos', () => {
    const result = validateInput('  Luiza  ', '  luiza@unb.br  ', '  senha  ');
    expect(result.name).toBe('Luiza');
    expect(result.email).toBe('luiza@unb.br');
    expect(result.password).toBe('senha');
  });

  it('combina trim + lowercase no email', () => {
    const result = validateInput('N', '  LUIZA@UNB.BR  ', 'p');
    expect(result.email).toBe('luiza@unb.br');
  });

  it('retorna os três campos válidos', () => {
    const result = validateInput('Luiza Caldas', 'luiza@unb.br', 'senha123');
    expect(result).toEqual({ name: 'Luiza Caldas', email: 'luiza@unb.br', password: 'senha123' });
  });
});

// ---------------------------------------------------------------------------
// provisionResearcher — hash e upsert
// ---------------------------------------------------------------------------

describe('provisionResearcher — hash e upsert', () => {
  const input = { name: 'Luiza Caldas', email: 'luiza@unb.br', password: 'senha123' };
  const mockResult = { id: 'res-001', name: 'Luiza Caldas', email: 'luiza@unb.br' };

  it('chama bcrypt.hash com 10 rounds', async () => {
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(mockResult as never);
    const spy = vi.spyOn(bcrypt, 'hash');
    await provisionResearcher(input);
    expect(spy).toHaveBeenCalledWith('senha123', 10);
  });

  it('chama upsert com email como chave e passwordHash gerado', async () => {
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(mockResult as never);
    await provisionResearcher(input);
    const call = vi.mocked(prisma.researcher.upsert).mock.calls[0][0];
    expect(call.where).toEqual({ email: 'luiza@unb.br' });
    expect(call.create.name).toBe('Luiza Caldas');
    expect(call.create.email).toBe('luiza@unb.br');
    expect(call.create.passwordHash).toBeTruthy();
    expect(typeof call.create.passwordHash).toBe('string');
    expect(call.create.passwordHash).toMatch(/^\$2[ab]\$10\$/);
  });

  it('upsert com update também contém passwordHash (atualização)', async () => {
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(mockResult as never);
    await provisionResearcher(input);
    const call = vi.mocked(prisma.researcher.upsert).mock.calls[0][0];
    expect(call.update.passwordHash).toBeTruthy();
    expect(call.update.name).toBe('Luiza Caldas');
  });

  it('select exclui passwordHash — somente id, name, email', async () => {
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(mockResult as never);
    await provisionResearcher(input);
    const call = vi.mocked(prisma.researcher.upsert).mock.calls[0][0];
    expect(call.select).toEqual({ id: true, name: true, email: true });
    // passwordHash não deve estar em select
    expect((call.select as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});

describe('provisionResearcher — retorno sem senha/hash', () => {
  it('retorna somente id, name e email', async () => {
    const mockResult = { id: 'res-001', name: 'Luiza Caldas', email: 'luiza@unb.br' };
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(mockResult as never);
    const result = await provisionResearcher({ name: 'Luiza Caldas', email: 'luiza@unb.br', password: 'senha' });
    expect(result).toEqual({ id: 'res-001', name: 'Luiza Caldas', email: 'luiza@unb.br' });
    expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((result as Record<string, unknown>).password).toBeUndefined();
  });

  it('retorno não contém senha nem passwordHash (stringify confirma)', async () => {
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(
      { id: 'res-001', name: 'Luiza', email: 'luiza@unb.br' } as never
    );
    const result = await provisionResearcher({ name: 'Luiza', email: 'luiza@unb.br', password: 'senha-secreta' });
    const json = JSON.stringify(result);
    expect(json).not.toContain('senha-secreta');
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain('Hash');
  });

  it('senhas diferentes geram hashes diferentes (bcrypt real)', async () => {
    vi.mocked(prisma.researcher.upsert).mockResolvedValue(
      { id: 'r', name: 'N', email: 'e@e.com' } as never
    );
    await provisionResearcher({ name: 'N', email: 'e@e.com', password: 'senhaA' });
    await provisionResearcher({ name: 'N', email: 'e@e.com', password: 'senhaB' });
    const callA = vi.mocked(prisma.researcher.upsert).mock.calls[0][0].create.passwordHash;
    const callB = vi.mocked(prisma.researcher.upsert).mock.calls[1][0].create.passwordHash;
    expect(callA).not.toBe(callB);
  });
});
