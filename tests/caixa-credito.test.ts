import { describe, it, expect } from "vitest";
import { calcularPainel, composicaoDoDisponivel } from "../src/lib/painel";
import { mesEmBrasilia } from "../src/lib/calculos";
import { entradasDeRepasse, marcarForaDaVisao } from "../src/lib/grupo";
import { ajusteDeFaturas, MES_CORTE_CAIXA, type PagamentoFatura } from "../src/lib/pagamentoFatura";

/**
 * REGRA DE CAIXA DO CRÉDITO: o dinheiro só sai quando a fatura é paga; o repasse de compra no crédito só compensa
 * nos pagamentos da fatura (proporcional); débito/dinheiro seguem a data real do recebimento.
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

describe("regra de caixa: compra própria no crédito", () => {
  it("fatura aberta: o dinheiro não saiu, nem no mês da compra nem depois", () => {
    expect(painel(OUT).totalDisponivel).toBe(1000);
    expect(painel(NOV).totalDisponivel).toBe(1000);
  });
  it("o resultado do mês continua por competência (a compra aparece nas saídas)", () => {
    const p = painel(OUT);
    expect(p.saidas).toBe(200);
    expect(p.resultadoMes).toBe(800);
    expect(p.faturaEmAberto).toBe(200);
  });
  it("fatura paga no mês seguinte: sai só em novembro, uma vez, e o saldo acumulado continua", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    expect(painel(OUT, { pagamentos }).totalDisponivel).toBe(1000);
    const nov = painel(NOV, { pagamentos });
    expect(nov.faturasPagas).toBe(300);
    expect(nov.totalDisponivel).toBe(700);
    expect(painel(DEZ, { pagamentos }).totalDisponivel).toBe(700);
  });
  it("fatura paga no mesmo mês da compra: não muda nada em relação à compra à vista", () => {
    expect(painel(OUT, { pagamentos: [pag(300, "2026-10-25")] }).totalDisponivel).toBe(700);
  });
  it("sem mês de corte vale a regra antiga (compra própria sai na compra)", () => {
    expect(painel(OUT, { corte: null }).totalDisponivel).toBe(800);
  });
  it("faturas anteriores ao corte ficam como estavam (histórico preservado)", () => {
    const antes = { cartao: [{ ...propria, mes: "2026-09" }, deX({ mes: "2026-09" })], extrato: [{ ...entrada, mes: "2026-09" }] };
    expect(painel("2026-09", antes).totalDisponivel).toBe(800);
    expect(painel(OUT, antes).totalDisponivel).toBe(800);
  });
});

describe("regra de caixa: repasse de compra de terceiros no crédito", () => {
  const confirmadoEmOut = { cartao: [propria, deX(confirmado("2026-10-20"))] };
  it("marcar como recebido NÃO entra no total enquanto a fatura não foi paga", () => {
    expect(painel(OUT, confirmadoEmOut).totalDisponivel).toBe(1000);
    expect(painel(NOV, confirmadoEmOut).totalDisponivel).toBe(1000);
  });
  it("entra no mês do pagamento da fatura, não no mês do clique", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    const emDezembro = { cartao: [propria, deX(confirmado("2026-12-05"))], pagamentos };
    const emOutubro = { ...confirmadoEmOut, pagamentos };
    // 1000 − 300 (fatura inteira) + 100 (repasse da compra de X)
    expect(painel(NOV, emOutubro).totalDisponivel).toBe(800);
    expect(painel(NOV, emOutubro).repassesRecebidos).toBe(100);
    // Confirmado só em dezembro (depois do pagamento): novembro NÃO muda; o repasse entra em dezembro
    expect(painel(NOV, emDezembro).totalDisponivel).toBe(700);
    expect(painel(DEZ, emDezembro).totalDisponivel).toBe(800);
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
  it("pagamento parcial compensa proporcionalmente em cada pagamento, sem duplicar", () => {
    const parcial = (pagamentos: PagamentoFatura[], mes: string) => painel(mes, { ...confirmadoEmOut, pagamentos });
    const p1 = pag(150, "2026-11-10");
    const p2 = pag(150, "2026-12-10");
    expect(parcial([p1], NOV).totalDisponivel).toBe(900); // −150 + 50
    expect(parcial([p1, p2], NOV).totalDisponivel).toBe(900);
    expect(parcial([p1, p2], DEZ).totalDisponivel).toBe(800); // igual a pagar tudo de uma vez
    expect(parcial([p1, p2], "2027-01").totalDisponivel).toBe(800);
  });
  it("repasse ainda não confirmado não compensa nada, mesmo com a fatura paga", () => {
    expect(painel(NOV, { pagamentos: [pag(300, "2026-11-10")] }).totalDisponivel).toBe(700);
  });
  it("visão Todos: o repasse é interno e não aparece como entrada; o dinheiro sai só no pagamento", () => {
    const pagamentos = [pag(300, "2026-11-10")];
    expect(painel(OUT, { escopo: null, cartao: confirmadoEmOut.cartao }).totalDisponivel).toBe(1000);
    const nov = painel(NOV, { escopo: null, cartao: confirmadoEmOut.cartao, pagamentos });
    expect(nov.totalDisponivel).toBe(700);
    expect(nov.repassesRecebidos).toBe(0);
  });
});

describe("regra de caixa: consistência interna", () => {
  it("a composição soma exatamente o total e a identidade da sobra prevista fecha, em todos os meses", () => {
    const cenarios: Opcoes[] = [
      { pagamentos: [pag(150, "2026-11-10"), pag(150, "2026-12-10")], cartao: [propria, deX(confirmado("2026-12-20"))] },
      { pagamentos: [pag(300, "2026-11-10")] },
      { escopo: null, pagamentos: [pag(300, "2026-11-10")], cartao: [propria, deX(confirmado("2026-11-20"))] },
    ];
    for (const c of cenarios) {
      for (const mes of [OUT, NOV, DEZ]) {
        const p = painel(mes, c);
        const soma = composicaoDoDisponivel(p, "mês anterior").reduce((s, l) => s + l.valor, 0);
        expect(Math.round(soma * 100) / 100).toBe(p.totalDisponivel);
        const ident = p.totalDisponivel + p.previsao.receber - p.previsao.repassar + p.previsao.faturasOutros;
        expect(Math.round(ident * 100) / 100).toBe(p.sobraPrevista);
      }
    }
  });
});

describe("regra de caixa: débito e dinheiro não mudam", () => {
  const debito = { id: "d1", mes: OUT, tipo: "saida", categoria: "Casa", valor: 300, pagamento: "Itaú Débito", owner_id: "eu", responsavel_id: "x", responsavel: "X", descricao: "Prestação" };
  it("adiantado no débito sai no mês da despesa e o repasse volta na data real do recebimento", () => {
    const base = { extrato: [entrada, debito], cartao: [] as any[] };
    expect(painel(OUT, base).totalDisponivel).toBe(700);
    const recebido = { extrato: [entrada, { ...debito, ...confirmado("2026-11-06") }], cartao: [] as any[] };
    expect(painel(OUT, recebido).totalDisponivel).toBe(700);
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
