import { describe, it, expect } from "vitest";
import { calcularPainel, serieEntradasSaidas } from "../src/lib/painel";

/*
 * Indicadores do novo Resumo, derivados do painel existente (nenhuma regra de saldo muda):
 * - Entrou = renda lançada no mês (sem repasses, sem saldo anterior).
 * - Saiu = despesas realizadas (sem contas fixas pendentes).
 * - Resultado = Entrou − Saiu.
 * - Disponível agora = totalDisponivel (regra atual, intocada).
 * - Sobra prevista = o que sobra quando contas, faturas e repasses deste mês forem acertados
 *   = saldo inicial + Σ (entradas − todas as despesas do período) − aportes + resgates.
 *   Identidade: sobra = disponível + a receber − a repassar + ajuste de faturas de compras para outros.
 */

const salario = { id: "s", mes: "2026-10", tipo: "entrada", categoria: "Salário", valor: 1000, owner_id: "vitu", responsavel_id: "vitu" };
const pixGisa = (extra: any = {}) => ({ id: "p", mes: "2026-10", descricao: "Farmácia", pagamento: "Pix", valor: 100, owner_id: "vitu", responsavel_id: "gisa", ...extra });
const creditoGisa = (extra: any = {}) => ({ id: "c", mes: "2026-10", nome: "Ar", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 100, owner_id: "vitu", responsavel_id: "gisa", ...extra });
const pago = { repasse_pago: true, repasse_pago_em: "2026-10-20T10:00:00Z" };
const eu = new Set(["vitu"]);
const identidade = (p: ReturnType<typeof calcularPainel>) =>
  Math.round((p.totalDisponivel + p.previsao.receber - p.previsao.repassar + p.previsao.faturasOutros) * 100) / 100;

describe("Entrou, Saiu e Resultado do mês", () => {
  const e = {
    extrato: [salario, { id: "r", mes: "2026-10", descricao: "Mercado", pagamento: "Pix", valor: 300 }],
    cartao: [{ id: "k", mes: "2026-10", nome: "TV", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 3, valor: 200 }],
    contas: [
      { id: "f1", mes: "2026-10", nome: "Luz", valor: 150, pago: true },
      { id: "f2", mes: "2026-10", nome: "Internet", valor: 120, pago: false },
    ],
  };
  it("saídas realizadas não incluem conta pendente; a pendente fica separada", () => {
    const p = calcularPainel(e, { mes: "2026-10" });
    expect(p.entradasRenda).toBe(1000);
    expect(p.saidasRealizadas).toBe(650); // 300 + 200 + 150
    expect(p.contasPendentes).toBe(120);
    expect(p.resultadoRealizado).toBe(350);
    // realizadas + pendentes = saídas do mês da regra antiga (nada some, nada duplica)
    expect(p.saidasRealizadas + p.contasPendentes).toBe(p.saidas);
  });
  it("lançamento repetido (mesmo id) conta uma vez em entradas e saídas", () => {
    const dup = { ...e, extrato: [...e.extrato, salario, e.extrato[1]] };
    const p = calcularPainel(dup, { mes: "2026-10" });
    expect(p.entradasRenda).toBe(1000);
    expect(p.saidasRealizadas).toBe(650);
  });
  it("repasse recebido não entra em Entrou nem no Resultado do mês", () => {
    const dados = { extrato: [salario, { ...pixGisa(pago), foraDoMeuSaldo: true }], cartao: [], contas: [] };
    const p = calcularPainel(dados, { mes: "2026-10", escopo: eu });
    expect(p.repassesRecebidos).toBe(100);
    expect(p.entradasRenda).toBe(1000);
    expect(p.saidasRealizadas).toBe(0);
    expect(p.resultadoRealizado).toBe(1000);
  });
});

