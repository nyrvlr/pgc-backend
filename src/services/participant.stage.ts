/**
 * participant.stage.ts
 * Lógica pura de derivação de estágio do participante. Sem Prisma.
 */

export type ParticipantStage =
  | 'WAITING_SESSION'
  | 'JUDGMENT'
  | 'PUNISHMENT'
  | 'WAITING_PARTNER'
  | 'COMPLETED';

export type OwnResponse = {
  judgment: string | null;
  punishment: string | null;
} | null;

export function deriveStage(
  sessionStatus: string,
  hasActiveAttempt: boolean,
  ownResponse: OwnResponse,
): ParticipantStage {
  if (sessionStatus === 'WAITING')   return 'WAITING_SESSION';
  if (sessionStatus === 'COMPLETED') return 'COMPLETED';

  // IN_PROGRESS
  if (!hasActiveAttempt) return 'COMPLETED';

  if (!ownResponse || !ownResponse.judgment) return 'JUDGMENT';
  if (!ownResponse.punishment)               return 'PUNISHMENT';
  return 'WAITING_PARTNER';
}
