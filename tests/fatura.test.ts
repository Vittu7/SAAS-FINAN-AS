import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { calcularMes } from "../src/lib/calculos";
import { calcularSaldoConta } from "../src/lib/contas";
import { entradasDeRepasse, marcarForaDaVisao, idsDaSelecao } from "../src/lib/grupo";
import { calcularFatura, pagamentosDaFatura, resumoFatura, validarPagamento, vencimentoDaFatura, type PagamentoFatura } from "../src/lib/pagamentoFatura";

const M = "2026-10";
const credito = ["Nubank"];
const pag = (valor: number, extra: Partial<PagamentoFatura> = {}): PagamentoFatura => ({ id: `p${valor}${extra.data ?? ""}`, cartao: "Nubank", mes: M, conta: "Itaú Débito", valor, data: "2026-10-25", ...extra });
const pagoRepasse = { repasse_pago: true, repasse_pago_em: "2026-10-20T10:00:00Z" };

// Exemplo obrigatório: entrada de R$ 50, compra de R$ 100 no meu cartão para X (responsável), fatura de R$ 100
const entrada = { id: "e", mes: M, tipo: "entrada", categoria: "Extra", valor: 50, owner_id: "eu", responsavel_id: "eu", responsavel: "Eu" };
const compra = (extra: any = {}) => ({ id: "c", mes: M, nome: "Maquiagem", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 100, owner_id: "eu", responsavel_id: "x", responsavel: "X", autorNome: "Eu", ...extra });

const dados = (c: any) => ({ extrato: [entrada], cartao: [c], contas: [] as any[] });

/** O que a tela inicial faz: marca o que é de outra pessoa (fora da visão) e gera a entrada do repasse concluído. */
function visao(c: any, escopo: string[] | null) {
  const set = escopo ? new Set(escopo) : null;
  const d = dados(c);
  const filtrado = {
    extrato: d.extrato.filter((i: any) => !set || set.has(i.responsavel_id) || set.has(i.owner_id)),
    cartao: d.cartao.filter((i: any) => !set || set.has(i.responsavel_id) || set.has(i.owner_id)).map((i: any) => marcarForaDaVisao(i, set)),
    contas: [] as any[],
  };
  const linhas = entradasDeRepasse(filtrado);
  return { filtrado: { ...filtrado, extrato: [...filtrado.extrato, ...linhas] }, set };
}
const total = (c: any, escopo: string[] | null, pagamentos: PagamentoFatura[] = [], mes = M, meuId: string | null = "eu") => {
  const { filtrado, set } = visao(c, escopo);
  return calcularPainel(filtrado, { mes, meuId, dadosRepasses: dados(c), escopo: set, cartoesCredito: credito, pagamentosFatura: pagamentos }).totalDisponivel;
};

describe("exemplo obrigatório: entrada 50, compra 100 para X no meu cartão", () => {
  it("fatura pendente: R$ 50 (a compra de terceiros ainda não tirou dinheiro)", () => {
    expect(total(compra(), ["eu"])).toBe(50);
  });
  it("após receber o repasse: R$ 150", () => {
    expect(total(compra(pagoRepasse), ["eu"])).toBe(150);
  });
  it("após pagar a fatura: R$ 50", () => {
    expect(total(compra(pagoRepasse), ["eu"], [pag(100)])).toBe(50);
  });
  it("entradas contam o repasse recebido uma vez e a fatura paga não vira despesa", () => {
    const { filtrado, set } = visao(compra(pagoRepasse), ["eu"]);
    const p = calcularPainel(filtrado, { mes: M, meuId: "eu", dadosRepasses: dados(compra(pagoRepasse)), escopo: set, cartoesCredito: credito, pagamentosFatura: [pag(100)] });
    expect(p.entradas).toBe(150);
    expect(p.saidas).toBe(0);
    expect(calcularMes(filtrado, { mes: M }).saidas).toBe(0);
  });
  it("sem pagar a fatura mas com o repasse feito em outro mês, o mês seguinte herda os R$ 150", () => {
    expect(total(compra(pagoRepasse), ["eu"], [], "2026-11")).toBe(150);
  });
});

