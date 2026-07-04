// Testes da lógica de punição usando o runner nativo do Node (node:test).
// Rodar com: npx tsx --test src/services/punicao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apurarConsenso,
  identificarCulturante,
  avaliarConsequencia,
  resolverTentativa,
} from "./punicao";
import { Condicao } from "./tipos";

// 1. Formação de consenso
test("ambos punir => CONSENSO_PUNIR", () => {
  assert.equal(apurarConsenso("PUNIR", "PUNIR"), "CONSENSO_PUNIR");
});

test("ambos nao punir => CONSENSO_NAO_PUNIR", () => {
  assert.equal(apurarConsenso("NAO_PUNIR", "NAO_PUNIR"), "CONSENSO_NAO_PUNIR");
});

test("decisoes diferentes => DESACORDO (nas duas ordens)", () => {
  assert.equal(apurarConsenso("PUNIR", "NAO_PUNIR"), "DESACORDO");
  assert.equal(apurarConsenso("NAO_PUNIR", "PUNIR"), "DESACORDO");
});

// 2. Mapeamento dos culturantes
test("culturantes: punir+igual=Bp, naopunir+desigual=Bnp, punir+desigual=Cp, naopunir+igual=Cnp", () => {
  assert.equal(identificarCulturante("CONSENSO_PUNIR", "IGUAL"), "Bp");
  assert.equal(identificarCulturante("CONSENSO_NAO_PUNIR", "DESIGUAL"), "Bnp");
  assert.equal(identificarCulturante("CONSENSO_PUNIR", "DESIGUAL"), "Cp");
  assert.equal(identificarCulturante("CONSENSO_NAO_PUNIR", "IGUAL"), "Cnp");
});

test("desacordo nao tem culturante", () => {
  assert.equal(identificarCulturante("DESACORDO", "IGUAL"), null);
  assert.equal(identificarCulturante("DESACORDO", "DESIGUAL"), null);
});

// 3. Os 12 cenários: culturante × condição => ganha moeda?
const ESPERADO_MOEDA: Record<string, Record<Condicao, 0 | 3>> = {
  Bp: { A: 3, B: 3, C: 0 },
  Bnp: { A: 3, B: 3, C: 0 },
  Cp: { A: 3, B: 0, C: 3 },
  Cnp: { A: 3, B: 0, C: 3 },
};

for (const culturante of ["Bp", "Bnp", "Cp", "Cnp"] as const) {
  for (const condicao of ["A", "B", "C"] as const) {
    const esperado = ESPERADO_MOEDA[culturante][condicao];
    test(`moeda: ${culturante} na condicao ${condicao} => ${esperado}`, () => {
      const r = avaliarConsequencia(culturante, condicao);
      assert.equal(r.moedasGrupo, esperado);
      assert.equal(r.somVencedor, esperado > 0);
    });
  }
}

// 4. O detalhe do Cartao 4: segue a PUNICAO, nao a moeda.
test("Cartao 4 aparece em todo consenso por PUNIR (Bp, Cp), em qualquer condicao", () => {
  for (const condicao of ["A", "B", "C"] as const) {
    assert.equal(avaliarConsequencia("Bp", condicao).mostraCartao4, true);
    assert.equal(avaliarConsequencia("Cp", condicao).mostraCartao4, true);
  }
});

test("Cartao 4 NUNCA aparece em consenso por NAO punir (Bnp, Cnp)", () => {
  for (const condicao of ["A", "B", "C"] as const) {
    assert.equal(avaliarConsequencia("Bnp", condicao).mostraCartao4, false);
    assert.equal(avaliarConsequencia("Cnp", condicao).mostraCartao4, false);
  }
});

test("caso-chave: Bp na condicao C mostra Cartao 4 MAS nao ganha moeda", () => {
  const r = avaliarConsequencia("Bp", "C");
  assert.equal(r.mostraCartao4, true);
  assert.equal(r.moedasGrupo, 0);
  assert.equal(r.somVencedor, false);
});

test("caso-chave: Cp na condicao C mostra Cartao 4 E ganha moeda", () => {
  const r = avaliarConsequencia("Cp", "C");
  assert.equal(r.mostraCartao4, true);
  assert.equal(r.moedasGrupo, 3);
  assert.equal(r.somVencedor, true);
});

// 5. Desacordo: sem consequencia, sem Cartao 4, em qualquer condicao.
test("desacordo => 0 moedas, sem Cartao 4, sem som, em qualquer condicao", () => {
  for (const condicao of ["A", "B", "C"] as const) {
    const r = avaliarConsequencia(null, condicao);
    assert.deepEqual(r, { moedasGrupo: 0, mostraCartao4: false, somVencedor: false });
  }
});

// 6. Orquestrador ponta a ponta
test("resolverTentativa: ambos punem distribuicao desigual na condicao C", () => {
  const r = resolverTentativa("PUNIR", "PUNIR", "DESIGUAL", "C");
  assert.equal(r.consenso, "CONSENSO_PUNIR");
  assert.equal(r.culturante, "Cp");
  assert.deepEqual(r.consequencia, { moedasGrupo: 3, mostraCartao4: true, somVencedor: true });
});

test("resolverTentativa: desacordo em distribuicao igual na condicao A", () => {
  const r = resolverTentativa("PUNIR", "NAO_PUNIR", "IGUAL", "A");
  assert.equal(r.consenso, "DESACORDO");
  assert.equal(r.culturante, null);
  assert.deepEqual(r.consequencia, { moedasGrupo: 0, mostraCartao4: false, somVencedor: false });
});
