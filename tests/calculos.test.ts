import { sobraDosMesesAnteriores } from "../src/lib/calculos";
import { describe, it, expect } from "vitest";
import { calcularMes, semDuplicados } from "../src/lib/calculos";
import { resumoDoMes } from "../src/lib/finance";
import { montarLinhas, totalGastos, totalPendentes, agruparPorOrigem } from "../src/lib/extrato";
import type { Estado } from "../src/lib/types";

const M = "2026-10";
const estado = {
  config: { investido: 0, reservaAtual: 0, reservaMeta: 0 },
  extrato: [
    { id: "e1", mes: M, tipo: "entrada", categoria: "Salário", valor: 5000, descricao: "Salário", responsavel: "EU" },
    { id: "e2", mes: M, pagamento: "Pix", categoria: "Mercado", valor: 300, descricao: "Mercado", responsavel: "EU" },
  ],
  cartao: [
    { id: "c1", mes: M, nome: "TV", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 3, valor: 200, responsavel: "EU" },
    { id: "c2", mes: "2026-11", nome: "TV", cartao: "Nubank", parcelaAtual: 2, parcelaTotal: 3, valor: 200, responsavel: "EU" },
  ],
  contas: [
    { id: "f1", mes: M, nome: "Luz", pago: true, valor: 100, responsavel: "EU" },
    { id: "f2", mes: M, nome: "Internet", pago: false, valor: 80, responsavel: "EU" },
  ],
} as unknown as Estado;

describe("calcularMes", () => {
  const r = calcularMes(estado, { mes: M });
  it("entradas vêm dos lançamentos de entrada", () => expect(r.entradas).toBe(5000));
  it("saídas = à vista + parcelas do mês + contas fixas do mês (regra original)", () => {
    expect(r.porOrigem).toEqual({ extrato: 300, cartao: 200, contas: 180 });
    expect(r.saidas).toBe(680);
  });
  it("entrada não conta como saída", () => expect(r.porOrigem.extrato).toBe(300));
  it("saldo restante = entradas − saídas", () => expect(r.saldoRestante).toBe(4320));
  it("falta pagar é só informativo", () => expect(r.faltaPagar).toBe(80));
  it("sem entradas lançadas não considera salário automaticamente", () => {
    const x = calcularMes({ ...estado, extrato: [] } as any, { mes: M });
    expect(x.entradas).toBe(0);
    expect(x.saldoRestante).toBe(-380);
  });
  it("não duplica a mesma parcela", () => {
    const dup = [...estado.cartao, { ...estado.cartao[0], id: "outro" }];
    expect(semDuplicados(dup as any[], "cartao")).toHaveLength(2);
  });
});

describe("resumo e extrato usam a mesma regra", () => {
  it("resumoDoMes", () => {
    const r = resumoDoMes(estado, M);
    expect(r.totalGasto).toBe(680);
    expect(r.sobra).toBe(4320);
  });
  it("extrato: entrada não entra no total de gastos; conta pendente fica à parte", () => {
    const linhas = montarLinhas(estado.extrato, estado.cartao, estado.contas, M);
    expect(linhas.filter((l) => l.entrada)).toHaveLength(1);
    // Gastos realizados: Internet (80, pendente) fica de fora
    expect(totalGastos(linhas)).toBe(600);
    expect(totalPendentes(linhas)).toBe(80);
    const grupos = agruparPorOrigem(linhas.filter((l) => !l.entrada));
    expect(grupos.reduce((t, g) => t + g.total, 0)).toBe(600);
    expect(grupos.reduce((t, g) => t + g.pendente, 0)).toBe(80);
  });
  it("realizados + a pagar do extrato = saídas do resumo (cards e saldo disponível não mudam)", () => {
    const linhas = montarLinhas(estado.extrato, estado.cartao, estado.contas, M);
    const r = calcularMes(estado, { mes: M });
    expect(totalGastos(linhas) + totalPendentes(linhas)).toBe(r.saidas);
    expect(totalPendentes(linhas)).toBe(r.faltaPagar);
  });
});

describe("sobra dos meses anteriores", () => {
  const e: any = {
    extrato: [
      { id: "1", mes: "2026-08", tipo: "entrada", valor: 3000 },
      { id: "2", mes: "2026-08", valor: 1000 },
      { id: "3", mes: "2026-09", tipo: "entrada", valor: 3000 },
      { id: "4", mes: "2026-09", valor: 3500 },
    ],
    cartao: [],
    contas: [],
  };
  it("passa a sobra de um mês para o seguinte, acumulando", () => {
    expect(sobraDosMesesAnteriores(e, "2026-08")).toBe(0);
    expect(sobraDosMesesAnteriores(e, "2026-09")).toBe(2000);
    // set: 2000 + 3000 - 3500 = 1500
    expect(sobraDosMesesAnteriores(e, "2026-10")).toBe(1500);
  });
  it("mês no vermelho não vira dívida para o seguinte", () => {
    const f: any = { extrato: [{ id: "1", mes: "2026-08", tipo: "entrada", valor: 100 }, { id: "2", mes: "2026-08", valor: 500 }], cartao: [], contas: [] };
    expect(sobraDosMesesAnteriores(f, "2026-09")).toBe(0);
  });
  it("considera somente lançamentos efetivos e ignora o que é fora do saldo", () => {
    const g: any = { extrato: [{ id: "1", mes: "2026-08", valor: 400 }, { id: "2", mes: "2026-08", valor: 999, foraDoMeuSaldo: true }], cartao: [], contas: [] };
    expect(sobraDosMesesAnteriores(g, "2026-09")).toBe(0);
  });
  it("sem lançamentos antes do mês, não há sobra", () => {
    expect(sobraDosMesesAnteriores({ extrato: [], cartao: [], contas: [] }, "2026-10")).toBe(0);
  });
});
