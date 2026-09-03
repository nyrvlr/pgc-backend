/**
 * participant.stage.ts
 * Lógica pura de derivação de estágio do participante. Sem Prisma.
 *
 * Fluxo por tentativa (conforme protocolo da tese):
 *   JUDGMENT → WAITING_JUDGMENT_PARTNER → PUNISHMENT →
 *   WAITING_PUNISHMENT_PARTNER → RESULT → WAITING_RESULT_PARTNER →
 *   próxima tentativa (ou COMPLETED no trial 64)
 */

export type ParticipantStage =
  | 'WAITING_SESSION'            // Session ainda WAITING
  | 'JUDGMENT'                   // vez de julgar
  | 'WAITING_JUDGMENT_PARTNER'   // julgamento feito, aguardando parceiro julgar
  | 'PUNISHMENT'                 // ambos julgaram, vez de decidir punição
  | 'WAITING_PUNISHMENT_PARTNER' // punição feita, aguardando parceiro decidir
  | 'RESULT'                     // ambos concluíram a decisão de punição E attempt foi finalizado (TrialRecord existe); participante ainda não deu ack
  | 'WAITING_RESULT_PARTNER'     // ack dado, aguardando parceiro dar ack
  | 'COMPLETED';                 // trial 64 com ambos os acks, ou Session COMPLETED

export type OwnResponse = {
  judgment:             string | null;
  punishment:           string | null;
  resultAcknowledgedAt: Date | null;
} | null;

export type PartnerStatus = {
  hasJudgment:   boolean;
  hasPunishment: boolean;
  hasAck:        boolean;
};

/**
 * Deriva o estágio a partir do status da Session, existência de attempt ativo,
 * respostas do próprio participante, estado do parceiro e se o Attempt já foi
 * finalizado com TrialRecord.
 *
 * attemptFinalized = true somente quando Attempt.completedAt !== null E TrialRecord existe.
 * RESULT nunca é retornado se attemptFinalized = false, mesmo que ambos tenham punishment.
 */
export function deriveStage(
  sessionStatus: string,
  hasActiveAttempt: boolean,
  ownResponse: OwnResponse,
  partnerStatus: PartnerStatus | null,
  attemptFinalized: boolean,
): ParticipantStage {
  if (sessionStatus === 'WAITING')   return 'WAITING_SESSION';
  if (sessionStatus === 'COMPLETED') return 'COMPLETED';

  // IN_PROGRESS
  if (!hasActiveAttempt) return 'COMPLETED';

  const own = ownResponse ?? { judgment: null, punishment: null, resultAcknowledgedAt: null };

  // Etapa 1: julgamento próprio
  if (!own.judgment) return 'JUDGMENT';

  // Etapa 2: aguardar parceiro julgar
  if (!partnerStatus?.hasJudgment) return 'WAITING_JUDGMENT_PARTNER';

  // Etapa 3: punição própria
  if (!own.punishment) return 'PUNISHMENT';

  // Etapa 4: aguardar parceiro punir OU finalização do Attempt ainda em curso
  // Permanecer em WAITING_PUNISHMENT_PARTNER até que o TrialRecord exista
  if (!partnerStatus?.hasPunishment || !attemptFinalized) return 'WAITING_PUNISHMENT_PARTNER';

  // Etapa 5: ambos concluíram punição E attempt foi finalizado — aguardar ack do próprio
  if (!own.resultAcknowledgedAt) return 'RESULT';

  // Etapa 6: aguardar parceiro dar ack
  if (!partnerStatus?.hasAck) return 'WAITING_RESULT_PARTNER';

  return 'WAITING_RESULT_PARTNER';
}
