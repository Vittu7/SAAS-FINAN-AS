import { describe, it, expect } from "vitest";
import { gerarRelatorio, mesesDoPeriodo, relatorioParaCSV, relatorioParaHTML } from "../src/lib/relatorio";
import { calcularMes } from "../src/lib/calculos";

const e: any = {
  config: { salario: 0 },
  extrato: [
    { id: "1", mes: "2026-09", tipo: "entrada", categoria: "Salário", valor: 4000, descricao: "Salário", responsavel: "Vitu" },
    { id: "2", mes: "2026-10", tipo: "entrada", categoria: "Salário", valor: 5000, descricao: "Salário", responsavel: "Vitu" },
    { id: "3", mes: "2026-10", pagamento: "Pix", categoria: "Mercado", valor: 300, descricao: "=SOMA(1;1)", responsavel: "Vitu" },
    { id: "4", mes: "2026-09", pagamento: "Pix", categoria: "Lazer", valor: 100, descricao: "Cinema", responsavel: "Gi" },
  ],
  cartao: [{ id: "5", mes: "2026-10", cartao: "Nubank", categoria: "Casa", valor: 200, descricao: "TV", parcelaAtual: 1, parcelaTotal: 3, responsavel: "Vitu" }],
  contas: [{ id: "6", mes: "2026-10", nome: "Luz", categoria: "Casa", valor: 80, pago: false, forma_pagamento: "Pix", responsavel: "Vitu" }],
};

describe("relatório", () => {
  const r = gerarRelatorio(e, { de: "2026-09", ate: "2026-10" });
  it("lista os meses do período, mesmo invertidos", () => {
    expect(mesesDoPeriodo("2026-10", "2026-09")).toEqual(["2026-09", "2026-10"]);
  });
  it("totais batem com a lógica única de cálculo", () => {
    const soma = ["2026-09", "2026-10"].map((mes) => calcularMes(e, { mes }));
    expect(r.totais.entradas).toBe(soma.reduce((t, x) => t + x.entradas, 0));
    expect(r.totais.saidas).toBe(soma.reduce((t, x) => t + x.saidas, 0));
    expect(r.totais.saldo).toBe(9000 - 680);
  });
  it("agrupamentos somam o total de saídas", () => {
    for (const g of [r.porCategoria, r.porResponsavel, r.porForma, r.porOrigem])
      expect(g.reduce((t, x) => t + x.valor, 0)).toBe(r.totais.saidas);
  });
  it("filtra por responsável e por categoria", () => {
    expect(gerarRelatorio(e, { de: "2026-09", ate: "2026-10", responsavel: "Gi" }).totais.saidas).toBe(100);
    expect(gerarRelatorio(e, { de: "2026-09", ate: "2026-10", categoria: "Casa" }).totais.saidas).toBe(280);
  });
  it("falta pagar considera só contas não pagas", () => expect(r.totais.faltaPagar).toBe(80));
  it("CSV protege contra fórmulas e usa ; e vírgula decimal", () => {
    const csv = relatorioParaCSV(r);
    expect(csv).toContain("'=SOMA(1;1)".includes(";") ? "\"'=SOMA(1;1)\"" : "'=SOMA");
    expect(csv).toContain("Saídas;9000".length ? "Saídas;680,00" : "");
  });
  it("HTML escapa texto do usuário", () => {
    const x = { ...e, extrato: [...e.extrato, { id: "9", mes: "2026-10", pagamento: "Pix", categoria: "X", valor: 1, descricao: "<script>alert(1)</script>", responsavel: "Vitu" }] };
    expect(relatorioParaHTML(gerarRelatorio(x, { de: "2026-10", ate: "2026-10" }))).not.toContain("<script>alert");
  });
});
