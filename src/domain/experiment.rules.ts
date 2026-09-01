// =============================================================================
// experiment.rules.ts
// Motor experimental do Jogo da Punição Altruísta (PGC)
// Regras de domínio — sem dependências externas
// =============================================================================

import type {
  Condition,
  Culturant,
  DistributionType,
  ParticipantResponses,
  PunishmentDecision,
  SessionState,
  Stimulus,
  TrialOutcome,
  TrialResult,
} from './experiment.types';
import { CC_REWARD, INDIVIDUAL_PUNISHMENT_COST } from './experiment.types';

// -----------------------------------------------------------------------------
// classifyDistribution
// -----------------------------------------------------------------------------

/**
 * Determina o tipo de distribuição com base nos valores de Distribuidor e Receptor.
 *
 * Parâmetros:
 *   distributorDistribution — moedas que o Distribuidor ficou após a divisão
 *   receptorDistribution    — moedas que o Receptor recebeu
 *
 * Retorno:
 *   'Equal'   → os dois valores são iguais (proporção 1/2–1/2)
 *   'Unequal' → o Distribuidor ficou com mais (proporção 3/4–1/4)
 *
 * O protocolo garante que distributorDistribution >= receptorDistribution.
 * Como os estímulos são previamente definidos e validados, basta verificar
 * se os valores são iguais para distinguir Equal de Unequal.
 */
export function classifyDistribution(
  distributorDistribution: number,
  receptorDistribution: number,
): DistributionType {
  return distributorDistribution === receptorDistribution ? 'Equal' : 'Unequal';
}

// -----------------------------------------------------------------------------
// hasConsensus
// -----------------------------------------------------------------------------

/**
 * Verifica se os dois participantes tomaram a mesma decisão de punição.
 *
 * Parâmetros:
 *   p1Punishment — decisão individual de P1 ('Punish' | 'NoPunish')
 *   p2Punishment — decisão individual de P2 ('Punish' | 'NoPunish')
 *
 * Retorno:
 *   true  → Punish+Punish ou NoPunish+NoPunish
 *   false → decisões divergentes (Desacordo — culturante D)
 *
 * Consenso não implica punição efetiva: NoPunish+NoPunish também é consenso.
 * A separação entre consensus e punishmentApplied é intencional — são eventos distintos.
 */
export function hasConsensus(
  p1Punishment: PunishmentDecision,
  p2Punishment: PunishmentDecision,
): boolean {
  return p1Punishment === p2Punishment;
}

// -----------------------------------------------------------------------------
// classifyCulturant
// -----------------------------------------------------------------------------

/**
 * Classifica o culturante da tentativa com base no tipo de distribuição e nas
 * decisões individuais dos dois participantes.
 *
 * Parâmetros:
 *   distributionType — 'Equal' ou 'Unequal', derivado do cartão da tentativa
 *   p1Punishment     — decisão individual de P1
 *   p2Punishment     — decisão individual de P2
 *
 * Retorno:
 *   'D'   → decisões divergentes (sem consenso)
 *   'Bp'  → consenso de punição em distribuição igual
 *   'Cnp' → consenso de não punição em distribuição igual
 *   'Cp'  → consenso de punição em distribuição desigual
 *   'Bnp' → consenso de não punição em distribuição desigual
 *
 * A condição experimental (A, B ou C) não participa desta função.
 * Ela determina apenas a consequência cultural — nunca o culturante.
 */
export function classifyCulturant(
  distributionType: DistributionType,
  p1Punishment: PunishmentDecision,
  p2Punishment: PunishmentDecision,
): Culturant {
  if (!hasConsensus(p1Punishment, p2Punishment)) return 'D';

  const punished = p1Punishment === 'Punish';

  if (distributionType === 'Equal') {
    return punished ? 'Bp' : 'Cnp';
  } else {
    return punished ? 'Cp' : 'Bnp';
  }
}

// -----------------------------------------------------------------------------
// calculateIndividualCost
// -----------------------------------------------------------------------------

/**
 * Calcula o custo individual de moedas de um participante para uma tentativa.
 *
 * Parâmetro:
 *   punishmentDecision — decisão individual do participante
 *
 * Retorno:
 *   1 → participante escolheu 'Punish' (perde uma moeda do próprio saldo)
 *   0 → participante escolheu 'NoPunish'
 *
 * O custo é descontado independentemente do que o parceiro decidiu.
 * Um desacordo onde P1=Punish e P2=NoPunish resulta em p1Cost=1 e p2Cost=0.
 */
