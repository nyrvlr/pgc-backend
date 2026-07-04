// =============================================================================
// Lógica de punição — o coração científico do experimento.
//
// Três funções PURAS (sem banco, sem rede, sem efeitos colaterais):
//   1. apurarConsenso        — as duas respostas formam consenso?
//   2. identificarCulturante — que culturante esse consenso denota?
//   3. avaliarConsequencia   — esse culturante ganha moeda na condição vigente?
//
// Pureza é proposital: permite testar todos os casos com uma tabela, dá
// reprodutibilidade científica e mantém a regra longe de detalhes de I/O.
//
// Importante: o TATO (justo/injusto) NÃO entra em nenhuma destas funções.
// Ele é registrado como dado, mas não influencia consenso nem consequência.
// =============================================================================

import {
  Decisao,
  TipoDistribuicao,
  Condicao,
  Consenso,
  Culturante,
  Consequencia,
} from "./tipos";

/**
 * Decisão 1 — Houve consenso?
 * Compara as decisões individuais dos dois participantes da dupla.
 * Só olha PUNIR/NAO_PUNIR; o tato é irrelevante aqui.
 */
export function apurarConsenso(decisaoA: Decisao, decisaoB: Decisao): Consenso {
  if (decisaoA !== decisaoB) {
    return "DESACORDO";
  }
  return decisaoA === "PUNIR" ? "CONSENSO_PUNIR" : "CONSENSO_NAO_PUNIR";
}

/**
 * Decisão 2 — Que culturante o consenso denota?
 * Combina o tipo de consenso com o tipo de distribuição exibida.
 * Retorna null em caso de desacordo (não há culturante).
 *
 *   Punir   + Igual    → Bp    (punição altruísta sobre distribuição justa)
 *   Não pun + Desigual → Bnp   (tolerar a desigualdade)
 *   Punir   + Desigual → Cp    (punir a desigualdade — equidade)
 *   Não pun + Igual    → Cnp   (tolerar a igualdade — equidade)
 */
export function identificarCulturante(
  consenso: Consenso,
  tipo: TipoDistribuicao,
): Culturante {
  if (consenso === "DESACORDO") {
    return null;
  }
  if (consenso === "CONSENSO_PUNIR") {
    return tipo === "IGUAL" ? "Bp" : "Cp";
  }
  // CONSENSO_NAO_PUNIR
  return tipo === "DESIGUAL" ? "Bnp" : "Cnp";
}

// Quais culturantes são reforçados (ganham moeda) em cada condição.
// Condição A reforça os quatro; B reforça os culturantes B; C, os culturantes C.
const CULTURANTES_REFORCADOS: Record<Condicao, ReadonlyArray<Culturante>> = {
  A: ["Bp", "Bnp", "Cp", "Cnp"],
  B: ["Bp", "Bnp"],
  C: ["Cp", "Cnp"],
};

/**
 * Decisão 3 — Esse culturante gera consequência na condição vigente?
 *
 * Retorna três coisas, todas independentes entre si:
 *   - moedasGrupo:   3 se o culturante é reforçado nesta condição, senão 0.
 *   - mostraCartao4: true sempre que houve CONSENSO POR PUNIR (Bp ou Cp),
 *                    pois o Cartão 4 anuncia a perda de moedas de D — e D só
 *                    perde se a dupla consentiu em punir. NÃO depende de ganhar
 *                    moeda. (Ex.: na Condição C, Bp mostra o Cartão 4 mas NÃO
 *                    ganha moeda.)
 *   - somVencedor:   toca sempre que moedasGrupo > 0.
 *
 * `culturante = null` (desacordo) → nenhuma consequência cultural.
 */
export function avaliarConsequencia(
  culturante: Culturante,
  condicao: Condicao,
): Consequencia {
  if (culturante === null) {
    return { moedasGrupo: 0, mostraCartao4: false, somVencedor: false };
  }

  // O Cartão 4 segue a PUNIÇÃO (Bp/Cp), não a moeda.
  const mostraCartao4 = culturante === "Bp" || culturante === "Cp";

  // A moeda segue a CONDIÇÃO vigente.
  const ganhaMoeda = CULTURANTES_REFORCADOS[condicao].includes(culturante);
  const moedasGrupo: 0 | 3 = ganhaMoeda ? 3 : 0;

  return { moedasGrupo, mostraCartao4, somVencedor: ganhaMoeda };
}

/**
 * Orquestrador de conveniência — encadeia as três funções a partir das
 * entradas brutas de uma tentativa. Continua puro (não toca banco).
 * O Service usa isto e então persiste Consensus + Consequence.
 */
export function resolverTentativa(
  decisaoA: Decisao,
  decisaoB: Decisao,
  tipo: TipoDistribuicao,
  condicao: Condicao,
): { consenso: Consenso; culturante: Culturante; consequencia: Consequencia } {
  const consenso = apurarConsenso(decisaoA, decisaoB);
  const culturante = identificarCulturante(consenso, tipo);
  const consequencia = avaliarConsequencia(culturante, condicao);
  return { consenso, culturante, consequencia };
}
