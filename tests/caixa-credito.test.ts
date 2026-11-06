import { describe, it, expect } from "vitest";
import { calcularPainel, composicaoDoDisponivel } from "../src/lib/painel";
import { mesEmBrasilia } from "../src/lib/calculos";
import { entradasDeRepasse, marcarForaDaVisao } from "../src/lib/grupo";
import { ajusteDeFaturas, MES_CORTE_CAIXA, type PagamentoFatura } from "../src/lib/pagamentoFatura";

/**
 * REGRA DE COMPETÊNCIA DO CRÉDITO (a partir do mês de corte): a compra no cartão é despesa na compra e já reduz o
 * Total disponível; pagar a fatura apenas liquida a obrigação e NUNCA desconta de novo. Repasse e adiantado para
 * outro integrante são acertos: não mexem no meu disponível (aparecem no Financeiro do grupo).
 */
const OUT = "2026-10";
const NOV = "2026-11";
const DEZ = "2026-12";
const credito = ["Nubank"];
const pag = (valor: number, data: string, extra: Partial<PagamentoFatura> = {}): PagamentoFatura => ({ id: `p${valor}${data}`, cartao: "Nubank", mes: OUT, conta: "Itaú Débito", valor, data, ...extra });
const confirmado = (quando: string) => ({ repasse_pago: true, repasse_pago_em: `${quando}T10:00:00Z` });

const entrada = { id: "e", mes: OUT, tipo: "entrada", categoria: "Extra", valor: 1000, owner_id: "eu", responsavel_id: "eu", responsavel: "Eu" };
const propria = { id: "c1", mes: OUT, nome: "Geladeira", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 200, owner_id: "eu", responsavel_id: "eu", responsavel: "Eu" };
const deX = (extra: any = {}) => ({ id: "c2", mes: OUT, nome: "Maquiagem", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 100, owner_id: "eu", responsavel_id: "x", responsavel: "X", autorNome: "Eu", ...extra });

type Opcoes = { escopo?: string[] | null; pagamentos?: PagamentoFatura[]; corte?: string | null; extrato?: any[]; cartao?: any[]; contas?: any[] };
function painel(mes: string, o: Opcoes = {}) {
  const escopo = o.escopo === undefined ? ["eu"] : o.escopo;
  const set = escopo ? new Set(escopo) : null;
  const todos = { extrato: o.extrato ?? [entrada], cartao: o.cartao ?? [propria, deX()], contas: o.contas ?? [] };
  const visao = (l: any[]) => l.filter((i) => !set || set.has(i.responsavel_id) || set.has(i.owner_id)).map((i) => marcarForaDaVisao(i, set));
  const filtrado = { extrato: visao(todos.extrato), cartao: visao(todos.cartao), contas: visao(todos.contas) };
  const comRepasse = { ...filtrado, extrato: [...filtrado.extrato, ...entradasDeRepasse(filtrado)] };
  return calcularPainel(comRepasse, {
    mes, meuId: "eu", dadosRepasses: todos, escopo: set, cartoesCredito: credito, pagamentosFatura: o.pagamentos ?? [],
    mesCorteCaixa: o.corte === undefined ? MES_CORTE_CAIXA : o.corte,
  });
}

describe("competência: compra própria no crédito", () => {
  it("a compra já reduz o disponível no mês dela, com a fatura aberta", () => {
    expect(painel(OUT).totalDisponivel).toBe(800);
    expect(painel(NOV).totalDisponivel).toBe(800);
  });
  it("o resultado do mês é por competência e a fatura continua como compromisso (informativo)", () => {
    const p = painel(OUT);
    expect(p.saidas).toBe(200);
    expect(p.resultadoMes).toBe(800);
    expect(p.faturaEmAberto).toBe(200);
  });
  it("pagar a fatura (mês seguinte ou mesmo mês) não desconta de novo: só liquida a obrigação", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    expect(painel(OUT, { pagamentos }).totalDisponivel).toBe(800);
    const nov = painel(NOV, { pagamentos });
    expect(nov.faturasPagas).toBe(300); // informativo: a saída efetiva da conta
    expect(nov.totalDisponivel).toBe(800);
    expect(painel(DEZ, { pagamentos }).totalDisponivel).toBe(800);
    expect(painel(OUT, { pagamentos: [pag(300, "2026-10-25")] }).totalDisponivel).toBe(800);
  });
  it("sem mês de corte vale a regra antiga (compra própria sai na compra)", () => {
    expect(painel(OUT, { corte: null }).totalDisponivel).toBe(800);
  });
  it("meses anteriores ao corte ficam como estavam (histórico preservado)", () => {
    const antes = { cartao: [{ ...propria, mes: "2026-09" }, deX({ mes: "2026-09" })], extrato: [{ ...entrada, mes: "2026-09" }] };
    expect(painel("2026-09", antes).totalDisponivel).toBe(800);
    expect(painel(OUT, antes).totalDisponivel).toBe(800);
  });
});