describe("visão individual x Todos", () => {
  for (const [nome, c, pagamentos] of [
    ["pendente", compra(), []],
    ["repasse concluído", compra(pagoRepasse), []],
    ["repasse concluído e fatura paga", compra(pagoRepasse), [pag(100)]],
    ["fatura paga antes do repasse", compra(), [pag(100)]],
  ] as const) {
    it(`Somente eu + só X = Todos (${nome})`, () => {
      for (const mes of [M, "2026-11"]) {
        const eu = total(c, ["eu"], [...pagamentos], mes);
        // X não paga fatura nem vê a minha: só a parte dela (a compra) e o repasse enviado
        const x = total(c, ["x"], [], mes, "x");
        const todos = total(c, null, [...pagamentos], mes);
        // a entrada de R$ 50 é minha: entra em "eu" e em Todos; X não a vê
        expect(eu + x).toBe(todos);
      }
    });
  }
  it("Todos: o repasse é transferência interna (nada muda ao concluir)", () => {
    expect(total(compra(), null)).toBe(total(compra(pagoRepasse), null));
  });
  it("Todos: a compra conta uma vez; a fatura paga tira o dinheiro uma vez", () => {
    expect(total(compra(), null)).toBe(50);
    expect(total(compra(), null, [pag(100)])).toBe(-50);
  });
});

describe("compra no crédito com responsável diferente do titular", () => {
  it("continua na fatura do cartão e é despesa do responsável, não do titular", () => {
    const estado: any = { extrato: [], cartao: [compra()], contas: [] };
    expect(calcularFatura(estado, "Nubank", M, 1000).total).toBe(100);
    const { filtrado } = visao(compra(), ["eu"]);
    expect(calcularMes(filtrado, { mes: M }).saidas).toBe(0);
    const doX = visao(compra(), ["x"]).filtrado;
    expect(calcularMes(doX, { mes: M }).saidas).toBe(100);
  });
  it("compras do próprio titular (responsável = titular) saem na compra e o pagamento não tira de novo", () => {
    const propria = compra({ responsavel_id: "eu", responsavel: "Eu" });
    expect(total(propria, ["eu"])).toBe(-50);
    expect(total(propria, ["eu"], [pag(100)])).toBe(-50);
  });
  it("fatura mista: o pagamento parcial se divide na proporção entre o que é dele e o que é de terceiros", () => {
    const propria = compra({ id: "p", valor: 300, responsavel_id: "eu", responsavel: "Eu" });
    const d = { extrato: [entrada], cartao: [propria, compra()], contas: [] as any[] }; // fatura 400: 300 dele + 100 de X
    const set = new Set(["eu"]);
    const filtrado = { ...d, cartao: d.cartao.map((i: any) => marcarForaDaVisao(i, set)) };
    const painel = (pagamentos: PagamentoFatura[]) => calcularPainel(filtrado, { mes: M, meuId: "eu", dadosRepasses: d, escopo: set, cartoesCredito: credito, pagamentosFatura: pagamentos }).totalDisponivel;
    expect(painel([])).toBe(50 - 300); // só a compra própria saiu
    expect(painel([pag(200)])).toBe(50 - 300 - 50); // metade da fatura paga: metade dos R$ 100 de X
    expect(painel([pag(200), pag(200, { id: "outro", data: "2026-10-26" })])).toBe(50 - 300 - 100);
  });
});

