import { describe, it, expect } from "vitest";
import { calcularSaldoConta, verificarDisponibilidade, tipoDaConta } from "../src/lib/contas";
import { calcularMes } from "../src/lib/calculos";
import { calcularFatura } from "../src/lib/faturas";
import type { Estado } from "../src/lib/types";

const M = "2026-10";
const debito = { nome: "Conta Nubank", tipo_cartao: "debito", saldo_inicial: 500 };
const credito = { nome: "Nubank Crédito", tipo_cartao: "credito", eh_cartao: true, limite: 1000 };

const estado = {
  config: { salario: 0, investido: 0, reservaAtual: 0, reservaMeta: 0 },
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
