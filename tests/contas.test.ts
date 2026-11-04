import { describe, it, expect } from "vitest";
import { calcularSaldoConta, verificarDisponibilidade, tipoDaConta } from "../src/lib/contas";
import { calcularMes } from "../src/lib/calculos";
import { calcularFatura } from "../src/lib/pagamentoFatura";
import type { Estado } from "../src/lib/types";

const M = "2026-10";
const debito = { nome: "Conta Nubank", tipo_cartao: "debito", saldo_inicial: 500 };
const credito = { nome: "Nubank Crédito", tipo_cartao: "credito", eh_cartao: true, limite: 1000 };

const estado = {
  config: { investido: 0, reservaAtual: 0, reservaMeta: 0 },
  extrato: [
    { id: "e1", mes: M, tipo: "entrada", pagamento: "Conta Nubank", valor: 1000, owner_id: "eu" },
    { id: "e2", mes: M, pagamento: "Conta Nubank", valor: 200, owner_id: "eu" },
    { id: "e3", mes: M, pagamento: "Nubank Crédito", valor: 300, owner_id: "eu" },
    { id: "e4", mes: M, pagamento: "Conta Nubank", valor: 50, owner_id: "outro" },
  ],
  cartao: [{ id: "c1", mes: M, nome: "TV", cartao: "Nubank Crédito", parcelaAtual: 1, parcelaTotal: 3, valor: 100, owner_id: "eu" }],
  contas: [
    { id: "f1", mes: M, nome: "Luz", pago: true, valor: 80, forma_pagamento: "Conta Nubank", owner_id: "eu" },
    { id: "f2", mes: M, nome: "Água", pago: false, valor: 60, forma_pagamento: "Conta Nubank", owner_id: "eu" },
  ],
} as unknown as Estado;

describe("contas de débito e crédito", () => {
  it("tipo vem de tipo_cartao, com fallback em eh_cartao", () => {
    expect(tipoDaConta(debito)).toBe("debito");
    expect(tipoDaConta({ eh_cartao: true })).toBe("credito");
    expect(tipoDaConta({ nome: "Pix" } as any)).toBeNull();
  });

  it("saldo = inicial + entradas − saídas − fixas pagas, só do usuário", () => {
    const r = calcularSaldoConta(estado, debito, { userId: "eu", ateMes: M });
    expect(r).toMatchObject({ inicial: 500, entradas: 1000, saidas: 200, fixas: 80, saldo: 1220 });
  });

  it("conta fixa pendente não desconta do saldo", () => {
    expect(calcularSaldoConta(estado, debito, { userId: "eu" }).fixas).toBe(80);
  });

  it("compra no crédito não mexe no saldo do débito (e vice-versa)", () => {
    expect(calcularSaldoConta(estado, debito, { userId: "eu" }).saidas).toBe(200);
    expect(calcularFatura(estado, "Nubank Crédito", M, 1000).total).toBe(400);
    expect(calcularFatura(estado, "Nubank Crédito", M, 1000).disponivel).toBe(600);
  });

  it("saldo e limite não alteram entradas/saídas do mês", () => {
    const r = calcularMes(estado, { mes: M });
    expect(r.entradas).toBe(1000);
    expect(r.saidas).toBe(790);
    expect(r.saldoRestante).toBe(210);
  });

  it("débito valida pelo saldo; crédito pelo limite", () => {
    expect(verificarDisponibilidade(estado, debito, 1300, { userId: "eu", mes: M })).toMatchObject({ ok: false, faltante: 80, rotulo: "Saldo disponível" });
    expect(verificarDisponibilidade(estado, credito, 700, { userId: "eu", mes: M })).toMatchObject({ ok: false, faltante: 100, disponivel: 600, rotulo: "Limite disponível" });
    expect(verificarDisponibilidade(estado, credito, 600, { userId: "eu", mes: M }).ok).toBe(true);
  });

  it("forma sem tipo (Pix, dinheiro) não tem controle", () => {
    expect(verificarDisponibilidade(estado, { nome: "Pix" }, 99999, { userId: "eu", mes: M })).toMatchObject({ ok: true, disponivel: null });
  });
});

