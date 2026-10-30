import { describe, it, expect } from "vitest";
import { situacaoDoRepasse, lancamentosDoGrupo, filtrarGrupo, FILTRO_GRUPO_INICIAL, resumoRepasses, resumoPorMembro, idsDaSelecao, filtrarGrupoPorPessoas } from "../src/lib/grupo";
import { calcularMes } from "../src/lib/calculos";

const REF = "2026-10";
const E: any = {
  extrato: [
    { id: "e1", owner_id: "vitu", responsavel_id: "gisa", mes: REF, descricao: "Mercado", valor: 120, categoria: "Mercado", pagamento: "Pix", autorNome: "Vitu", responsavel: "Gisa" },
    { id: "e2", owner_id: "vitu", responsavel_id: "vitu", mes: REF, descricao: "Gasolina", valor: 200 },
    { id: "e3", owner_id: "vitu", responsavel_id: "vitu", mes: REF, tipo: "entrada", descricao: "Salário", valor: 5000 },
    { id: "e4", owner_id: "vitu", responsavel_id: "gisa", mes: REF, tipo: "entrada", descricao: "x", valor: 1 },
  ],
  cartao: [
    { id: "c1", owner_id: "vitu", responsavel_id: "gisa", mes: REF, nome: "Ar-condicionado", descricao: "Ar-condicionado", cartao: "Nubank", parcela_atual: 1, parcela_total: 5, valor: 500, autorNome: "Vitu", responsavel: "Gisa" },
    { id: "c2", owner_id: "vitu", responsavel_id: "gisa", mes: "2026-11", nome: "Ar-condicionado", descricao: "Ar-condicionado", cartao: "Nubank", parcela_atual: 2, parcela_total: 5, valor: 500, autorNome: "Vitu", responsavel: "Gisa" },
    { id: "c3", owner_id: "gisa", responsavel_id: "vitu", mes: REF, nome: "Presente", cartao: "Itau", parcela_atual: 1, parcela_total: 1, valor: 90, autorNome: "Gisa", responsavel: "Vitu" },
  ],
  contas: [
    { id: "f1", owner_id: "vitu", responsavel_id: "gisa", mes: REF, nome: "Internet", pago: false, vencimento: 10, valor: 100, autorNome: "Vitu", responsavel: "Gisa", repasse_pago: true },
  ],
};

describe("lançamentos do grupo", () => {
  const lista = lancamentosDoGrupo(E, REF);
  it("reúne só o que foi lançado para outra pessoa, de todos os tipos, sem entradas", () => {
    expect(lista.map((l) => l.chave).sort()).toEqual(["cartao:c1", "cartao:c2", "cartao:c3", "contas:f1", "extrato:e1"]);
    expect(lista.find((l) => l.chave === "cartao:c1")).toMatchObject({ parcela: "1/5", tipoRotulo: "Parcelada", autorNome: "Vitu", respNome: "Gisa" });
    expect(lista.find((l) => l.chave === "contas:f1")).toMatchObject({ vencimento: 10, tipoRotulo: "Conta fixa", repassePago: true });
  });
  it("filtra por tipo, responsável, autor e situação", () => {
    const f = (p: any) => filtrarGrupo(lista, { ...FILTRO_GRUPO_INICIAL, ...p }).map((l) => l.chave).sort();
    expect(f({ tipo: "parcelada" })).toEqual(["cartao:c1", "cartao:c2", "cartao:c3"]);
    expect(f({ responsavelId: "vitu" })).toEqual(["cartao:c3"]);
    expect(f({ autorId: "gisa" })).toEqual(["cartao:c3"]);
    expect(f({ situacao: "repasse-concluido" })).toEqual(["contas:f1"]);
    expect(f({ situacao: "repasse-pendente" })).toEqual(["cartao:c1", "cartao:c2", "cartao:c3", "extrato:e1"]);
    expect(f({ situacao: "repasse-aguardando" })).toEqual([]);
    expect(f({ situacao: "conta-a-pagar" })).toEqual(["contas:f1"]);
  });
});

describe("valores a repassar", () => {
  it("o ar-condicionado de R$ 500 no Nubank aparece para a Gisa dever ao Vitu", () => {
    const lista = lancamentosDoGrupo(E, REF);
    const gisa = resumoRepasses(lista, "gisa");
    const vitu = resumoRepasses(lista, "vitu");
    expect(gisa.aRepassar.pessoas[0].nome).toBe("Vitu");
    expect(gisa.aRepassar.agora).toBe(620); // 120 + 500 (mês atual); a parcela de novembro é "a vencer"
    expect(gisa.aRepassar.aVencer).toBe(500);
    expect(gisa.aRepassar.recebido).toBe(100); // internet já repassada
    expect(vitu.aReceber.agora).toBe(620);
    expect(vitu.aRepassar.agora).toBe(0 + 90); // o Vitu deve R$ 90 à Gisa
  });
  it("marcar como recebido só muda o repasse: entradas, saídas e saldo não mudam", () => {
    const antes = calcularMes({ extrato: E.extrato.filter((i: any) => i.responsavel_id === "gisa"), cartao: E.cartao.filter((i: any) => i.responsavel_id === "gisa"), contas: E.contas }, { mes: REF });
    const pago = { ...E, cartao: E.cartao.map((c: any) => ({ ...c, repasse_pago: true })), extrato: E.extrato.map((c: any) => ({ ...c, repasse_pago: true })) };
    const depois = calcularMes({ extrato: pago.extrato.filter((i: any) => i.responsavel_id === "gisa"), cartao: pago.cartao.filter((i: any) => i.responsavel_id === "gisa"), contas: pago.contas }, { mes: REF });
    expect(depois).toEqual(antes);
    expect(resumoRepasses(lancamentosDoGrupo(pago, REF), "gisa").aRepassar.agora).toBe(0);
  });
  it("o gasto fica só com a responsável (nada em dobro no total do grupo)", () => {
    const grupo = calcularMes(E, { mes: REF });
    expect(grupo.saidas).toBe(120 + 200 + 500 + 90 + 100);
  });
});

