import { describe, it, expect } from "vitest";
import { faturasEmAberto } from "../src/lib/pagamentoFatura";

const estado: any = {
  extrato: [{ id: "e1", mes: "2026-11", pagamento: "Nubank", valor: 100, descricao: "Livro" }],
  cartao: [
    { id: "c1", mes: "2026-11", cartao: "Nubank", valor: 250, nome: "Ar 3/10", parcelaAtual: 3, parcelaTotal: 10 },
    { id: "c0", mes: "2026-10", cartao: "Nubank", valor: 250, nome: "Ar 2/10", parcelaAtual: 2, parcelaTotal: 10 },
  ],
  contas: [
    { id: "f1", mes: "2026-11", nome: "Streaming", valor: 40, pago: false, formaPagamento: "Nubank" },
    { id: "f2", mes: "2026-11", nome: "Academia", valor: 90, pago: true, formaPagamento: "Nubank" },
  ],
  config: {},
};
const pag = (mes: string, valor: number) => ({ id: mes + valor, cartao: "Nubank", mes, conta: "Inter", valor, data: "2026-11-10" });

describe("faturas em aberto (bloco Ainda vai sair)", () => {
  it("restante = total − pagamentos; conta fixa pendente não entra (já aparece como conta pendente)", () => {
    const l = faturasEmAberto(estado, ["Nubank"], [], ["2026-11"]);
    expect(l).toEqual([{ cartao: "Nubank", mes: "2026-11", total: 440, pago: 0, restante: 440 }]); // 250 + 100 + 90
  });
  it("fatura paga some; fatura parcial mostra só o restante", () => {
    expect(faturasEmAberto(estado, ["Nubank"], [pag("2026-10", 250)], ["2026-10"])).toEqual([]);
    expect(faturasEmAberto(estado, ["Nubank"], [pag("2026-11", 400)], ["2026-11"])).toEqual([{ cartao: "Nubank", mes: "2026-11", total: 440, pago: 400, restante: 40 }]);
  });
  it("só os meses pedidos e só os cartões de crédito informados", () => {
    expect(faturasEmAberto(estado, ["Nubank"], [], ["2026-10", "2026-11"]).map((f) => f.mes)).toEqual(["2026-10", "2026-11"]);
    expect(faturasEmAberto(estado, ["Inter"], [], ["2026-11"])).toEqual([]);
  });
});
