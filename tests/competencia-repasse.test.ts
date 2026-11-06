import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { financeiroDoGrupo } from "../src/lib/financeiroGrupo";
import { calcularSaldoConta } from "../src/lib/contas";
import { marcarForaDaVisao, mesesDoReflexoDoRepasse, lancamentosDoGrupo } from "../src/lib/grupo";
import { mesDoRecebimento } from "../src/lib/calculos";
import { MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";
import { mesDoRecebimentoAgora, travaDoEstorno, verificarAlteracao, type ContextoTrava } from "../src/lib/fechamento";

/**
 * Competência do recebimento (repasse_mes): vale o mês financeiro em aberto de quem confirma, não o do calendário.
 * Registros antigos (sem repasse_mes) continuam pelo mês de repasse_pago_em.
 */
type Item = Record<string, unknown>;
const OUT = "2026-10";
const NOV = "2026-11";
const CONTA = { nome: "MERCADO PAGO Débito", saldo_inicial: 0 };
const eu = new Set(["eu"]);
const CARIMBO_NOV = "2026-11-06T17:12:28Z"; // confirmado em 06/11, com outubro ainda aberto

const base = { mes: OUT, owner_id: "eu", responsavel_id: "gisa", responsavel: "Gisa", autorNome: "Eu" };
const salario: Item = { id: "sal", mes: OUT, owner_id: "eu", responsavel_id: "eu", tipo: "entrada", valor: 1000, categoria: "Salário", pagamento: CONTA.nome };
const deGisa = (id: string, valor: number, extra: Item = {}): Item => ({ id, ...base, tipo: "saida", valor, pagamento: "NUBANK", ...extra });
const confirmado = (repasseMes: string | null, em = CARIMBO_NOV, conta: string | null = CONTA.nome): Item => ({ repasse_pago: true, repasse_pago_em: em, repasse_mes: repasseMes, repasse_conta: conta });
const pendente: Item = { repasse_pago: false, repasse_pago_em: null, repasse_mes: null, repasse_conta: null };

function ver(extrato: Item[], mes: string, cartao: Item[] = [], contas: Item[] = []) {
  const todos = { extrato, cartao, contas };
  const f = (l: Item[]) => l.map((i) => marcarForaDaVisao(i, eu));
  const painel = calcularPainel({ extrato: f(extrato), cartao: f(cartao), contas: f(contas) }, { mes, meuId: "eu", dadosRepasses: todos, escopo: eu, mesCorteCaixa: MES_CORTE_CAIXA });
  return { painel, grupo: financeiroDoGrupo(painel, todos, "eu"), saldo: calcularSaldoConta(todos as never, CONTA, { userId: "eu", ateMes: mes }) };
}

describe("mesDoRecebimento: repasse_mes manda; o carimbo é só alternativa", () => {
  it("usa repasse_mes quando existe, mesmo com o carimbo em outro mês", () => {
    expect(mesDoRecebimento({ repasse_mes: OUT, repasse_pago_em: CARIMBO_NOV, mes: OUT })).toBe(OUT);
    expect(mesDoRecebimento({ repasseMes: OUT, repassePagoEm: CARIMBO_NOV })).toBe(OUT);
  });
  it("registro antigo (sem repasse_mes) usa o mês da data da confirmação, em Brasília", () => {
    expect(mesDoRecebimento({ repasse_mes: null, repasse_pago_em: CARIMBO_NOV, mes: OUT })).toBe(NOV);
    expect(mesDoRecebimento({ repasse_pago_em: "2026-11-01T01:00:00Z", mes: OUT })).toBe(OUT); // 22h de 31/10 em Brasília
  });
  it("competência inválida é ignorada; sem nenhuma data vale o mês do lançamento", () => {
    expect(mesDoRecebimento({ repasse_mes: "2026-13", repasse_pago_em: CARIMBO_NOV, mes: OUT })).toBe(NOV);
    expect(mesDoRecebimento({ mes: OUT })).toBe(OUT);
  });
});

describe("confirmação em novembro com outubro ainda aberto (repasse_mes = outubro)", () => {
  const itens = [salario, deGisa("g1", 200, confirmado(OUT))];
  it("outubro: recebido e saldo da conta contam; pendente zera", () => {
    const o = ver(itens, OUT);
    expect(o.grupo).toMatchObject({ utilizado: 200, recebido: 200, pendente: 0, recebidoNoMes: 200 });
    expect(o.saldo.repasses).toBe(200);
  });
  it("novembro: acumulado igual, nada é 'recebido no mês' (sem contar duas vezes)", () => {
    const n = ver(itens, NOV);
    expect(n.grupo).toMatchObject({ recebido: 200, pendente: 0, recebidoNoMes: 0 });
    expect(n.saldo.repasses).toBe(200);
  });
  it("soma dos 'recebido no mês' em todos os meses = total recebido (cada repasse em um único mês)", () => {
    const meses = ["2026-09", OUT, NOV, "2026-12"];
    const somaMes = meses.reduce((t, m) => t + ver(itens, m).grupo.recebidoNoMes, 0);
    expect(somaMes).toBe(200);
  });
  it("Meu financeiro não muda por causa da confirmação", () => {
    const pend = ver([salario, deGisa("g1", 200, pendente)], OUT).painel;
    const conc = ver(itens, OUT).painel;
    expect(conc.totalDisponivel).toBe(pend.totalDisponivel);
    expect(conc.entradas).toBe(pend.entradas);
    expect(conc.entradasRenda).toBe(pend.entradasRenda);
    expect(conc.resultadoMes).toBe(pend.resultadoMes);
  });
});

describe("confirmação depois do fechamento de outubro (repasse_mes = novembro)", () => {
  const itens = [salario, deGisa("g1", 200, confirmado(NOV))];
  it("outubro não muda; o recebimento entra em novembro", () => {
    expect(ver(itens, OUT).grupo).toMatchObject({ recebido: 0, pendente: 200 });
    expect(ver(itens, OUT).saldo.repasses).toBe(0);
    expect(ver(itens, NOV).grupo).toMatchObject({ recebido: 200, pendente: 0, recebidoNoMes: 200 });
    expect(ver(itens, NOV).saldo.repasses).toBe(200);
  });
});

describe("pessoas com meses financeiros diferentes", () => {
  it("cada autor tem a sua competência: o carimbo igual não desloca nenhum dos dois", () => {
    // A (eu) ainda em outubro; B (ana) já fechou outubro. Ambos confirmaram em 06/11.
    const a = lancamentosDoGrupo({ extrato: [deGisa("a1", 100, confirmado(OUT))], cartao: [], contas: [] })[0];
    const b = lancamentosDoGrupo({ extrato: [{ ...deGisa("b1", 100, confirmado(NOV)), owner_id: "ana", autorNome: "Ana" }], cartao: [], contas: [] })[0];
    expect(a.mesRecebimento).toBe(OUT);
    expect(b.mesRecebimento).toBe(NOV);
  });
  it("o mês em aberto de quem confirma vem dele (mesDoRecebimentoAgora)", () => {
    const ctx = (fechados: string[], mesInicial: string | null) => ({ estado: { mesInicial, fechados: new Set(fechados) }, hoje: "2026-11-06" });
    expect(mesDoRecebimentoAgora(ctx([], OUT))).toBe(OUT); // outubro aberto: vale outubro, mesmo em novembro
    expect(mesDoRecebimentoAgora(ctx([OUT], OUT))).toBe(NOV); // depois de fechar outubro
    expect(mesDoRecebimentoAgora(ctx([], null))).toBe(NOV); // sem fechamento ativado: mês do calendário
  });
});

describe("repasses antigos, sem repasse_mes", () => {
  it("continuam pelo mês do carimbo (comportamento anterior preservado)", () => {
    const itens = [salario, deGisa("g1", 200, { repasse_pago: true, repasse_pago_em: CARIMBO_NOV, repasse_conta: CONTA.nome })];
    expect(ver(itens, OUT).grupo).toMatchObject({ recebido: 0, pendente: 200 });
    expect(ver(itens, NOV).grupo).toMatchObject({ recebido: 200, recebidoNoMes: 200 });
    expect(ver(itens, NOV).saldo.repasses).toBe(200);
  });
});

describe("os 19 repasses corrigidos para outubro (R$ 1.861,11)", () => {
  const ext = [...Array(10).keys()].map((n) => deGisa(`e${n}`, 60, confirmado(OUT))).concat(deGisa("e10", 120.36, confirmado(OUT)));
  const car = [215, 125, 436].map((v, n) => ({ id: `c${n}`, ...base, valor: v, cartao: "NUBANK", nome: `Compra ${n}`, parcelaAtual: 1, parcelaTotal: 1, ...confirmado(OUT) }));
  const fix = [13.25, 300, 25, 13.25, 13.25].map((v, n) => ({ id: `f${n}`, ...base, valor: v, nome: `Conta ${n}`, pago: true, ...confirmado(OUT) }));
  const antes = (l: Item[]) => l.map((i) => ({ ...i, ...pendente }));
  const todos = (e: Item[], c: Item[], f: Item[]) => ({ e: [salario, ...e], c, f });

  it("são 19 itens e somam R$ 1.861,11", () => {
    expect(ext.length + car.length + fix.length).toBe(19);
    const soma = [...ext, ...car, ...fix].reduce((t, i) => t + Number(i.valor), 0);
    expect(Math.round(soma * 100) / 100).toBe(1861.11);
  });
  it("outubro: recebido 1.861,11, pendente 0 e a conta soma uma única vez", () => {
    const d = todos(ext, car, fix);
    const o = ver(d.e, OUT, d.c, d.f);
    expect(o.grupo).toMatchObject({ utilizado: 1861.11, recebido: 1861.11, pendente: 0 });
    expect(o.saldo.repasses).toBe(1861.11);
  });
  it("novembro: acumulado igual, sem recebido no mês (nada duplicado)", () => {
    const d = todos(ext, car, fix);
    const n = ver(d.e, NOV, d.c, d.f);
    expect(n.grupo).toMatchObject({ recebido: 1861.11, pendente: 0, recebidoNoMes: 0 });
    expect(n.saldo.repasses).toBe(1861.11);
  });
  it("Meu financeiro idêntico ao estado antes de confirmar", () => {
    const d = todos(ext, car, fix);
    const dep = ver(d.e, OUT, d.c, d.f).painel;
    const ant = ver(todos(antes(ext), antes(car), antes(fix)).e, OUT, antes(car), antes(fix)).painel;
    expect(dep.totalDisponivel).toBe(ant.totalDisponivel);
    expect(dep.entradas).toBe(ant.entradas);
    expect(dep.resultadoMes).toBe(ant.resultadoMes);
  });
  it("não alterar só a competência mexe nos demais campos: conta, valores e responsável permanecem", () => {
    for (const i of [...ext, ...car, ...fix]) expect(i).toMatchObject({ repasse_conta: CONTA.nome, responsavel_id: "gisa", repasse_pago_em: CARIMBO_NOV });
  });
});

describe("travas de mês fechado usam a competência", () => {
  const ctx = (fechados: Record<string, string[]>, estado = { mesInicial: OUT, fechados: new Set<string>() }): ContextoTrava => ({
    estado, porPessoa: new Map(Object.entries(fechados).map(([k, v]) => [k, new Set(v)])), hoje: "2026-11-06", meuId: "eu", nomes: new Map([["eu", "Eu"], ["gisa", "Gisa"]]),
  });
  const rep = (extra: Item = {}) => ({ mes: OUT, owner_id: "eu", responsavel_id: "gisa", repasse_pago: true, repasse_pago_em: CARIMBO_NOV, repasse_mes: OUT, ...extra });

  it("estorno de repasse com competência em outubro é barrado quando outubro está fechado, mesmo com carimbo em novembro", () => {
    expect(travaDoEstorno(rep(), new Map([["eu", new Set([OUT])]])).travado).toBe(true);
    expect(verificarAlteracao({ tipo: "estornar", itens: [rep()] }, ctx({ eu: [OUT] }))).toMatch(/mês fechado/);
  });
  it("estorno com outubro aberto é permitido", () => {
    expect(verificarAlteracao({ tipo: "estornar", itens: [rep()] }, ctx({}))).toBeNull();
  });
  it("registro antigo: a trava continua usando o mês do carimbo", () => {
    const antigo = rep({ repasse_mes: null });
    expect(travaDoEstorno(antigo, new Map([["eu", new Set([OUT])]])).travado).toBe(false);
    expect(travaDoEstorno(antigo, new Map([["eu", new Set([NOV])]])).travado).toBe(true);
  });
  it("confirmar usa o mês em aberto de quem confirma: com outubro aberto o mês de novembro fechado do responsável não bloqueia", () => {
    const pend = { mes: OUT, owner_id: "eu", responsavel_id: "gisa" };
    expect(verificarAlteracao({ tipo: "confirmar", itens: [pend] }, ctx({ gisa: [NOV] }))).toBeNull();
  });
  it("confirmar é barrado se o responsável fechou o mês da competência", () => {
    const pend = { mes: "2026-09", owner_id: "eu", responsavel_id: "gisa" };
    expect(verificarAlteracao({ tipo: "confirmar", itens: [pend] }, ctx({ gisa: [OUT] }))).toMatch(/fechado/);
  });
});

describe("aviso do mês da confirmação", () => {
  it("avisa só quando o lançamento é de outro mês que o da competência", () => {
    expect(mesesDoReflexoDoRepasse([{ mes: OUT }, { mes: OUT }], NOV)).toEqual({ mesConfirmacao: NOV, mesesOrigem: [OUT] });
    expect(mesesDoReflexoDoRepasse([{ mes: OUT }], OUT).mesesOrigem).toEqual([]);
  });
});