describe("pagamento integral, parcial e histórico", () => {
  const lista = [pag(30, { data: "2026-10-10" }), pag(20, { id: "b", data: "2026-10-12" }), pag(99, { id: "c", cartao: "Outro" }), pag(5, { id: "d", mes: "2026-09" })];
  it("integral: restante zero e situação paga", () => {
    expect(resumoFatura(100, [pag(100)])).toEqual({ total: 100, pago: 100, restante: 0, situacao: "paga" });
  });
  it("parcial: atualiza o restante e a situação", () => {
    const r = resumoFatura(100, pagamentosDaFatura(lista, "Nubank", M));
    expect(r).toEqual({ total: 100, pago: 50, restante: 50, situacao: "parcial" });
  });
  it("sem pagamentos: aberta", () => {
    expect(resumoFatura(100, [])).toMatchObject({ pago: 0, restante: 100, situacao: "aberta" });
  });
  it("histórico: só da fatura (cartão e mês), em ordem de data", () => {
    expect(pagamentosDaFatura(lista, "Nubank", M).map((p) => p.id)).toEqual(["p30" + "2026-10-10", "b"]);
  });
  it("centavos não deixam resto fantasma", () => {
    expect(resumoFatura(0.3, [pag(0.1), pag(0.2, { id: "z" })])).toMatchObject({ restante: 0, situacao: "paga" });
  });
  it("vencimento: dia 31 em mês curto vira o último dia", () => {
    expect(vencimentoDaFatura("2026-10", 10)).toBe("2026-10-10");
    expect(vencimentoDaFatura("2026-02", 31)).toBe("2026-02-28");
    expect(vencimentoDaFatura("2026-02", null)).toBeNull();
  });
});

describe("prevenção de erro e duplicidade", () => {
  it("não aceita valor acima do restante, zero, fatura paga nem conta vazia", () => {
    expect(validarPagamento(100.01, 100, { conta: "A" })).toMatch(/maior que o restante/);
    expect(validarPagamento(0, 100, { conta: "A" })).toMatch(/maior que zero/);
    expect(validarPagamento(10, 0, { conta: "A" })).toMatch(/já está paga/);
    expect(validarPagamento(10, 100, { conta: "" })).toMatch(/conta/);
    expect(validarPagamento(100, 100, { conta: "A" })).toBeNull();
  });
  it("o mesmo pagamento (mesmo id) não é aceito duas vezes", () => {
    const p = pag(40);
    expect(validarPagamento(40, 60, { conta: "A", id: p.id, existentes: [p] })).toMatch(/já foi registrado/);
    expect(validarPagamento(40, 60, { conta: "A", id: "novo", existentes: [p] })).toBeNull();
  });
});

describe("saldo da conta", () => {
  const conta = { nome: "Itaú Débito", saldo_inicial: 1000 };
  it("o pagamento da fatura sai da conta escolhida, e só dela", () => {
    const estado: any = { extrato: [], cartao: [], contas: [] };
    expect(calcularSaldoConta(estado, conta, { pagamentosFatura: [pag(100)] })).toMatchObject({ faturasPagas: 100, saldo: 900 });
    expect(calcularSaldoConta(estado, conta, { pagamentosFatura: [pag(100, { conta: "Outra" })] }).saldo).toBe(1000);
  });
  it("respeita o mês: pagamento futuro não afeta o saldo atual", () => {
    const estado: any = { extrato: [], cartao: [], contas: [] };
    expect(calcularSaldoConta(estado, conta, { ateMes: "2026-09", pagamentosFatura: [pag(100)] }).saldo).toBe(1000);
  });
  it("o pagamento não vira despesa do mês", () => {
    const estado: any = { extrato: [], cartao: [], contas: [] };
    expect(calcularMes(estado, { mes: M }).saidas).toBe(0);
  });
});

describe("seleção de pessoas (idsDaSelecao) continua coerente", () => {
  it("Somente eu resolve para o meu id", () => {
    expect([...(idsDaSelecao(["__eu__"], [{ id: "eu", nome: "Eu" }], "eu", "__eu__") ?? [])]).toEqual(["eu"]);
  });
});
