import { describe, it, expect } from "vitest";
import { calcularFatura, faturasEmAberto } from "../src/lib/pagamentoFatura";

// T0: a tela de pagar fatura (calcularFatura) e o bloco "Ainda vai sair" (faturasEmAberto) precisam concordar.
const estado: any = {
  extrato: [], cartao: [],
  contas: [
    { id: "f1", mes: "2026-11", nome: "Streaming", valor: 40, pago: false, formaPagamento: "Nubank" },
    { id: "f2", mes: "2026-11", nome: "Academia", valor: 90, pago: true, formaPagamento: "Nubank" },
  ],
  config: {},
};

describe("conta fixa pendente no cartão", () => {
  it("não entra no total da fatura (só a cobrada)", () => {
    expect(calcularFatura(estado, "Nubank", "2026-11", 0, { somenteCobradas: true }).total).toBe(90);
  });
  it("a fatura da tela e a fatura em aberto têm o mesmo total", () => {
    const aberta = faturasEmAberto(estado, ["Nubank"], [], ["2026-11"])[0];
    expect(calcularFatura(estado, "Nubank", "2026-11", 0, { somenteCobradas: true }).total).toBe(aberta.total);
  });
});

import { mesDaFatura, mesDaFaturaDaConta } from "../src/lib/pagamentoFatura";

describe("fechamento do cartão (a partir de 2026-11)", () => {
  it("mesDaFatura: até o fechamento fica no mês; depois vai para o seguinte; dezembro vira janeiro", () => {
    expect(mesDaFatura("2026-11-25", 25)).toBe("2026-11");
    expect(mesDaFatura("2026-11-26", 25)).toBe("2026-12");
    expect(mesDaFatura("2026-12-30", 20)).toBe("2027-01");
    expect(mesDaFatura("2026-11-26", null)).toBe("2026-11");
  });
  const conta = (extra: any) => ({ id: "x", mes: "2026-11", nome: "Streaming", valor: 40, pago: true, formaPagamento: "Nubank", ...extra });
  it("conta cobrada depois do fechamento cai na fatura seguinte", () => {
    const e: any = { extrato: [], cartao: [], contas: [conta({ pago_em: "2026-11-28" })], config: {} };
    const f = { Nubank: 25 };
    expect(calcularFatura(e, "Nubank", "2026-11", 0, { fechamentos: f, somenteCobradas: true }).total).toBe(0);
    expect(calcularFatura(e, "Nubank", "2026-12", 0, { fechamentos: f, somenteCobradas: true }).total).toBe(40);
  });
  it("sem fechamento, sem data da cobrança ou antes do corte: continua na fatura do próprio mês", () => {
    const f = { Nubank: 25 };
    expect(mesDaFaturaDaConta(conta({ pago_em: "2026-11-28" }))).toBe("2026-11");
    expect(mesDaFaturaDaConta(conta({}), f)).toBe("2026-11");
    expect(mesDaFaturaDaConta(conta({ mes: "2026-10", pago_em: "2026-10-30" }), f)).toBe("2026-10");
  });
  it("a mesma conta não aparece em duas faturas", () => {
    const e: any = { extrato: [], cartao: [], contas: [conta({ pago_em: "2026-11-28" })], config: {} };
    const total = ["2026-10", "2026-11", "2026-12", "2027-01"].reduce((s, m) => s + calcularFatura(e, "Nubank", m, 0, { fechamentos: { Nubank: 25 }, somenteCobradas: true }).total, 0);
    expect(total).toBe(40);
  });
});