describe("repasses recebidos em conta de débito", () => {
  const base = { id: "r1", mes: M, pagamento: "Pix", valor: 120, owner_id: "eu", responsavel_id: "ana", repasse_pago: true, repasse_pago_em: "2026-10-15T10:00:00Z" };
  const com = (extra: any, userId = "eu") =>
    calcularSaldoConta({ ...(estado as any), extrato: [...(estado as any).extrato, { ...base, ...extra }] }, debito, { userId, ateMes: M });
  const semRepasse = calcularSaldoConta(estado, debito, { userId: "eu", ateMes: M }).saldo;

  it("soma na conta escolhida por quem recebeu", () => {
    const r = com({ repasse_conta: "Conta Nubank" });
    expect(r.repasses).toBe(120);
    expect(r.saldo).toBe(semRepasse + 120);
  });
  it("não soma em outra conta, se não confirmado ou se não for o autor", () => {
    expect(com({ repasse_conta: "Outra" }).repasses).toBe(0);
    expect(com({ repasse_conta: "Conta Nubank", repasse_pago: false }).repasses).toBe(0);
    expect(com({ repasse_conta: "Conta Nubank" }, "ana").repasses).toBe(0);
  });
  it("só conta a partir do mês em que foi confirmado", () => {
    expect(com({ repasse_conta: "Conta Nubank", repasse_pago_em: "2026-12-01T00:00:00Z" }).repasses).toBe(0);
  });
});

describe("repasses pagos saindo de uma conta de débito", () => {
  const item = { id: "r2", mes: M, pagamento: "Cartão do autor", valor: 100, owner_id: "autor", responsavel_id: "eu", repasse_pago: true, repasse_pago_em: "2026-10-20T10:00:00Z", repasse_conta_origem: "Conta Nubank" };
  const com = (extra: any, userId = "eu") => calcularSaldoConta({ ...(estado as any), extrato: [...(estado as any).extrato, { ...item, ...extra }] }, debito, { userId, ateMes: M });
  const base = calcularSaldoConta(estado, debito, { userId: "eu", ateMes: M }).saldo;

  it("desconta da conta de origem do responsável quando o autor confirma", () => {
    expect(com({}).saldo).toBe(base - 100);
    expect(com({}).repassesPagos).toBe(100);
  });
  it("não desconta se ainda não confirmado, se outra conta ou se não for o responsável", () => {
    expect(com({ repasse_pago: false }).repassesPagos).toBe(0);
    expect(com({ repasse_conta_origem: "Outra" }).repassesPagos).toBe(0);
    expect(com({}, "autor").repassesPagos).toBe(0);
  });
});

describe("caixinhas usando o saldo de uma conta de débito", () => {
  const movs = [
    { tipo: "aporte", valor: 300, conta: "Conta Nubank", data: "2026-10-05" },
    { tipo: "resgate", valor: 100, conta: "Conta Nubank", data: "2026-10-20" },
    { tipo: "rendimento", valor: 9, conta: "Conta Nubank", data: "2026-10-21" },
    { tipo: "aporte", valor: 999, conta: "Outra", data: "2026-10-05" },
    { tipo: "aporte", valor: 50, conta: "Conta Nubank", data: "2026-11-01" },
  ];
  const base = calcularSaldoConta(estado, debito, { userId: "eu", ateMes: M }).saldo;

  it("o aporte sai do saldo e o resgate volta; rendimento, outra conta e meses futuros não contam", () => {
    const r = calcularSaldoConta(estado, debito, { userId: "eu", ateMes: M, caixinhaMovs: movs });
    expect(r.aportesCaixinha).toBe(300);
    expect(r.resgatesCaixinha).toBe(100);
    expect(r.saldo).toBe(base - 300 + 100);
  });
  it("a verificação de saldo ao lançar considera os aportes", () => {
    const sem = verificarDisponibilidade(estado, debito, 100, { userId: "eu", mes: M });
    const com = verificarDisponibilidade(estado, debito, 100, { userId: "eu", mes: M, caixinhaMovs: [{ tipo: "aporte", valor: 1000, conta: "Conta Nubank", data: "2026-10-01" }] });
    expect(sem.ok).toBe(true);
    expect(com.ok).toBe(false);
  });
});