export function calculateIndividualCost(
  punishmentDecision: PunishmentDecision,
): 0 | 1 {
  return punishmentDecision === 'Punish' ? INDIVIDUAL_PUNISHMENT_COST : 0;
}

// -----------------------------------------------------------------------------
// shouldPunishDistributor
// -----------------------------------------------------------------------------

/**
 * Determina se o Distribuidor é efetivamente punido na tentativa.
 *
 * Parâmetros:
 *   p1Punishment — decisão individual de P1
 *   p2Punishment — decisão individual de P2
 *
 * Retorno:
 *   true  → ambos escolheram 'Punish' (consenso de punição)
 *   false → qualquer outro caso, inclusive NoPunish+NoPunish
 *
 * Reutiliza hasConsensus() para verificar acordo, mas adiciona a condição de
 * que o consenso precisa ser especificamente de punição — consenso por não
 * punir não afeta o Distribuidor.
 */
export function shouldPunishDistributor(
  p1Punishment: PunishmentDecision,
  p2Punishment: PunishmentDecision,
): boolean {
  return hasConsensus(p1Punishment, p2Punishment) && p1Punishment === 'Punish';
}

// -----------------------------------------------------------------------------
// calculateDistributorFinal
// -----------------------------------------------------------------------------

/**
 * Calcula o saldo final potencial do Distribuidor caso a punição seja aplicada.
 *
 * Parâmetros:
 *   distributionType        — 'Equal' ou 'Unequal'
 *   distributorDistribution — moedas que o Distribuidor ficou após a divisão
 *   receptorDistribution    — moedas que o Receptor recebeu
 *
 * Retorno (valor potencial, independente de punishmentApplied):
 *   Unequal → distributorFinal = receptorDistribution
 *   Equal   → distributorFinal = distributorDistribution / 2
 *
 * O valor é sempre calculado — a camada superior decide se exibe ou aplica
 * com base em punishmentApplied. Isso mantém a função pura e sem ramificações
 * de fluxo de sessão.
 */
export function calculateDistributorFinal(
  distributionType: DistributionType,
  distributorDistribution: number,
  receptorDistribution: number,
): number {
  if (distributionType === 'Unequal') {
    return receptorDistribution;
  } else {
    return distributorDistribution / 2;
  }
}

// -----------------------------------------------------------------------------
// calculateDistributorLost
// -----------------------------------------------------------------------------

/**
 * Calcula quantas moedas o Distribuidor perderia com a punição.
 *
 * Parâmetros:
 *   distributorDistribution — moedas do Distribuidor após a divisão
 *   distributorFinal        — saldo final potencial (saída de calculateDistributorFinal)
 *
 * Retorno:
 *   distributorDistribution - distributorFinal
 *
 * Também representa um valor potencial — independe de punishmentApplied.
 * Compõe a coluna D Lost do CSV e o campo distributorLost de TrialResult.
 */
export function calculateDistributorLost(
  distributorDistribution: number,
  distributorFinal: number,
): number {
  return distributorDistribution - distributorFinal;
}

// -----------------------------------------------------------------------------
// shouldAwardCulturalConsequence
// -----------------------------------------------------------------------------

/**
 * Determina se a consequência cultural (CC) deve ser entregue na tentativa.
 *
 * Parâmetros:
 *   condition — condição experimental ativa no bloco ('A', 'B' ou 'C')
 *   culturant — culturante já classificado da tentativa
 *
 * Retorno:
 *   true  → CC de +3 moedas é entregue ao cofrinho coletivo
 *   false → nenhuma CC nesta tentativa
 *
 * Matriz validada na tese (Caldas, 2025):
 *
 *   Condição A → qualquer consenso gera CC (Bp, Bnp, Cp, Cnp)
 *   Condição B → apenas Bp e Bnp geram CC
 *   Condição C → apenas Cp e Cnp geram CC
 *   Desacordo  → nunca gera CC, em qualquer condição
 *
 * A matriz fixa usa um Set por condição para tornar a regra diretamente
 * conferível — sem derivação implícita a partir dos nomes dos culturantes.
 */

const CULTURAL_CONSEQUENCE_MATRIX: Record<
    Condition, 
    ReadonlySet<Culturant>
