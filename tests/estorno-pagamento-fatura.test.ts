import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { calcularSaldoConta } from "../src/lib/contas";
import { financeiroDoGrupo } from "../src/lib/financeiroGrupo";
import { marcarForaDaVisao } from "../src/lib/grupo";
import { aposEstorno, faturasEmAberto, MES_CORTE_CAIXA, resumoFatura, validarEstorno, type PagamentoFatura } from "../src/lib/pagamentoFatura";

type Item = Record<string, unknown>;
const NOV = "2026-11";
const eu = { owner_id: "eu", responsavel_id: "eu", responsavel: "Eu", autorNome: "Eu" };
const gisa = { owner_id: "eu", responsavel_id: "gisa", responsavel: "Gisa", autorNome: "Eu" };

const salario = { id: "sal", mes: NOV, tipo: "entrada", categoria: "Salário", valor: 3000, ...eu };
const minhaCompra = { id: "m1", mes: NOV, nome: "Notebook", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 600, ...eu };
const compraGisa = { id: "g1", mes: NOV, nome: "Tênis", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 400, ...gisa };
const CREDITO = ["Nubank"];

const pagamento = (extra: Partial<PagamentoFatura> = {}): PagamentoFatura => ({ id: "pg1", cartao: "Nubank", mes: NOV, conta: "Inter", valor: 1000, data: "2026-11-20", ...extra });

function grupo(dados: { extrato: Item[]; cartao: Item[]; contas: Item[] }, pagamentos: PagamentoFatura[], mes = NOV) {
  const escopo = new Set(["eu"]);
  const f = (l: Item[]) => l.map((i) => marcarForaDaVisao(i, escopo));
  const painel = calcularPainel({ extrato: f(dados.extrato), cartao: f(dados.cartao), contas: f(dados.contas) } as never, { mes, meuId: "eu", dadosRepasses: dados as never, escopo, cartoesCredito: CREDITO, pagamentosFatura: pagamentos, mesCorteCaixa: MES_CORTE_CAIXA });
  return { painel, g: financeiroDoGrupo(painel, dados as never, "eu", { pagamentosFatura: pagamentos, cartoesCredito: CREDITO }) };
}

const dadosCredito = { extrato: [salario], cartao: [minhaCompra, compraGisa], contas: [] as Item[] };

describe("Disponível do grupo: só desconta o que foi pago", () => {
  it("compra no crédito (minha e do integrante) com a fatura aberta não desconta: 3.000", () => {
    const { g, painel } = grupo(dadosCredito, []);
    expect(painel.totalDisponivel).toBe(2400); // o Meu financeiro continua como sempre (compra própria na compra)
    expect(g.regraCaixa).toBe(true);
    expect(g.disponivelGrupo).toBe(3000);
    expect(g.utilizadoPago).toBe(0);
  });

  it("fatura paga pela conta: desconta uma vez, 1.000 (600 meus + 400 do integrante)", () => {
    const { g } = grupo(dadosCredito, [pagamento()]);
    expect(g.disponivelGrupo).toBe(2000);
    expect(g.naoDescontado).toBe(0);
    expect(g.utilizadoPago).toBe(400);
  });

  it("pagamento parcial desconta na proporção: 500 de 1.000 = metade de cada parte", () => {
    const { g } = grupo(dadosCredito, [pagamento({ valor: 500 })]);
    expect(g.utilizadoPago).toBe(200);
    expect(g.naoDescontado).toBe(300);
    expect(g.disponivelGrupo).toBe(2500); // 2400 + 300 + 0 − 200
  });

  it("conta fixa pendente (minha ou do integrante) não desconta; marcada como paga desconta", () => {
    const fixaMinha = (pago: boolean) => ({ id: "fm", mes: NOV, nome: "Luz", valor: 100, pago, forma_pagamento: "Inter", ...(pago ? { pago_em: "2026-11-10" } : {}), ...eu });
    const fixaGisa = (pago: boolean) => ({ id: "fg", mes: NOV, nome: "Internet", valor: 80, pago, forma_pagamento: "Inter", ...(pago ? { pago_em: "2026-11-12" } : {}), ...gisa });
    const base = { extrato: [salario], cartao: [], contas: [] as Item[] };
    const semNada = grupo(base, []).g.disponivelGrupo;
    const pendentes = grupo({ ...base, contas: [fixaMinha(false), fixaGisa(false)] }, []).g;
    expect(pendentes.disponivelGrupo).toBe(semNada); // nada saiu ainda
    const pagas = grupo({ ...base, contas: [fixaMinha(true), fixaGisa(true)] }, []).g;
    expect(pagas.disponivelGrupo).toBe(semNada - 180);
  });

  it("repasse confirmado aumenta o disponível na hora (e a compra do integrante só desconta quando paga)", () => {
    const confirmado = { ...compraGisa, repasse_pago: true, repasse_pago_em: "2026-11-15T10:00:00Z" };
    const sem = grupo(dadosCredito, []).g.disponivelGrupo;
    const com = grupo({ ...dadosCredito, cartao: [minhaCompra, confirmado] }, []).g;
    expect(com.recebido).toBe(400);
    expect(com.disponivelGrupo).toBe(sem + 400);
  });

  it("meses anteriores a outubro seguem a regra antiga (histórico não muda)", () => {
    const out = "2026-09";
    const dados = { extrato: [{ ...salario, mes: out }], cartao: [{ ...minhaCompra, mes: out }, { ...compraGisa, mes: out }], contas: [] as Item[] };
    const { g, painel } = grupo(dados, [], out);
    expect(g.regraCaixa).toBe(false);
    expect(g.disponivelGrupo).toBe(painel.totalDisponivel + g.recebido - g.utilizado);
    expect(g.naoDescontado).toBe(0);
  });
});

