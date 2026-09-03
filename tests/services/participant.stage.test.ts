import { describe, expect, it } from 'vitest';
import { deriveStage } from '../../src/services/participant.stage';
import type { PartnerStatus } from '../../src/services/participant.stage';

const noPartner:       PartnerStatus = { hasJudgment: false, hasPunishment: false, hasAck: false };
const partnerJudged:   PartnerStatus = { hasJudgment: true,  hasPunishment: false, hasAck: false };
const partnerPunished: PartnerStatus = { hasJudgment: true,  hasPunishment: true,  hasAck: false };
const partnerAcked:    PartnerStatus = { hasJudgment: true,  hasPunishment: true,  hasAck: true  };

const ownJudged    = { judgment: 'Just',   punishment: null,      resultAcknowledgedAt: null };
const ownPunished  = { judgment: 'Just',   punishment: 'NoPunish', resultAcknowledgedAt: null };
const ownAcked     = { judgment: 'Just',   punishment: 'NoPunish', resultAcknowledgedAt: new Date() };

describe('WAITING_SESSION / COMPLETED', () => {
  it('WAITING → WAITING_SESSION', () => {
    expect(deriveStage('WAITING', false, null, null, false)).toBe('WAITING_SESSION');
    expect(deriveStage('WAITING', true,  null, null, false)).toBe('WAITING_SESSION');
  });
  it('COMPLETED → COMPLETED', () => {
    expect(deriveStage('COMPLETED', false, null, null, false)).toBe('COMPLETED');
  });
  it('IN_PROGRESS sem attempt ativo → COMPLETED', () => {
    expect(deriveStage('IN_PROGRESS', false, null, null, false)).toBe('COMPLETED');
  });
});

describe('JUDGMENT', () => {
  it('sem resposta → JUDGMENT', () => {
    expect(deriveStage('IN_PROGRESS', true, null, noPartner, false)).toBe('JUDGMENT');
  });
  it('judgment null → JUDGMENT', () => {
    expect(deriveStage('IN_PROGRESS', true,
      { judgment: null, punishment: null, resultAcknowledgedAt: null }, noPartner, false
    )).toBe('JUDGMENT');
  });
});

describe('WAITING_JUDGMENT_PARTNER', () => {
  it('próprio julgou, parceiro não → WAITING_JUDGMENT_PARTNER', () => {
    expect(deriveStage('IN_PROGRESS', true, ownJudged, noPartner, false)).toBe('WAITING_JUDGMENT_PARTNER');
  });
});

describe('PUNISHMENT', () => {
  it('ambos julgaram, próprio sem punishment → PUNISHMENT', () => {
    expect(deriveStage('IN_PROGRESS', true, ownJudged, partnerJudged, false)).toBe('PUNISHMENT');
  });
});

describe('WAITING_PUNISHMENT_PARTNER', () => {
  it('próprio puniu, parceiro não → WAITING_PUNISHMENT_PARTNER', () => {
    expect(deriveStage('IN_PROGRESS', true, ownPunished, partnerJudged, false)).toBe('WAITING_PUNISHMENT_PARTNER');
  });
  it('ambos puniram MAS attemptFinalized=false → WAITING_PUNISHMENT_PARTNER (finalizeAttempt em curso)', () => {
    expect(deriveStage('IN_PROGRESS', true, ownPunished, partnerPunished, false)).toBe('WAITING_PUNISHMENT_PARTNER');
  });
});

describe('RESULT', () => {
  it('ambos puniram E attemptFinalized=true, sem ack → RESULT', () => {
    expect(deriveStage('IN_PROGRESS', true, ownPunished, partnerPunished, true)).toBe('RESULT');
  });
  it('RESULT não requer que ambos tenham escolhido Punish — NoPunish também gera RESULT', () => {
    const ownNoPunish = { judgment: 'Just', punishment: 'NoPunish', resultAcknowledgedAt: null };
    const partnerNoPunish: PartnerStatus = { hasJudgment: true, hasPunishment: true, hasAck: false };
    expect(deriveStage('IN_PROGRESS', true, ownNoPunish, partnerNoPunish, true)).toBe('RESULT');
  });
});

describe('WAITING_RESULT_PARTNER', () => {
  it('próprio deu ack, parceiro não → WAITING_RESULT_PARTNER', () => {
    expect(deriveStage('IN_PROGRESS', true, ownAcked, partnerPunished, true)).toBe('WAITING_RESULT_PARTNER');
  });
});
