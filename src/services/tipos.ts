// Tipos da lógica de punição.
//
// Estes nomes espelham os enums do schema.prisma (Decisao, TipoDistribuicao,
// Condicao) para que o Service encaixe sem conversões. Mantemos como union
// types de string aqui para que a lógica seja testável sem importar o Prisma
// Client (que exige `prisma generate` e conexão).

export type Decisao = "PUNIR" | "NAO_PUNIR";

export type TipoDistribuicao = "IGUAL" | "DESIGUAL";

export type Condicao = "A" | "B" | "C";

// Resultado da comparação das duas respostas da dupla.
export type Consenso = "CONSENSO_PUNIR" | "CONSENSO_NAO_PUNIR" | "DESACORDO";

// Os quatro culturantes possíveis. `null` quando há desacordo.
export type Culturante = "Bp" | "Bnp" | "Cp" | "Cnp" | null;

// O que o servidor libera ao final da tentativa.
export interface Consequencia {
  moedasGrupo: 0 | 3;
  mostraCartao4: boolean;
  somVencedor: boolean;
}