describe("Estornar pagamento de fatura", () => {
  const pagamentos = [pagamento()];
  const resumo = (lista: PagamentoFatura[]) => resumoFatura(1000, lista);

  it("a fatura volta para aberta", () => {
    expect(resumo(pagamentos).situacao).toBe("paga");
    const depois = aposEstorno(pagamentos, "pg1");
    expect(resumo(depois)).toMatchObject({ pago: 0, restante: 1000, situacao: "aberta" });
  });

  it("devolve o valor ao saldo da conta usada (inclusive conta pessoal) e só a ela", () => {
    const estado = { extrato: [], cartao: [], contas: [] } as never;
    const inter = { nome: "Inter", saldo_inicial: 5000 };
    const outra = { nome: "Itaú", saldo_inicial: 800 };
    expect(calcularSaldoConta(estado, inter, { pagamentosFatura: pagamentos, ateMes: NOV }).saldo).toBe(4000);
    expect(calcularSaldoConta(estado, inter, { pagamentosFatura: aposEstorno(pagamentos, "pg1"), ateMes: NOV }).saldo).toBe(5000);
    expect(calcularSaldoConta(estado, outra, { pagamentosFatura: aposEstorno(pagamentos, "pg1"), ateMes: NOV }).saldo).toBe(800);
  });

  it("a fatura reaparece em aberto", () => {
    const estado = { extrato: [], cartao: [minhaCompra, compraGisa], contas: [], config: {} } as never;
    expect(faturasEmAberto(estado, CREDITO, pagamentos, [NOV])).toEqual([]);
    expect(faturasEmAberto(estado, CREDITO, aposEstorno(pagamentos, "pg1"), [NOV]).map((f) => [f.cartao, f.restante])).toEqual([["Nubank", 1000]]);
  });

  it("recalcula o Disponível do grupo: pagar = 2.000; estornar volta a 3.000; nada vira 4.000", () => {
    const pago = grupo(dadosCredito, pagamentos).g.disponivelGrupo;
    const estornado = grupo(dadosCredito, aposEstorno(pagamentos, "pg1")).g.disponivelGrupo;
    expect(pago).toBe(2000);
    expect(estornado).toBe(3000);
    expect(estornado).toBe(grupo(dadosCredito, []).g.disponivelGrupo); // igual a nunca ter pago
  });

  it("não mexe no Meu financeiro: o Total disponível é o mesmo com ou sem o pagamento (pagar fatura não é despesa)", () => {
    expect(grupo(dadosCredito, pagamentos).painel.totalDisponivel).toBe(grupo(dadosCredito, []).painel.totalDisponivel);
  });

  it("não apaga compras, despesas nem lançamentos: estornar só mexe na lista de pagamentos", () => {
    const antes = JSON.stringify(dadosCredito);
    aposEstorno(pagamentos, "pg1");
    expect(JSON.stringify(dadosCredito)).toBe(antes);
    expect(pagamentos).toHaveLength(1); // a lista original também não é alterada
  });

  it("não duplica: estornar o mesmo pagamento de novo é recusado e não muda nada", () => {
    expect(validarEstorno("pg1", pagamentos)).toBeNull();
    const depois = aposEstorno(pagamentos, "pg1");
    expect(validarEstorno("pg1", depois)).toMatch(/já foi estornado/);
    expect(aposEstorno(depois, "pg1")).toEqual(depois);
    expect(grupo(dadosCredito, aposEstorno(depois, "pg1")).g.disponivelGrupo).toBe(3000);
  });

  it("estornar um de dois pagamentos devolve só o valor dele", () => {
    const dois = [pagamento({ id: "a", valor: 600 }), pagamento({ id: "b", valor: 400, data: "2026-11-25" })];
    const so = aposEstorno(dois, "b");
    expect(resumoFatura(1000, so)).toMatchObject({ pago: 600, restante: 400, situacao: "parcial" });
    expect(calcularSaldoConta({ extrato: [], cartao: [], contas: [] } as never, { nome: "Inter", saldo_inicial: 5000 }, { pagamentosFatura: so, ateMes: NOV }).saldo).toBe(4400);
  });
});