describe("repasse em duas etapas", () => {
  it("pendente -> repassado (aguardando) -> concluído", () => {
    expect(situacaoDoRepasse(false, false)).toBe("pendente");
    expect(situacaoDoRepasse(false, true)).toBe("aguardando");
    expect(situacaoDoRepasse(true, true)).toBe("concluido");
    expect(situacaoDoRepasse(true, false)).toBe("concluido");
  });
  it("só é concluído depois da confirmação de quem recebeu: 'repassado' continua em aberto", () => {
    const informado = { ...E, cartao: E.cartao.map((c: any) => (c.id === "c1" ? { ...c, repasse_informado: true } : c)) };
    const lista = lancamentosDoGrupo(informado, REF);
    expect(lista.find((l) => l.chave === "cartao:c1")!.situacaoRepasse).toBe("aguardando");
    const gisa = resumoRepasses(lista, "gisa").aRepassar;
    const vitu = resumoRepasses(lista, "vitu").aReceber;
    expect(gisa.agora).toBe(620); // continua devendo até o Vitu confirmar
    expect(gisa.aguardando).toBe(500);
    expect(vitu.aguardando).toBe(500);
    expect(gisa.recebido).toBe(100); // só o que foi concluído
    const concluido = { ...E, cartao: E.cartao.map((c: any) => (c.id === "c1" ? { ...c, repasse_informado: true, repasse_pago: true } : c)) };
    const g2 = resumoRepasses(lancamentosDoGrupo(concluido, REF), "gisa").aRepassar;
    expect(g2.agora).toBe(120);
    expect(g2.aguardando).toBe(0);
    expect(g2.recebido).toBe(600);
  });
  it("informar e concluir não alteram entradas, saídas nem saldo", () => {
    const base = calcularMes(E, { mes: REF });
    const mexido = { ...E, cartao: E.cartao.map((c: any) => ({ ...c, repasse_informado: true, repasse_pago: true })) };
    expect(calcularMes(mexido, { mes: REF })).toEqual(base);
  });
});

describe("resumo por membro", () => {
  it("entradas, saídas, saldo e repasses de cada pessoa", () => {
    const r = resumoPorMembro(E, [{ id: "vitu" }, { id: "gisa" }], REF, { meuId: "vitu", mesRef: REF });
    const v = r.find((x) => x.id === "vitu")!;
    const g = r.find((x) => x.id === "gisa")!;
    expect(v).toMatchObject({ entradas: 5000, saidas: 290, saldo: 4710, aReceber: 620, aRepassar: 90 });
    expect(g).toMatchObject({ saidas: 720, aRepassar: 620, aReceber: 90 });
  });
  it("itens 'fora do meu saldo' não entram no cálculo pessoal", () => {
    const r = calcularMes({ extrato: [{ id: "x", mes: REF, valor: 80, foraDoMeuSaldo: true }, { id: "y", mes: REF, valor: 20 }] }, { mes: REF });
    expect(r.saidas).toBe(20);
  });
});

describe("filtro global de responsáveis no módulo Grupo", () => {
  const lista = lancamentosDoGrupo(E, REF);
  const membros = [{ id: "vitu", nome: "Vitu" }, { id: "gisa", nome: "Gisa" }, { id: "ana", nome: "Ana" }];
  const chaves = (ids: Set<string> | null) => filtrarGrupoPorPessoas(lista, ids).map((l) => l.chave).sort();

  it("lista vazia = todo o grupo (sem filtro)", () => {
    expect(idsDaSelecao([], membros, "vitu", "__EU__")).toBeNull();
    expect(chaves(null)).toHaveLength(lista.length);
  });
  it("converte 'somente eu' e nomes em ids", () => {
    expect([...idsDaSelecao(["__EU__", "Gisa"], membros, "vitu", "__EU__")!].sort()).toEqual(["gisa", "vitu"]);
  });
  it("mantém o que tem a pessoa como responsável ou autor", () => {
    expect(chaves(idsDaSelecao(["Gisa"], membros, "vitu", "__EU__"))).toEqual(["cartao:c1", "cartao:c2", "cartao:c3", "contas:f1", "extrato:e1"]);
    expect(chaves(idsDaSelecao(["Ana"], membros, "vitu", "__EU__"))).toEqual([]);
  });
});
