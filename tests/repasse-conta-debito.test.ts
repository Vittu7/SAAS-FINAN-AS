import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { financeiroDoGrupo } from "../src/lib/financeiroGrupo";
import { calcularSaldoConta } from "../src/lib/contas";
import { marcarForaDaVisao } from "../src/lib/grupo";
import { MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";

/**
 * Repasse confirmado com conta de débito (repasse_conta): efeito no saldo da conta, no Meu financeiro e no Financeiro do grupo.
 * Regra vigente: o recebimento vale no MÊS DA CONFIRMAÇÃO (repasse_pago_em); a despesa continua na competência original.
 * Por isso, olhando o mês original (outubro) nada muda; a partir do mês da confirmação (novembro) o saldo e o grupo atualizam.
 */
type Item = Record<string, unknown>;
const OUT = "2026-10";
const NOV = "2026-11";
const CONTA = { nome: "Itaú Débito", saldo_inicial: 0 };
const eu = new Set(["eu"]);

const base = { mes: OUT, owner_id: "eu", responsavel_id: "eu", responsavel: "Eu" };
const salario: Item = { id: "sal", ...base, tipo: "entrada", valor: 1000, categoria: "Salário", pagamento: CONTA.nome };
const gisaDebito = (extra: Item = {}): Item => ({ id: "g1", ...base, responsavel_id: "gisa", responsavel: "Gisa", tipo: "saida", valor: 200, pagamento: CONTA.nome, ...extra });

const informado: Item = { repasse_informado: true, repasse_informado_em: "2026-11-03T12:00:00Z" };
const concluidoNaConta = (conta: string | null = CONTA.nome): Item => ({ repasse_pago: true, repasse_pago_em: "2026-11-06T17:12:28Z", repasse_conta: conta });
const estornado: Item = { repasse_pago: false, repasse_pago_em: null, repasse_conta: null, repasse_conta_origem: null, repasse_informado: false, repasse_informado_em: null };

function ver(repasse: Item, mes: string) {
  const todos = { extrato: [salario, gisaDebito(repasse)], cartao: [] as Item[], contas: [] as Item[] };
  const dados = { extrato: todos.extrato.map((i) => marcarForaDaVisao(i, eu)), cartao: [] as Item[], contas: [] as Item[] };
  const painel = calcularPainel(dados, { mes, meuId: "eu", dadosRepasses: todos, escopo: eu, mesCorteCaixa: MES_CORTE_CAIXA });
  return {
    painel,
    grupo: financeiroDoGrupo(painel, todos, "eu"),
    saldo: calcularSaldoConta(todos as never, CONTA, { userId: "eu", ateMes: mes }),
  };
}

describe("repasse confirmado: conta de débito, saldo e grupo", () => {
  it("pendente: nada recebido, saldo da conta só reflete o que foi pago nela", () => {
    const { saldo, grupo } = ver({}, NOV);
    expect(saldo).toMatchObject({ repasses: 0, saldo: 800 }); // 1000 − 200 pagos da conta
    expect(grupo).toMatchObject({ utilizado: 200, recebido: 0, pendente: 200 });
  });

  it("confirmado SEM conta: soma no recebido do grupo, mas não entra no saldo de nenhuma conta", () => {
    const { saldo, grupo } = ver(concluidoNaConta(null), NOV);
    expect(saldo).toMatchObject({ repasses: 0, saldo: 800 });
    expect(grupo).toMatchObject({ recebido: 200, pendente: 0, recebidoNoMes: 200 });
  });

  it("confirmado COM débito, visto no mês da confirmação: saldo da conta e grupo atualizam", () => {
    const { saldo, grupo } = ver(concluidoNaConta(), NOV);
    expect(saldo).toMatchObject({ repasses: 200, saldo: 1000 });
    expect(grupo).toMatchObject({ recebido: 200, pendente: 0, recebidoNoMes: 200 });
    expect(grupo.disponivelGrupo).toBe(grupo.meuDisponivel + grupo.recebido - grupo.utilizado);
  });

  it("confirmado COM débito, visto no mês ORIGINAL (outubro): nada muda (o dinheiro entrou em novembro)", () => {
    const antes = ver({}, OUT);
    const depois = ver(concluidoNaConta(), OUT);
    expect(depois.saldo.saldo).toBe(antes.saldo.saldo);
    expect(depois.saldo.repasses).toBe(0);
    expect(depois.grupo).toEqual(antes.grupo);
  });

  it("conta de destino com outro nome não altera o saldo da conta consultada", () => {
    expect(ver(concluidoNaConta("Outra Débito"), NOV).saldo).toMatchObject({ repasses: 0, saldo: 800 });
  });

  it("repasse só informado e depois cancelado (desinformar) volta ao pendente sem efeito", () => {
    const aviso = ver(informado, NOV);
    expect(aviso.grupo).toMatchObject({ recebido: 0, pendente: 200, aguardando: 200 });
    expect(aviso.saldo.repasses).toBe(0);
    const cancelado = ver({ repasse_informado: false, repasse_informado_em: null }, NOV);
    expect(cancelado.grupo).toMatchObject({ recebido: 0, pendente: 200, aguardando: 0 });
    expect(cancelado.saldo.saldo).toBe(800);
  });

  it("estorno depois de concluído devolve saldo e grupo ao estado pendente", () => {
    const concluido = ver(concluidoNaConta(), NOV);
    const depoisDoEstorno = ver(estornado, NOV);
    expect(concluido.saldo.saldo).toBe(1000);
    expect(depoisDoEstorno.saldo).toMatchObject({ repasses: 0, saldo: 800 });
    expect(depoisDoEstorno.grupo).toEqual(ver({}, NOV).grupo);
  });

  it("sem duplicidade: conta, grupo e Meu financeiro contam o repasse uma única vez e ele não vira renda nem despesa", () => {
    const pend = ver({}, NOV);
    const conc = ver(concluidoNaConta(), NOV);
    expect(conc.saldo.repasses).toBe(200); // uma vez
    expect(conc.grupo.recebido).toBe(200); // uma vez
    expect(conc.grupo.utilizado).toBe(pend.grupo.utilizado); // a despesa da Gisa não foi duplicada
    expect(conc.painel.totalDisponivel).toBe(pend.painel.totalDisponivel); // Meu financeiro intocado
    expect(conc.painel.entradas).toBe(0); // repasse não é renda
    expect(conc.painel.entradasRenda).toBe(0);
    expect(conc.painel.resultadoMes).toBe(pend.painel.resultadoMes); // nem despesa nova
  });
});
