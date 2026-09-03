import { describe, expect, it } from 'vitest';
import { deriveStage } from '../../src/services/participant.stage';

describe('deriveStage — WAITING_SESSION', () => {
  it('session WAITING → WAITING_SESSION independente do resto', () => {
    expect(deriveStage('WAITING', false, null)).toBe('WAITING_SESSION');
    expect(deriveStage('WAITING', true,  null)).toBe('WAITING_SESSION');
  });
});

describe('deriveStage — COMPLETED', () => {
  it('session COMPLETED → COMPLETED', () => {
    expect(deriveStage('COMPLETED', false, null)).toBe('COMPLETED');
  });

  it('IN_PROGRESS sem attempt ativo → COMPLETED (todas as tentativas finalizadas)', () => {
    expect(deriveStage('IN_PROGRESS', false, null)).toBe('COMPLETED');
  });
});

describe('deriveStage — JUDGMENT', () => {
  it('attempt ativo sem resposta → JUDGMENT', () => {
    expect(deriveStage('IN_PROGRESS', true, null)).toBe('JUDGMENT');
  });

  it('attempt ativo com judgment null → JUDGMENT', () => {
    expect(deriveStage('IN_PROGRESS', true, { judgment: null, punishment: null })).toBe('JUDGMENT');
  });
});

describe('deriveStage — PUNISHMENT', () => {
  it('judgment feito, punishment pendente → PUNISHMENT', () => {
    expect(deriveStage('IN_PROGRESS', true, { judgment: 'Just',   punishment: null })).toBe('PUNISHMENT');
    expect(deriveStage('IN_PROGRESS', true, { judgment: 'Unjust', punishment: null })).toBe('PUNISHMENT');
  });
});

describe('deriveStage — WAITING_PARTNER', () => {
  it('ambas as respostas dadas → WAITING_PARTNER', () => {
    expect(deriveStage('IN_PROGRESS', true, { judgment: 'Just',   punishment: 'NoPunish' })).toBe('WAITING_PARTNER');
    expect(deriveStage('IN_PROGRESS', true, { judgment: 'Unjust', punishment: 'Punish'   })).toBe('WAITING_PARTNER');
  });
});
