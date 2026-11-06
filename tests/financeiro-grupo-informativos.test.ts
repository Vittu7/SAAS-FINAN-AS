import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { financeiroDoGrupo, informativosDoGrupo } from "../src/lib/financeiroGrupo";
import { MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";

type Item = Record<string, unknown>;
const base = { owner_id: "eu", responsavel_id: "eu", responsavel: "Eu" };
const fixa = (id: string, extra: Item) => ({ id, mes: "2026-11", nome: id, valor: 100, pago: false, ...base, ...extra });

const salario = { id: "sal", mes: "2026-11", tipo: "entrada", categoria: "Salário", valor: 3000, ...base };
const compraCredito = { id: "cc", mes: "2026-11", nome: "TV", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 500, ...base };
const opts = { cartoesCredito: ["Nubank"] };

describe("informativos do Financeiro do grupo", () => {
  it("conta pendente e fatura aberta aparecem, mas não mudam o disponível do grupo", () => {
    const sem = { extrato: [salario], cartao: [], contas: [] as Item[] };
    const com = { extrato: [salario], cartao: [compraCredito], contas: [fixa("luz", { forma_pagamento: "Inter" })] };
    const run = (d: any) => {
      const painel = calcularPainel(d, { mes: "2026-11", meuId: "eu", escopo: new Set(["eu"]), cartoesCredito: ["Nubank"], mesCorteCaixa: MES_CORTE_CAIXA });
      return { painel, g: financeiroDoGrupo(painel, d, "eu", opts) };
    };
    const a = run(com);
    expect(a.g.contasPendentes).toBe(100);
    expect(a.g.faturasEmAberto).toBe(500);
    // Regra de caixa: o que o Meu financeiro separou (conta pendente 100 + compra no crédito 500) volta ao disponível do grupo
    expect(a.painel.totalDisponivel).toBe(2400); // 3000 − 500 (compra) − 100 (pendente), como sempre no Meu financeiro
    expect(a.g.meuDisponivel).toBe(2400);
    expect(a.g.naoDescontado).toBe(600);
    expect(a.g.disponivelGrupo).toBe(3000);
    // e é o mesmo disponível de quem não tem conta pendente nem fatura aberta
    const semItens = financeiroDoGrupo(calcularPainel(sem as any, { mes: "2026-11", meuId: "eu", escopo: new Set(["eu"]), cartoesCredito: ["Nubank"], mesCorteCaixa: MES_CORTE_CAIXA }), sem as any, "eu", opts);
    expect(semItens.disponivelGrupo).toBe(a.g.disponivelGrupo);
  });

  it("conta fixa no crédito: cobrada entra na fatura e só vira 'pago' quando a fatura é paga (uma vez)", () => {
    const d: any = { extrato: [], cartao: [], contas: [fixa("stream", { forma_pagamento: "Nubank", pago: true, pago_em: "2026-11-10", valor: 40 })] };
    const aberto = informativosDoGrupo(d, "eu", "2026-11", opts);
    expect(aberto).toMatchObject({ contasPendentes: 0, faturasEmAberto: 40, totalPagoNoMes: 0 });
    const pagamento = { id: "p", cartao: "Nubank", mes: "2026-11", conta: "Inter", valor: 40, data: "2026-11-20" };
    const pago = informativosDoGrupo(d, "eu", "2026-11", { ...opts, pagamentosFatura: [pagamento] });
    expect(pago).toMatchObject({ faturasEmAberto: 0, totalPagoNoMes: 40 }); // 40 uma vez, nunca 80
  });

  it("conta no débito paga entra em 'efetivamente pago' no mês de pago_em; pendente não", () => {
    const d: any = { extrato: [], cartao: [], contas: [
      fixa("agua", { forma_pagamento: "Inter", pago: true, pago_em: "2026-11-05", valor: 70 }),
      fixa("gas", { forma_pagamento: "Inter", pago: false, valor: 30 }),
      fixa("outubro", { mes: "2026-10", forma_pagamento: "Inter", pago: true, pago_em: "2026-11-02", valor: 20 }),
    ] };
    const r = informativosDoGrupo(d, "eu", "2026-11", opts);
    expect(r.totalPagoNoMes).toBe(90); // 70 + 20 (outubro paga em novembro)
    expect(r.contasPendentes).toBe(30);
  });

  it("fechamento: cobrança após o dia de fechamento fica na fatura do mês seguinte", () => {
    const d: any = { extrato: [], cartao: [], contas: [fixa("net", { forma_pagamento: "Nubank", pago: true, pago_em: "2026-11-28", valor: 60 })] };
    const l = informativosDoGrupo(d, "eu", "2026-11", { ...opts, fechamentos: { Nubank: 25 } });
    expect(l.faturasEmAberto).toBe(0); // ainda é da fatura de dezembro
    const dez = informativosDoGrupo(d, "eu", "2026-12", { ...opts, fechamentos: { Nubank: 25 } });
    expect(dez.faturasEmAberto).toBe(60);
  });

  it("só considera o que eu criei: conta de outro dono não entra", () => {
    const d: any = { extrato: [], cartao: [], contas: [fixa("alheia", { owner_id: "outro", responsavel_id: "outro", forma_pagamento: "Inter", valor: 999 })] };
    expect(informativosDoGrupo(d, "eu", "2026-11", opts).contasPendentes).toBe(0);
  });
});
