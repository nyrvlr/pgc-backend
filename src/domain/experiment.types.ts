// =============================================================================
// experiment.types.ts
// Motor experimental do Jogo da Punição Altruísta (PGC)
// Tipos de domínio — sem dependências externas
// =============================================================================

// -----------------------------------------------------------------------------
// Condição experimental
// -----------------------------------------------------------------------------

/**
 * As três condições base do protocolo.
 * Reexposições (A', B', C') usam as mesmas regras — não são condições distintas.
 * A camada de sessão passa a condição base; a lógica de regras não precisa saber
 * se é primeira ou segunda exposição.
 */
export type Condition = 'A' | 'B' | 'C';

/**
 * Sequência de condições que define a variação do experimento.
 * Cada elemento é a condição base do bloco correspondente.
 * Experimento 1: ABAC e ACAB (4 blocos: A·B·A'·C e A·C·A'·B)
 * Experimento 2: BCBC e CBCB (4 blocos: B·C·B'·C' e C·B·C'·B')
 */
export type SequenceVariant = 'ABAC' | 'ACAB' | 'BCBC' | 'CBCB';

// Mapeamento de cada variante para suas 4 condições base, em ordem de bloco
export const SEQUENCE_MAP: Record<SequenceVariant, [Condition, Condition, Condition, Condition]> = {
  ABAC: ['A', 'B', 'A', 'C'],
  ACAB: ['A', 'C', 'A', 'B'],
  BCBC: ['B', 'C', 'B', 'C'],
  CBCB: ['C', 'B', 'C', 'B'],
};

// -----------------------------------------------------------------------------
// Tipo de distribuição
// -----------------------------------------------------------------------------

/**
 * Classificação da distribuição de moedas entre Distribuidor e Receptor.
 * Equal   → D = R = dotação / 2
 * Unequal → D = 3/4 da dotação, R = 1/4 da dotação
 */
export type DistributionType = 'Equal' | 'Unequal';

// -----------------------------------------------------------------------------
// Estímulo (cartão de uma tentativa)
// -----------------------------------------------------------------------------

/**
 * Representa um cartão do experimento físico.
 * Cada bloco tem 16 cartões: 8 iguais e 8 desiguais.
 *
 * `endowment`              — dotação inicial da tentativa (pode ser 4, 8, 12, 16, 20, 24, 28 ou 32)
 * `distributorDistribution`— moedas que o Distribuidor fica após a divisão
 * `receptorDistribution`   — moedas que o Receptor recebe
 * `distributorCharacter`   — nome do personagem no papel de Distribuidor
 * `receptorCharacter`      — nome do personagem no papel de Receptor
 */
export interface Stimulus {
  endowment: number;
  distributorDistribution: number;
  receptorDistribution: number;
  distributorCharacter: string;
  receptorCharacter: string;
}

// -----------------------------------------------------------------------------
// Respostas dos participantes
// -----------------------------------------------------------------------------

/**
 * Resposta de julgamento individual: a divisão foi justa ou injusta?
 * Registrada antes da decisão de punição.
 */
export type JudgmentResponse = 'Just' | 'Unjust';

/**
 * Decisão de punição individual: pune ou não pune?
 * SIM → participante perde 1 moeda independentemente do parceiro.
 */
export type PunishmentDecision = 'Punish' | 'NoPunish';

/**
 * Respostas completas dos dois participantes em uma tentativa.
 * P1 e P2 respondem de forma independente, em seus próprios dispositivos.
 */
export interface ParticipantResponses {
  p1Judgment: JudgmentResponse;
  p2Judgment: JudgmentResponse;
  p1Punishment: PunishmentDecision;
  p2Punishment: PunishmentDecision;
}

// -----------------------------------------------------------------------------
// Culturante
// -----------------------------------------------------------------------------

/**
 * Classificação do resultado da tentativa quanto ao comportamento coletivo.
 *
 * Bp  — consenso por punir distribuição igual
 * Bnp — consenso por não punir distribuição desigual
 * Cp  — consenso por punir distribuição desigual
 * Cnp — consenso por não punir distribuição igual
 * D   — desacordo na decisão de punição
 *
 * A classificação depende apenas de DistributionType + consenso da dupla.
 * A condição experimental NÃO altera o culturante — apenas a consequência cultural.
 */
export type Culturant = 'Bp' | 'Bnp' | 'Cp' | 'Cnp' | 'D';

// -----------------------------------------------------------------------------
// Resultado de uma tentativa
// -----------------------------------------------------------------------------

/**
 * Saída completa de resolveTrial().
 * Contém todos os campos necessários para atualizar o estado da sessão e gerar o CSV.
 *
 * consensus            — true se p1 e p2 tomaram a mesma decisão de punição
 * culturant            — classificação do culturante (vide tipo acima)
 *
 * p1IndividualCost     — moedas descontadas de P1 (0 ou 1); depende apenas da decisão de P1
 * p2IndividualCost     — moedas descontadas de P2 (0 ou 1); depende apenas da decisão de P2
 *
 * punishmentApplied — indica se a punição foi efetivamente aplicada nesta tentativa
 * distributorFinal  — valor potencial do saldo final do Distribuidor caso a punição seja aplicada
 * distributorLost   — quantidade potencial de moedas que o Distribuidor perde caso a punição seja aplicada
 *
 * culturalConsequence — moedas adicionadas ao cofrinho coletivo (0 ou 3)
 */
export interface TrialResult {
  // Consenso e culturante
  consensus: boolean;
  culturant: Culturant;

  // Custos individuais (independem de consenso)
  p1IndividualCost: 0 | 1;
  p2IndividualCost: 0 | 1;

  // Punição efetiva do personagem (só ocorre com consenso de punição)
  punishmentApplied: boolean;
  distributorFinal: number;
  distributorLost: number;

  // Consequência cultural (depende de culturante + condição)
  culturalConsequence: 0 | 3;
}

// -----------------------------------------------------------------------------
// Estado da sessão
// -----------------------------------------------------------------------------

/**
 * Estado acumulado da sessão ao longo das tentativas.
 * Atualizado após cada TrialResult.
 *
 * p1Coins / p2Coins    — saldo individual atual de cada participante (inicia em 80)
 * groupCoins           — cofrinho coletivo acumulado (inicia em 0)
 * disagreementCount    — total de desacordos acumulados na sessão
 */
export interface SessionState {
  p1Coins: number;
  p2Coins: number;
  groupCoins: number;
  disagreementCount: number;
}

/** Saldo inicial de moedas de cada participante ao começar a sessão */
export const INITIAL_COINS = 80;

/** Moedas adicionadas ao cofrinho quando a consequência cultural é entregue */
export const CC_REWARD = 3;

/** Custo individual de escolher punir */
export const INDIVIDUAL_PUNISHMENT_COST = 1;

// -----------------------------------------------------------------------------
// Retorno agregado de resolveTrial
// -----------------------------------------------------------------------------

/**
 * Retorno de resolveTrial(): separa explicitamente o que aconteceu na tentativa
 * do estado acumulado que deve ser persistido e propagado para a próxima.
 *
 * result    — tudo que ocorreu nesta tentativa (imutável, vai para o CSV)
 * nextState — estado da sessão após aplicar o resultado desta tentativa
 */
export interface TrialOutcome {
  result: TrialResult;
  nextState: SessionState;
}