describe("competência: repasse e compra de terceiros no meu cartão", () => {
  const confirmadoEmOut = { cartao: [propria, deX(confirmado("2026-10-20"))] };
  it("a compra do outro integrante não é minha despesa e o repasse recebido não é entrada: o disponível não muda", () => {
    expect(painel(OUT, confirmadoEmOut).totalDisponivel).toBe(800);
    expect(painel(NOV, confirmadoEmOut).totalDisponivel).toBe(800);
    expect(painel(NOV, confirmadoEmOut).entradas).toBe(0);
    expect(painel(OUT).totalDisponivel).toBe(painel(OUT, confirmadoEmOut).totalDisponivel);
  });
  it("fatura paga + repasse confirmado em qualquer ordem nunca mexem no meu disponível", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    const emDezembro = { cartao: [propria, deX(confirmado("2026-12-05"))], pagamentos };
    const emOutubro = { ...confirmadoEmOut, pagamentos };
    for (const c of [emOutubro, emDezembro, { pagamentos }, {}]) {
      for (const mes of [OUT, NOV, DEZ, "2027-01"]) expect(painel(mes, c).totalDisponivel).toBe(800);
    }
  });
  it("uma confirmação posterior nunca altera um mês já passado (fechamento)", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    const antes = painel(NOV, { pagamentos }).totalDisponivel;
    const depois = painel(NOV, { pagamentos, cartao: [propria, deX(confirmado("2026-12-05"))] }).totalDisponivel;
    expect(depois).toBe(antes);
  });
  it("o mês da confirmação segue Brasília: 31/10 22h (BRT) ainda é outubro", () => {
    expect(mesEmBrasilia("2026-11-01T01:00:00Z")).toBe("2026-10");
    expect(mesEmBrasilia("2026-11-06 02:31:57.481481+00")).toBe("2026-11");
    expect(mesEmBrasilia("2026-11-01T04:00:00Z")).toBe("2026-11");
    expect(mesEmBrasilia(null, "2026-09")).toBe("2026-09");
  });
  it("pagamento parcial ou total da fatura, antes ou depois do repasse, dá sempre o mesmo disponível", () => {
    const p1 = pag(150, "2026-11-10");
    const p2 = pag(150, "2026-12-10");
    for (const pagamentos of [[p1], [p1, p2]]) {
      for (const mes of [NOV, DEZ, "2027-01"]) expect(painel(mes, { ...confirmadoEmOut, pagamentos }).totalDisponivel).toBe(800);
    }
  });
  it("visão Todos: o gasto de cada responsável conta na compra; pagar a fatura não muda", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    expect(painel(OUT, { escopo: null, cartao: confirmadoEmOut.cartao }).totalDisponivel).toBe(700);
    const nov = painel(NOV, { escopo: null, cartao: confirmadoEmOut.cartao, pagamentos });
    expect(nov.totalDisponivel).toBe(700);
    expect(nov.repassesRecebidos).toBe(0);
  });
});