describe("Sobra prevista sem contar nada duas vezes", () => {
  it("conta pendente já está no disponível: a sobra não a desconta de novo", () => {
    const e = { extrato: [salario], cartao: [], contas: [{ id: "f", mes: "2026-10", nome: "Internet", valor: 120, pago: false }] };
    const p = calcularPainel(e, { mes: "2026-10" });
    expect(p.totalDisponivel).toBe(880);
    expect(p.sobraPrevista).toBe(880);
    expect(p.previsao).toEqual({ receber: 0, repassar: 0, faturasOutros: 0 });
  });

  it("Somente eu, paguei com Pix por Gisa: o disponível já caiu; a sobra conta a volta", () => {
    const e = { extrato: [salario, { ...pixGisa(), foraDoMeuSaldo: true }], cartao: [], contas: [] };
    const p = calcularPainel(e, { mes: "2026-10", escopo: eu });
    expect(p.totalDisponivel).toBe(900);
    expect(p.previsao.receber).toBe(100);
    expect(p.sobraPrevista).toBe(1000);
    expect(identidade(p)).toBe(p.sobraPrevista);
  });

  it("Somente eu, comprei no crédito para Gisa e a fatura não foi paga: recebo 100 e ainda pago 100 de fatura", () => {
    const e = { extrato: [salario], cartao: [{ ...creditoGisa(), foraDoMeuSaldo: true }], contas: [] };
    const p = calcularPainel(e, { mes: "2026-10", escopo: eu, meuId: "vitu", cartoesCredito: ["Nubank"] });
    expect(p.totalDisponivel).toBe(1000); // o dinheiro ainda não saiu
    expect(p.previsao.receber).toBe(100);
    expect(p.previsao.faturasOutros).toBe(-100);
    expect(p.sobraPrevista).toBe(1000);
    expect(identidade(p)).toBe(p.sobraPrevista);
  });

  it("visão de quem deve: o repasse ainda vai sair", () => {
    const escopo = new Set(["gisa"]);
    const e = { extrato: [], cartao: [creditoGisa()], contas: [] };
    const p = calcularPainel(e, { mes: "2026-10", escopo });
    expect(p.totalDisponivel).toBe(0);
    expect(p.previsao.repassar).toBe(100);
    expect(p.sobraPrevista).toBe(-100);
    expect(identidade(p)).toBe(p.sobraPrevista);
  });

  it("repasse concluído: nada a receber e a sobra igual ao disponível", () => {
    const e = { extrato: [salario, { ...pixGisa(pago), foraDoMeuSaldo: true }], cartao: [], contas: [] };
    const p = calcularPainel(e, { mes: "2026-10", escopo: eu });
    expect(p.totalDisponivel).toBe(1000);
    expect(p.previsao.receber).toBe(0);
    expect(p.sobraPrevista).toBe(1000);
  });

  it("Todos: repasse é interno e a sobra não muda com ele", () => {
    const e = { extrato: [salario, pixGisa()], cartao: [], contas: [] };
    for (const c of [pixGisa(), pixGisa(pago)]) {
      const p = calcularPainel({ ...e, extrato: [salario, c] }, { mes: "2026-10" });
      expect(p.sobraPrevista).toBe(900);
      expect(p.previsao.receber).toBe(0);
      expect(p.previsao.repassar).toBe(0);
    }
  });

  it("Somente eu + só Gisa = Todos também na sobra prevista", () => {
    for (const c of [pixGisa(), pixGisa(pago)]) {
      const pe = calcularPainel({ extrato: [salario, { ...c, foraDoMeuSaldo: true }], cartao: [], contas: [] }, { mes: "2026-10", escopo: eu }).sobraPrevista;
      const pg = calcularPainel({ extrato: [c], cartao: [], contas: [] }, { mes: "2026-10", escopo: new Set(["gisa"]) }).sobraPrevista;
      const pt = calcularPainel({ extrato: [salario, c], cartao: [], contas: [] }, { mes: "2026-10" }).sobraPrevista;
      expect(Math.round((pe + pg) * 100) / 100).toBe(pt);
    }
  });

  it("aporte reduz disponível e sobra igualmente; meses anteriores acumulam", () => {
    const movs = [{ tipo: "aporte", valor: 300, conta: "Nubank", data: "2026-10-15" }];
    const p = calcularPainel({ extrato: [salario], cartao: [], contas: [] }, { mes: "2026-11", caixinhaMovs: movs, saldoInicial: 50 });
    expect(p.totalDisponivel).toBe(750);
    expect(p.sobraPrevista).toBe(750);
  });
});

