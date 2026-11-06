import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { calcularPainel } from "../src/lib/painel";
import { financeiroDoGrupo } from "../src/lib/financeiroGrupo";
import { calcularSaldoConta } from "../src/lib/contas";
import { lancamentosDoGrupo, marcarForaDaVisao, repasseValidoParaAcao, type LancGrupo } from "../src/lib/grupo";
import { elegivelParaEstorno, planoDeEstorno } from "../src/lib/estornoLote";
import { verificarAlteracao, type ContextoTrava } from "../src/lib/fechamento";
import { MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";

type Item = Record<string, unknown>;
const OUT = "2026-10";
const CONTA = { nome: "MERCADO PAGO Débito", saldo_inicial: 0 };
const eu = new Set(["eu"]);
const conf: Item = { repasse_pago: true, repasse_pago_em: "2026-11-06T17:12:28Z", repasse_mes: OUT, repasse_conta: CONTA.nome };
const pend: Item = { repasse_pago: false, repasse_pago_em: null, repasse_mes: null, repasse_conta: null };
const nomes: Record<string, string> = { gisa: "Gisa", leo: "Leo" };
const item = (id: string, resp: string, valor: number, extra: Item = {}, mes = OUT): Item => ({ id, mes, owner_id: "eu", responsavel_id: resp, responsavel: nomes[resp], autorNome: "Eu", tipo: "saida", valor, pagamento: "NUBANK", ...conf, ...extra });
const salario: Item = { id: "sal", mes: OUT, owner_id: "eu", responsavel_id: "eu", tipo: "entrada", valor: 1000, categoria: "Salário", pagamento: CONTA.nome };
const lanc = (itens: Item[]): LancGrupo[] => lancamentosDoGrupo({ extrato: itens, cartao: [], contas: [] });

describe("seleção de estornos (vários responsáveis ao mesmo tempo)", () => {
  const lista = lanc([item("g1", "gisa", 100), item("g2", "gisa", 50), item("g3", "gisa", 30, pend), item("l1", "leo", 70), { ...item("x1", "gisa", 20), owner_id: "ana" }]);
  it("elegível = confirmado, meu (autor) e de outro responsável", () => {
    expect(lista.filter((l) => elegivelParaEstorno(l, "eu")).map((l) => l.id).sort()).toEqual(["g1", "g2", "l1"]);
  });
  it("selecionar todos inclui responsáveis diferentes e continua sem pendentes nem repasses de outro autor", () => {
    const plano = planoDeEstorno(lista, "eu");
    expect(plano.liberados.map((l) => l.id).sort()).toEqual(["g1", "g2", "l1"]);
    expect([...new Set(plano.liberados.map((l) => l.respNome))].sort()).toEqual(["Gisa", "Leo"]);
    expect(plano.total).toBe(220);
  });
  it("seleção parcial de responsáveis diferentes soma só o marcado", () => {
    const marcados = lista.filter((l) => ["g2", "l1"].includes(l.id));
    expect(planoDeEstorno(marcados, "eu").total).toBe(120);
  });
});

describe("plano de estorno (individual e em lote)", () => {
  const lista = lanc([item("g1", "gisa", 100), item("g2", "gisa", 50), item("g3", "gisa", 25, pend)]);
  it("estorno individual: um repasse, total dele", () => {
    const p = planoDeEstorno([lista[0]], "eu");
    expect(p.liberados.map((l) => l.id)).toEqual(["g1"]);
    expect(p.total).toBe(100);
  });
  it("em lote: quantidade e valor total; já estornado fica de fora", () => {
    const p = planoDeEstorno(lista, "eu");
    expect(p.liberados.map((l) => l.id)).toEqual(["g1", "g2"]);
    expect(p.ignorados.map((l) => l.id)).toEqual(["g3"]);
    expect(p.total).toBe(150);
  });
  it("sem duplicidade: o mesmo repasse repetido na seleção entra uma vez", () => {
    const p = planoDeEstorno([lista[0], lista[0], lista[1]], "eu");
    expect(p.liberados).toHaveLength(2);
    expect(p.total).toBe(150);
  });
  it("sem autorização: repasse de outro autor nunca entra", () => {
    const alheio = lanc([{ ...item("a1", "gisa", 10), owner_id: "ana" }]);
    expect(planoDeEstorno(alheio, "eu").liberados).toEqual([]);
  });
  it("bloqueados por mês fechado: informa quais e o motivo, e estorna os demais", () => {
    const ctx: ContextoTrava = { estado: { mesInicial: "2026-09", fechados: new Set(["2026-09"]) }, porPessoa: new Map([["eu", new Set(["2026-09"])]]), hoje: "2026-11-06", meuId: "eu", nomes: new Map([["eu", "Eu"]]) };
    const itens = [item("g1", "gisa", 100), item("g9", "gisa", 40, { repasse_mes: "2026-09" })];
    const brutos = new Map(itens.map((i) => [String(i.id), i]));
    const p = planoDeEstorno(lanc(itens), "eu", (l) => verificarAlteracao({ tipo: "estornar", itens: [brutos.get(l.id) as never] }, ctx));
    expect(p.liberados.map((l) => l.id)).toEqual(["g1"]);
    expect(p.bloqueados.map((b) => b.item.id)).toEqual(["g9"]);
    expect(p.bloqueados[0].motivo).toMatch(/mês fechado/);
    expect(p.total).toBe(100);
  });
  it("confirmação repetida de repasse concluído é recusada (não reaplica data nem competência)", () => {
    expect(repasseValidoParaAcao(lista[0], "concluir", "eu")).toBe(false);
    expect(repasseValidoParaAcao(lista[2], "concluir", "eu")).toBe(true);
  });
});

describe("o estorno desfaz exatamente o efeito da confirmação", () => {
  const medir = (itens: Item[], mes: string) => {
    const todos = { extrato: [salario, ...itens], cartao: [] as Item[], contas: [] as Item[] };
    const painel = calcularPainel({ extrato: todos.extrato.map((i) => marcarForaDaVisao(i, eu)), cartao: [], contas: [] }, { mes, meuId: "eu", dadosRepasses: todos, escopo: eu, mesCorteCaixa: MES_CORTE_CAIXA });
    return { painel, grupo: financeiroDoGrupo(painel, todos, "eu"), saldo: calcularSaldoConta(todos as never, CONTA, { userId: "eu", ateMes: mes }) };
  };
  const confirmados = [item("g1", "gisa", 100), item("g2", "gisa", 50), item("l1", "leo", 70)];
  const estornados = confirmados.map((i) => ({ ...i, ...pend, repasse_informado: false, repasse_informado_em: null }));
  const pendentes = confirmados.map((i) => ({ ...i, ...pend }));
  it("estorno em lote volta ao estado pendente (saldo da conta, grupo e Meu financeiro)", () => {
    for (const mes of [OUT, "2026-11"]) {
      const a = medir(estornados, mes), b = medir(pendentes, mes);
      expect(a.saldo).toEqual(b.saldo);
      expect(a.grupo).toEqual(b.grupo);
      expect(a.painel.totalDisponivel).toBe(b.painel.totalDisponivel);
    }
  });
  it("estorno individual de um repasse tira só o valor dele", () => {
    const um = [{ ...confirmados[0], ...pend }, confirmados[1], confirmados[2]];
    const m = medir(um, OUT);
    expect(m.grupo).toMatchObject({ utilizado: 220, recebido: 120, pendente: 100 });
    expect(m.saldo.repasses).toBe(120);
  });
  it("antes do estorno o valor entrou uma única vez", () => {
    const m = medir(confirmados, OUT);
    expect(m.saldo.repasses).toBe(220);
    expect(m.grupo).toMatchObject({ recebido: 220, pendente: 0 });
  });
});

describe("SQL da migração (verificação estática do texto; o comportamento real depende de rodar no banco)", () => {
  const sql = readFileSync("supabase/supabase-19-repasse-competencia.sql", "utf8");
  const corpo = (nome: string) => sql.slice(sql.indexOf(`function public.${nome}`));
  it("a coluna é criada nas três tabelas, com formato AAAA-MM e nula por padrão", () => {
    for (const t of ["extrato", "cartao", "contas_fixas"]) expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+add column if not exists repasse_mes text check`));
  });
  it("mes_em_aberto parte do mes_inicial da pessoa e avança pelos meses fechados dela", () => {
    const f = corpo("mes_em_aberto");
    expect(f).toContain("fechamento_controle");
    expect(f).toContain("public.mes_fechado(p_pessoa, m.mes)");
    expect(sql).toMatch(/revoke execute on function public\.mes_em_aberto\(uuid\) from public, anon, authenticated/);
  });
  it("concluir grava a competência do AUTOR e só atua em repasse ainda não confirmado; reabrir limpa", () => {
    const f = corpo("atualizar_repasse");
    expect(f).toMatch(/repasse_mes = public\.mes_em_aberto\(\$2\)[\s\S]*?owner_id = \$2[\s\S]*?coalesce\(repasse_pago, false\) = false/);
    expect(f).toMatch(/reabrir[\s\S]*?repasse_mes = null/);
    expect(f).toContain("security definer");
    expect(f).toContain("if v_uid is null then raise exception");
  });
  it("a trava usa a competência: a nova ao confirmar e a gravada (old) ao estornar", () => {
    const f = corpo("repasse_trava_mes_fechado");
    expect(f).toContain("coalesce(new.repasse_mes");
    expect(f).toContain("coalesce(old.repasse_mes");
  });
  it("a API não consegue mudar repasse_mes: o trigger preserva o valor e vale para as três tabelas", () => {
    const f = corpo("repasse_mes_protegido");
    expect(f).toContain("current_user not in ('anon', 'authenticated')");
    expect(f).toContain("new.repasse_mes := old.repasse_mes");
    expect(f).toContain("new.repasse_mes := null");
    for (const t of ["extrato", "cartao", "contas_fixas"]) expect(sql).toMatch(new RegExp(`trigger repasse_mes_protegido before insert or update on public\\.${t}`));
  });
  it("o script dos 19 valida quantidade e soma, aborta se divergir e só grava repasse_mes", () => {
    const b = readFileSync("supabase/supabase-20-repasse-competencia-19.sql", "utf8");
    expect(b).toContain("(n_ext + n_car + n_fix) <> 19");
    expect(b).toContain("<> 1861.11");
    expect(b).toContain("raise exception");
    expect(b.match(/set repasse_mes = '2026-10'/g)).toHaveLength(3);
    expect(b.match(/update public\.\w+ set /g)).toHaveLength(3); // todo UPDATE do script grava somente repasse_mes
    expect(b.match(/update public\.\w+ set repasse_mes = '2026-10' where/g)).toHaveLength(3);
    expect(b).toContain("6bea3ece-cb6e-4932-b0b6-3dd2b2c136e2");
  });
});