describe("competência: consistência interna", () => {
  it("a composição soma exatamente o total e sobraPrevista = totalDisponivel + faturasOutros, em todos os meses", () => {
    const cenarios: Opcoes[] = [
      { pagamentos: [pag(150, "2026-11-10"), pag(150, "2026-12-10")], cartao: [propria, deX(confirmado("2026-12-20"))] },
      { pagamentos: [pag(300, "2026-11-10")] },
      { escopo: null, pagamentos: [pag(300, "2026-11-10")], cartao: [propria, deX(confirmado("2026-11-20"))] },
    ];
    for (const c of cenarios) {
      for (const mes of [OUT, NOV, DEZ]) {
        const p = painel(mes, c);
        expect(p.regraCompetencia).toBe(true);
        const soma = composicaoDoDisponivel(p, "mês anterior").reduce((s, l) => s + l.valor, 0);
        expect(Math.round(soma * 100) / 100).toBe(p.totalDisponivel);
        expect(Math.round((p.totalDisponivel + p.previsao.faturasOutros) * 100) / 100).toBe(p.sobraPrevista);
      }
    }
  });
});

describe("competência: débito e dinheiro", () => {
  const debito = { id: "d1", mes: OUT, tipo: "saida", categoria: "Casa", valor: 300, pagamento: "Itaú Débito", owner_id: "eu", responsavel_id: "x", responsavel: "X", descricao: "Prestação" };
  it("o que paguei por outro integrante não é despesa minha; o repasse recebido também não mexe no meu disponível", () => {
    const base = { extrato: [entrada, debito], cartao: [] as any[] };
    expect(painel(OUT, base).totalDisponivel).toBe(1000);
    expect(painel(OUT, base).adiantado).toBe(300); // informativo: aparece no grupo
    const recebido = { extrato: [entrada, { ...debito, ...confirmado("2026-11-06") }], cartao: [] as any[] };
    expect(painel(OUT, recebido).totalDisponivel).toBe(1000);
    expect(painel(NOV, recebido).totalDisponivel).toBe(1000);
  });
});

describe("ajusteDeFaturas: segurança", () => {
  const dados = { extrato: [] as any[], cartao: [propria, deX(confirmado("2026-10-20"))], contas: [] as any[] };
  const base = { meuId: "eu", escopo: new Set(["eu"]), cartoesCredito: new Set(credito) };
  it("sem corte nada muda em relação à regra antiga", () => {
    const r = ajusteDeFaturas(dados, [pag(300, "2026-11-10")], base);
    expect(r.pagoCaixa).toEqual({});
    expect(r.recebido).toEqual({});
    expect(r.emAberto).toEqual({});
    expect(r.pago).toEqual({ [NOV]: 100 });
  });
  it("cartão de outra pessoa com o mesmo nome não entra na fatura do titular", () => {
    const d = { ...dados, cartao: [propria, { ...propria, id: "z", owner_id: "x", responsavel_id: "x", valor: 999 }] };
    const r = ajusteDeFaturas(d, [pag(200, "2026-11-10")], { ...base, mesCorte: OUT });
    expect(r.emAberto[OUT]).toBe(200);
  });
  it("conta fixa pendente no crédito continua reservada e fora da fatura", () => {
    const conta = { id: "f", mes: OUT, nome: "Streaming", forma_pagamento: "Nubank", valor: 50, pago: false, owner_id: "eu", responsavel_id: "eu" };
    const r = ajusteDeFaturas({ ...dados, cartao: [propria], contas: [conta] }, [], { ...base, mesCorte: OUT });
    expect(r.emAberto[OUT]).toBe(200);
    const paga = ajusteDeFaturas({ ...dados, cartao: [propria], contas: [{ ...conta, pago: true }] }, [], { ...base, mesCorte: OUT });
    expect(paga.emAberto[OUT]).toBe(250);
  });
});

describe("competência: parcela em forma que não é cartão de crédito cadastrado", () => {
  const emDebito = { ...propria, id: "c9", cartao: "DEBITO" };
  it("a parcela sai do disponível na compra (como despesa comum)", () => {
    expect(painel(OUT, { cartao: [emDebito] }).totalDisponivel).toBe(800);
  });
  it("antes do corte nada muda (histórico preservado)", () => {
    const antes = { cartao: [{ ...emDebito, mes: "2026-09" }], extrato: [{ ...entrada, mes: "2026-09" }] };
    expect(painel("2026-09", antes).totalDisponivel).toBe(800);
  });
  it("cartão de crédito cadastrado também conta na compra", () => {
    expect(painel(OUT, { cartao: [propria] }).totalDisponivel).toBe(800);
  });
});