describe("série de entradas e saídas para o gráfico", () => {
  it("6 meses até o selecionado, com saídas realizadas e sem repasses", () => {
    const e = {
      extrato: [salario, { id: "m", mes: "2026-10", descricao: "Mercado", pagamento: "Pix", valor: 300 }, { id: "n", mes: "2026-09", tipo: "entrada", valor: 800 }],
      cartao: [], contas: [{ id: "f", mes: "2026-10", nome: "Internet", valor: 120, pago: false }],
    };
    const s = serieEntradasSaidas(e, "2026-10");
    expect(s.map((x) => x.mes)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(s[5]).toEqual({ mes: "2026-10", entrou: 1000, saiu: 300 });
    expect(s[4]).toEqual({ mes: "2026-09", entrou: 800, saiu: 0 });
  });
});

describe("composição do disponível", () => {
  const cenarios: [string, any, any][] = [
    ["simples com conta pendente", { extrato: [salario], cartao: [], contas: [{ id: "f", mes: "2026-10", nome: "Internet", valor: 120, pago: false }] }, { mes: "2026-10", saldoInicial: 300 }],
    ["Somente eu com repasse recebido", { extrato: [salario, { ...pixGisa(pago), foraDoMeuSaldo: true }], cartao: [], contas: [] }, { mes: "2026-10", escopo: eu }],
    ["Somente eu com crédito para outra pessoa", { extrato: [salario], cartao: [{ ...creditoGisa(), foraDoMeuSaldo: true }], contas: [] }, { mes: "2026-10", escopo: eu, meuId: "vitu", cartoesCredito: ["Nubank"] }],
    ["quem deve", { extrato: [], cartao: [creditoGisa()], contas: [] }, { mes: "2026-10", escopo: new Set(["gisa"]) }],
    ["aporte e resgate", { extrato: [salario], cartao: [], contas: [] }, { mes: "2026-10", caixinhaMovs: [{ tipo: "aporte", valor: 300, conta: "Inter", data: "2026-10-03" }, { tipo: "resgate", valor: 50, conta: "Inter", data: "2026-10-20" }] }],
  ];
  for (const [nome, dados, opts] of cenarios) {
    it(`as linhas somam exatamente o disponível: ${nome}`, async () => {
      const { composicaoDoDisponivel } = await import("../src/lib/painel");
      const p = calcularPainel(dados, opts);
      const soma = composicaoDoDisponivel(p, "setembro").reduce((t, l) => t + l.valor, 0);
      expect(Math.round(soma * 100) / 100).toBe(p.totalDisponivel);
    });
  }
  it("saídas por tipo somam as saídas realizadas", () => {
    const e = { extrato: [salario, { id: "r", mes: "2026-10", descricao: "Mercado", pagamento: "Pix", valor: 300 }], cartao: [{ id: "k", mes: "2026-10", nome: "TV", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 3, valor: 200 }], contas: [{ id: "f1", mes: "2026-10", nome: "Luz", valor: 150, pago: true }, { id: "f2", mes: "2026-10", nome: "Internet", valor: 120, pago: false }] };
    const p = calcularPainel(e, { mes: "2026-10" });
    expect(p.saidasPorOrigem).toEqual({ avista: 300, parcelas: 200, contasPagas: 150 });
    expect(p.rendaPorOrigem).toEqual([{ rotulo: "Salário", valor: 1000 }]);
  });
});
