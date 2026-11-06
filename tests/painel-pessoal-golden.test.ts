import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";

// GOLDEN do Meu financeiro: a saída do painel pessoal para estes dados NÃO pode mudar com a feature de contas fixas
// (novos campos pago_em/valor_variavel/encerrada_em e fechamento do cartão não são lidos pelo painel pessoal).
const eu = "vitu";
const dados = (extra: any = {}) => ({
  extrato: [
    { id: "s", mes: "2026-10", tipo: "entrada", categoria: "Salário", valor: 2159, owner_id: eu, responsavel_id: eu },
    { id: "s2", mes: "2026-11", tipo: "entrada", categoria: "Salário", valor: 2000, owner_id: eu, responsavel_id: eu },
    { id: "a", mes: "2026-11", pagamento: "Nubank", valor: 80, descricao: "Mercado", categoria: "Mercado", owner_id: eu, responsavel_id: eu },
  ],
  cartao: [{ id: "c", mes: "2026-10", nome: "TV", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 3, valor: 300, owner_id: eu, responsavel_id: eu }],
  contas: [
    { id: "f1", mes: "2026-10", nome: "Internet", valor: 100, pago: true, forma_pagamento: "Inter", owner_id: eu, responsavel_id: eu },
    { id: "f2", mes: "2026-11", nome: "Streaming", valor: 40, pago: true, forma_pagamento: "Nubank", owner_id: eu, responsavel_id: eu, ...extra },
    { id: "f3", mes: "2026-11", nome: "Energia", valor: 150, pago: false, forma_pagamento: "Inter", owner_id: eu, responsavel_id: eu },
  ],
});
const opts = (mes: string) => ({ mes, meuId: eu, escopo: new Set([eu]), cartoesCredito: ["Nubank"], mesCorteCaixa: MES_CORTE_CAIXA, pagamentosFatura: [{ id: "p", cartao: "Nubank", mes: "2026-10", conta: "Inter", valor: 300, data: "2026-11-05" }] });

describe("Meu financeiro (golden)", () => {
  for (const mes of ["2026-10", "2026-11"]) {
    it(`painel de ${mes}`, () => {
      expect(calcularPainel(dados() as any, opts(mes))).toMatchSnapshot();
    });
  }
  it("campos novos da conta fixa (pago_em, valor_variavel, encerrada_em, valor_confirmado) não mudam o painel pessoal", () => {
    const novos = { pago_em: "2026-12-03", valor_variavel: true, valor_confirmado: false, encerrada_em: "2027-01" };
    for (const mes of ["2026-10", "2026-11"]) {
      expect(calcularPainel(dados(novos) as any, opts(mes))).toEqual(calcularPainel(dados() as any, opts(mes)));
    }
  });
});
