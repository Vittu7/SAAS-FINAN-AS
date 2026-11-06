import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { financeiroDoGrupo } from "../src/lib/financeiroGrupo";
import { marcarForaDaVisao } from "../src/lib/grupo";
import { MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";

type Item = Record<string, unknown>;

/**
 * Cenário simples (o real de outubro/novembro está em regra-competencia.test.ts): minhas despesas, despesas que eu
 * criei para a Gisa (débito e crédito) e repasses confirmados só em novembro.
 * Grupo = meu disponível + repasses recebidos − utilizado pelos integrantes (acumulado até o mês visto).
 */
const OUT = "2026-10";
const NOV = "2026-11";
const ev = (id: string, extra: Item) => ({ id, mes: OUT, owner_id: "eu", responsavel_id: "eu", responsavel: "Eu", autorNome: "Eu", ...extra });
const gisa = { responsavel_id: "gisa", responsavel: "Gisa" };
const concluido = { repasse_pago: true, repasse_pago_em: "2026-11-05T12:00:00Z" };

const salario = ev("sal", { tipo: "entrada", valor: 1000, categoria: "Salário" });
const meuDebito = ev("d1", { tipo: "saida", valor: 100, pagamento: "Itaú Débito" });
const gisaDebito = (extra: Item = {}) => ev("d2", { tipo: "saida", valor: 200, pagamento: "Itaú Débito", ...gisa, ...extra });
const meuCredito = ev("c1", { nome: "Geladeira", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 150 });
const gisaCredito = (extra: Item = {}) => ev("c2", { nome: "Maquiagem", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 300, ...gisa, ...extra });
const faturaPaga = { id: "f1", cartao: "Nubank", mes: OUT, conta: "Itaú Débito", valor: 450, data: "2026-11-06" };

function visao(mes: string, confirmados: boolean, comFatura = true) {
  const rep = confirmados ? concluido : {};
  const todos = { extrato: [salario, meuDebito, gisaDebito(rep)], cartao: [meuCredito, gisaCredito(rep)], contas: [] as Item[] };
  const escopo = new Set(["eu"]);
  const f = (l: Item[]) => l.map((i) => marcarForaDaVisao(i, escopo));
  const dados = { extrato: f(todos.extrato), cartao: f(todos.cartao), contas: f(todos.contas) };
  const painel = calcularPainel(dados, { mes, meuId: "eu", dadosRepasses: todos, escopo, cartoesCredito: ["Nubank"], pagamentosFatura: comFatura ? [faturaPaga] : [], mesCorteCaixa: MES_CORTE_CAIXA });
  return { painel, grupo: financeiroDoGrupo(painel, todos, "eu") };
}

describe("financeiro do grupo", () => {
  it("outubro: meu disponível 750 (1000 − 100 − 150), utilizado 500, grupo 250", () => {
    const { painel, grupo } = visao(OUT, false);
    expect(painel.totalDisponivel).toBe(750);
    expect(grupo).toMatchObject({ meuDisponivel: 750, utilizado: 500, recebido: 0, pendente: 500, disponivelGrupo: 250, utilizadoNoMes: 500, recebidoNoMes: 0 });
    expect(grupo.meuDisponivel + grupo.recebido - grupo.utilizado).toBe(grupo.disponivelGrupo);
  });

  it("outubro não muda quando os repasses são confirmados em novembro", () => {
    const antes = visao(OUT, false);
    const depois = visao(OUT, true);
    expect(depois.painel.totalDisponivel).toBe(antes.painel.totalDisponivel);
    expect(depois.grupo).toEqual(antes.grupo);
  });

  it("novembro: a devolução aumenta o disponível do grupo e zera o pendente, sem mexer no meu financeiro", () => {
    const pendente = visao(NOV, false);
    const devolvido = visao(NOV, true);
    expect(pendente.grupo).toMatchObject({ meuDisponivel: 750, utilizado: 500, recebido: 0, pendente: 500, disponivelGrupo: 250 });
    expect(devolvido.grupo).toMatchObject({ meuDisponivel: 750, utilizado: 500, recebido: 500, pendente: 0, disponivelGrupo: 750, recebidoNoMes: 500, utilizadoNoMes: 0 });
    expect(devolvido.painel.totalDisponivel).toBe(pendente.painel.totalDisponivel);
    expect(devolvido.painel.entradasRenda).toBe(0);
    expect(devolvido.painel.entradas).toBe(0); // repasse nunca é entrada
  });

  it("a fatura paga não muda nada no grupo nem no meu financeiro (cada valor conta uma vez)", () => {
    for (const mes of [OUT, NOV]) {
      expect(visao(mes, true, true).grupo).toEqual(visao(mes, true, false).grupo);
      expect(visao(mes, true, true).painel.totalDisponivel).toBe(visao(mes, true, false).painel.totalDisponivel);
    }
  });

  it("repasse só informado (aguardando) não conta como recebido", () => {
    const informado = { repasse_informado: true, repasse_informado_em: "2026-11-03T12:00:00Z" };
    const todos = { extrato: [salario, gisaDebito(informado)], cartao: [] as Item[], contas: [] as Item[] };
    const escopo = new Set(["eu"]);
    const painel = calcularPainel({ extrato: todos.extrato.map((i) => marcarForaDaVisao(i, escopo)), cartao: [], contas: [] }, { mes: NOV, meuId: "eu", dadosRepasses: todos, escopo, mesCorteCaixa: MES_CORTE_CAIXA });
    const g = financeiroDoGrupo(painel, todos, "eu");
    expect(g).toMatchObject({ utilizado: 200, recebido: 0, pendente: 200, aguardando: 200, disponivelGrupo: 800 });
  });

  it("acompanhamento por membro: utilizou, devolveu e pendente", () => {
    expect(visao(OUT, false).grupo.membros).toEqual([expect.objectContaining({ id: "gisa", nome: "Gisa", utilizado: 500, recebido: 0, pendente: 500, utilizadoNoMes: 500 })]);
    expect(visao(NOV, true).grupo.membros).toEqual([expect.objectContaining({ id: "gisa", utilizado: 500, recebido: 500, pendente: 0, utilizadoNoMes: 0, recebidoNoMes: 500 })]);
  });

  it("parcelas e contas de meses futuros ainda não entram no utilizado", () => {
    const futura = ev("fut", { tipo: "saida", valor: 80, pagamento: "Pix", mes: "2026-12", ...gisa });
    const todos = { extrato: [salario, futura], cartao: [] as Item[], contas: [] as Item[] };
    const painel = calcularPainel({ extrato: [salario], cartao: [], contas: [] }, { mes: OUT, meuId: "eu", dadosRepasses: todos, escopo: new Set(["eu"]), mesCorteCaixa: MES_CORTE_CAIXA });
    expect(financeiroDoGrupo(painel, todos, "eu").utilizado).toBe(0);
  });
});