> = {
    A: new Set<Culturant>(['Bp', 'Bnp', 'Cp', 'Cnp']),
    B: new Set<Culturant>(['Bp', 'Bnp']),
    C: new Set<Culturant>(['Cp', 'Cnp']),
};

export function shouldAwardCulturalConsequence(
  condition: Condition,
  culturant: Culturant,
): boolean {
  return CULTURAL_CONSEQUENCE_MATRIX[condition].has(culturant);
}

// -----------------------------------------------------------------------------
// calculateGroupCoins
// -----------------------------------------------------------------------------

/**
 * Calcula as moedas de grupo entregues ao cofrinho nesta tentativa.
 *
 * Parâmetro:
 *   shouldAward — resultado de shouldAwardCulturalConsequence()
 *
 * Retorno:
 *   3 → CC entregue (usa a constante CC_REWARD)
 *   0 → nenhuma CC nesta tentativa
 *
 * Calcula somente o incremento da tentativa atual — não acumula o saldo total.
 * A atualização de groupCoins em SessionState é responsabilidade de resolveTrial().
 */
export function calculateGroupCoins(shouldAward: boolean): 0 | 3 {
  return shouldAward ? CC_REWARD : 0;
}

// -----------------------------------------------------------------------------
// resolveTrial
// -----------------------------------------------------------------------------

/**
 * Função agregadora do motor experimental. Resolve uma tentativa completa
 * compondo todas as funções puras anteriores na ordem do protocolo.
 *
 * Parâmetros:
 *   condition    — condição experimental ativa no bloco ('A', 'B' ou 'C')
 *   stimulus     — cartão da tentativa (dotação, distribuição, personagens)
 *   responses    — respostas individuais de P1 e P2 (julgamento + punição)
 *   currentState — estado acumulado da sessão antes desta tentativa
 *
 * Retorno:
 *   result    — o que aconteceu nesta tentativa (imutável, vai para o CSV)
 *   nextState — estado da sessão após aplicar os efeitos desta tentativa
 *
 * Não valida saldo, estímulo, sequência de blocos ou tentativa.
 * Não acessa banco, rede ou estado externo — função pura.
 */
export function resolveTrial(
  condition: Condition,
  stimulus: Stimulus,
  responses: ParticipantResponses,
  currentState: SessionState,
): TrialOutcome {
  // 1. Tipo de distribuição
  const distributionType = classifyDistribution(
    stimulus.distributorDistribution,
    stimulus.receptorDistribution,
  );

  // 2. Consenso
  const consensus = hasConsensus(responses.p1Punishment, responses.p2Punishment);

  // 3. Culturante
  const culturant = classifyCulturant(
    distributionType,
    responses.p1Punishment,
    responses.p2Punishment,
  );

  // 4–5. Custo individual (independe de consenso)
  const p1IndividualCost = calculateIndividualCost(responses.p1Punishment);
  const p2IndividualCost = calculateIndividualCost(responses.p2Punishment);

  // 6. Punição efetiva do personagem
  const punishmentApplied = shouldPunishDistributor(
    responses.p1Punishment,
    responses.p2Punishment,
  );

  // 7–8. Valores potenciais do distribuidor (calculados sempre, exibição condicional)
  const distributorFinal = calculateDistributorFinal(
    distributionType,
    stimulus.distributorDistribution,
    stimulus.receptorDistribution,
  );
  const distributorLost = calculateDistributorLost(
    stimulus.distributorDistribution,
    distributorFinal,
  );

  // 9–10. Consequência cultural
  const award = shouldAwardCulturalConsequence(condition, culturant);
  const culturalConsequence = calculateGroupCoins(award);

  // 11. Montar TrialResult
  const result: TrialResult = {
    consensus,
    culturant,
    p1IndividualCost,
    p2IndividualCost,
    punishmentApplied,
    distributorFinal,
    distributorLost,
    culturalConsequence,
  };

  // 12. Montar nextState
  const nextState: SessionState = {
    p1Coins: currentState.p1Coins - p1IndividualCost,
    p2Coins: currentState.p2Coins - p2IndividualCost,
    groupCoins: currentState.groupCoins + culturalConsequence,
    disagreementCount:
      currentState.disagreementCount + (culturant === 'D' ? 1 : 0),
  };

  return { result, nextState };
}
