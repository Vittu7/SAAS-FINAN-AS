import { describe, it, expect } from "vitest";
import { situacaoDoRepasse, lancamentosDoGrupo, filtrarGrupo, FILTRO_GRUPO_INICIAL, resumoRepasses, repassesDoMes, resumoPorMembro, idsDaSelecao, filtrarGrupoPorPessoas, entradasDeRepasse, saidasDeRepasse, marcarForaDaVisao, travadoPorRepasse } from "../src/lib/grupo";
import { calcularMes, repassesRecebidosNoMes, sobraDosMesesAnteriores } from "../src/lib/calculos";

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

describe("compra compartilhada: R$ 5.000 no meu cartão, R$ 2.500 meus e R$ 2.500 de X", () => {
  const compra = (pago: boolean) => ({
    extrato: [] as any[],
    contas: [] as any[],
    cartao: [
      { id: "a", owner_id: "eu", responsavel_id: "eu", responsavel: "Eu", mes: "2026-10", nome: "TV (1/2)", cartao: "Nubank", valor: 2500, parcela_atual: 1, parcela_total: 1 },
      {
        id: "b", owner_id: "eu", responsavel_id: "x", responsavel: "X", mes: "2026-10", nome: "TV (2/2)", cartao: "Nubank", valor: 2500, parcela_atual: 1, parcela_total: 1,
        ...(pago ? { repasse_pago: true, repasse_pago_em: "2026-10-20T10:00:00Z", repasse_conta: "Conta" } : {})
      },
    ],
  });
  // visão "somente eu": a parte de X fica fora do meu saldo, como a tela inicial faz
  const meuPainel = (e: any, extra: any[] = []) =>
    calcularMes({ extrato: extra, cartao: e.cartao.map((c: any) => (c.responsavel_id !== "eu" ? { ...c, foraDoMeuSaldo: true } : c)), contas: [] }, { mes: "2026-10" });
  // mesma marcação que a tela inicial faz (marcarForaDaVisao) para a visão escolhida
  const naVisao = (e: any, escopo: string[] | null) => ({
    ...e,
    cartao: e.cartao.map((c: any) => marcarForaDaVisao(c, escopo ? new Set(escopo) : null)),
  });

  it("o meu gasto pessoal é só R$ 2.500, mas a fatura do cartão continua com os R$ 5.000", () => {
    const e = compra(false);
    expect(meuPainel(e).saidas).toBe(2500);
    expect(e.cartao.reduce((t: number, c: any) => t + c.valor, 0)).toBe(5000);
  });
  it("ao confirmar o repasse: aparece no extrato, mas não duplica entradas nem saídas", () => {
    const e = compra(true);
    const linhas = entradasDeRepasse(naVisao(e, ["eu"]));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ valor: 2500, tipo: "entrada", mes: "2026-10", pagamento: "Conta", owner_id: "eu", foraDoMeuSaldo: true });
    const p = meuPainel(e, linhas);
    expect(p.entradas).toBe(0);
    expect(p.saidas).toBe(2500);
    expect(p.saldoRestante).toBe(-2500);
  });
  it("o a receber de X zera quando eu confirmo", () => {
    expect(resumoRepasses(lancamentosDoGrupo(compra(false), "2026-10"), "eu").aReceber.agora).toBe(2500);
    expect(resumoRepasses(lancamentosDoGrupo(compra(true), "2026-10"), "eu").aReceber.agora).toBe(0);
  });
  it("não gera linha se pendente, se X está na visão, em Todos ou se quem lançou está fora da visão", () => {
    expect(entradasDeRepasse(naVisao(compra(false), ["eu"]))).toEqual([]);
    expect(entradasDeRepasse(naVisao(compra(true), ["eu", "x"]))).toEqual([]);
    expect(entradasDeRepasse(naVisao(compra(true), null))).toEqual([]);
    expect(entradasDeRepasse(naVisao(compra(true), ["x"]))).toEqual([]);
  });
  it("visão de outra pessoa que lançou: a linha nasce para o autor selecionado", () => {
    const e = compra(true);
    e.cartao[1].owner_id = "maria"; // Maria lançou para X; a visão é só da Maria
    const linhas = entradasDeRepasse(naVisao(e, ["maria"]));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ owner_id: "maria", valor: 2500 });
  });
});
describe("repasse enviado (lado de quem paga)", () => {
  const item = (extra: any = {}) => ({ id: "b", owner_id: "autor", autorNome: "Autor", responsavel_id: "eu", responsavel: "Eu", mes: "2026-10", nome: "TV", cartao: "Nubank", valor: 100, parcelaAtual: 1, parcelaTotal: 1, ...extra });
  const pago = { repasse_pago: true, repasse_pago_em: "2026-10-20T10:00:00Z", repasse_conta_origem: "Conta Nubank" };
  const o = { meuId: "eu", incluiEu: true, nomesSelecionados: [] as string[] };
  it("concluído: gera saída que não duplica o resultado do mês", () => {
    const e = { cartao: [item(pago)] };
    const linhas = saidasDeRepasse(e, o);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ valor: 100, tipo: "saida", mes: "2026-10", pagamento: "Conta Nubank", foraDoMeuSaldo: true });
    expect(calcularMes({ extrato: linhas, cartao: e.cartao, contas: [] }, { mes: "2026-10" }).saidas).toBe(100);
  });
  it("pendente/aguardando, autor selecionado, fora da seleção ou não sou o responsável: sem linha", () => {
    expect(saidasDeRepasse({ cartao: [item()] }, o)).toEqual([]);
    expect(saidasDeRepasse({ cartao: [item({ repasse_informado: true })] }, o)).toEqual([]);
    expect(saidasDeRepasse({ cartao: [item(pago)] }, { ...o, nomesSelecionados: ["Autor"] })).toEqual([]);
    expect(saidasDeRepasse({ cartao: [item(pago)] }, { ...o, incluiEu: false })).toEqual([]);
    expect(saidasDeRepasse({ cartao: [item(pago)] }, { ...o, meuId: "autor" })).toEqual([]);
  });
});
describe("repasses recebidos no saldo restante (visão Todos)", () => {
  // Vitu lançou R$ 100 no cartão para Gisa; a despesa conta uma vez (é da Gisa) e o repasse quita esse gasto.
  const base = (extra: any = {}) => ({
    extrato: [{ id: "s", mes: "2026-10", tipo: "entrada", valor: 1000, owner_id: "vitu", responsavel_id: "vitu" }],
    cartao: [{ id: "c", mes: "2026-10", nome: "Tênis", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 100, owner_id: "vitu", responsavel_id: "gisa", ...extra }],
    contas: [],
  });
  const pago = { repasse_pago: true, repasse_pago_em: "2026-10-20T10:00:00Z", repasse_conta: "Débito" };

  it("repasse confirmado não é entrada externa, mas entra no saldo restante", () => {
    const rep = repassesRecebidosNoMes(base(pago), "2026-10", null);
    expect(rep).toBe(100);
    const r = calcularMes(base(pago), { mes: "2026-10", repassesRecebidos: rep });
    expect(r.entradas).toBe(1000); // só dinheiro externo
    expect(r.repassesRecebidos).toBe(100);
    expect(r.saldoRestante).toBe(1000 + 100 - 100);
  });
  it("sem confirmação não conta; sem a opção o cálculo antigo não muda", () => {
    expect(repassesRecebidosNoMes(base(), "2026-10", null)).toBe(0);
    expect(calcularMes(base(pago), { mes: "2026-10" }).saldoRestante).toBe(900);
  });
  it("não conta duas vezes (mesmo id repetido) e conta no mês da confirmação", () => {
    const dup = { ...base(pago), cartao: [...base(pago).cartao, { ...base(pago).cartao[0] }] };
    expect(repassesRecebidosNoMes(dup, "2026-10", null)).toBe(100);
    const depois = base({ ...pago, repasse_pago_em: "2026-11-02T10:00:00Z" });
    expect(repassesRecebidosNoMes(depois, "2026-10", null)).toBe(0);
    expect(repassesRecebidosNoMes(depois, "2026-11", null)).toBe(100);
  });
  it("Somente eu e itens fora do meu saldo ficam de fora", () => {
    expect(repassesRecebidosNoMes(base(pago), "2026-10", new Set(["vitu"]))).toBe(0);
    expect(repassesRecebidosNoMes(base(pago), "2026-10", new Set(["vitu", "gisa"]))).toBe(100);
    expect(repassesRecebidosNoMes(base({ ...pago, foraDoMeuSaldo: true }), "2026-10", null)).toBe(0);
  });
  it("repasse recebido depois da despesa vira sobra do mês seguinte", () => {
    const e = base({ ...pago, repasse_pago_em: "2026-10-28T10:00:00Z" });
    e.extrato = [] as any; // sem entrada: o mês fecha no vermelho (−100) e o repasse cobre
    expect(sobraDosMesesAnteriores(e, "2026-11")).toBe(0);
    expect(sobraDosMesesAnteriores(e, "2026-11", { escopo: null })).toBe(0);
    const comSobra = { ...base(pago), extrato: [{ id: "s", mes: "2026-10", tipo: "entrada", valor: 1000, owner_id: "vitu", responsavel_id: "vitu" }] };
    expect(sobraDosMesesAnteriores(comSobra, "2026-11", { escopo: null })).toBe(1000);
  });
});

describe("repasse 'Repassado' (aguardando) aparece no resumo", () => {
  const informado = { ...E, cartao: E.cartao.map((c: any) => (c.id === "c1" ? { ...c, repasse_informado: true } : c)) };
  it("sai do pendente e vai para 'aguardando' no resumo por membro", () => {
    const antes = resumoPorMembro(E, [{ id: "vitu" }, { id: "gisa" }], REF, { meuId: "vitu", mesRef: REF });
    const depois = resumoPorMembro(informado, [{ id: "vitu" }, { id: "gisa" }], REF, { meuId: "vitu", mesRef: REF });
    expect(antes.find((x) => x.id === "gisa")).toMatchObject({ aRepassar: 620, aRepassarAguardando: 0 });
    expect(depois.find((x) => x.id === "gisa")).toMatchObject({ aRepassar: 120, aRepassarAguardando: 500 });
    expect(depois.find((x) => x.id === "vitu")).toMatchObject({ aReceber: 120, aReceberAguardando: 500 });
  });
  it("resumoRepasses separa o que está aguardando confirmação", () => {
    const r = resumoRepasses(lancamentosDoGrupo(informado, REF), "gisa").aRepassar;
    expect(r.agora).toBe(620);
    expect(r.aguardandoAgora).toBe(500);
  });
  it("concluído deixa de contar como aguardando e como pendente", () => {
    const ok = { ...E, cartao: E.cartao.map((c: any) => (c.id === "c1" ? { ...c, repasse_informado: true, repasse_pago: true } : c)) };
    const g = resumoPorMembro(ok, [{ id: "gisa" }], REF, { meuId: "vitu", mesRef: REF })[0];
    expect(g).toMatchObject({ aRepassar: 120, aRepassarAguardando: 0 });
  });
});

describe("travadoPorRepasse (regra 3)", () => {
  const itens = [
    { id: 1, repassePago: true },
    { id: "2", repassePago: false },
    { id: "3", repasse_pago: true },
    { id: "4" },
  ];
  it("trava quando algum dos ids tem repasse confirmado (compara ids como texto)", () => {
    expect(travadoPorRepasse(itens, ["1"])).toBe(true);
    expect(travadoPorRepasse(itens, [3])).toBe(true);
    expect(travadoPorRepasse(itens, ["2", "4", "1"])).toBe(true);
  });
  it("não trava sem repasse confirmado", () => {
    expect(travadoPorRepasse(itens, ["2", "4"])).toBe(false);
    expect(travadoPorRepasse(itens, ["99"])).toBe(false);
    expect(travadoPorRepasse([], ["1"])).toBe(false);
  });
});

describe("repasses só do mês pedido", () => {
  const rep = (id: string, mes: string, extra: any = {}) => ({ id, owner_id: "vitu", responsavel_id: "gisa", mes, descricao: id, valor: 100, autorNome: "Vitu", responsavel: "Gisa", ...extra });
  const dados: any = {
    extrato: [rep("nov26", "2026-11"), rep("out26", "2026-10"), rep("nov25", "2025-11"), rep("dez26", "2026-12"), rep("out26-pago", "2026-10", { repasse_pago: true })],
    cartao: [],
    contas: [],
  };
  const lista = lancamentosDoGrupo(dados, "2026-11");

  it("novembro de 2026 não mistura com outubro, dezembro nem com novembro de 2025", () => {
    expect(repassesDoMes(lista, "2026-11").map((l) => l.id)).toEqual(["nov26"]);
    expect(repassesDoMes(lista, "2025-11").map((l) => l.id)).toEqual(["nov25"]);
  });
  it("os meses anteriores continuam disponíveis ao trocar o mês, com o repasse concluído incluído", () => {
    expect(repassesDoMes(lista, "2026-10").map((l) => l.id).sort()).toEqual(["out26", "out26-pago"]);
  });
  it("o resumo do mês só soma o que é do mês", () => {
    const r = resumoRepasses(repassesDoMes(lista, "2026-11"), "vitu");
    expect(r.aReceber.agora + r.aReceber.aVencer).toBe(100);
    expect(r.aReceber.recebido).toBe(0);
  });
  it("o resumo por membro ignora repasses em aberto de outros meses", () => {
    const r = resumoPorMembro(dados, [{ id: "vitu" }, { id: "gisa" }], "2026-11", { meuId: "vitu", mesRef: "2026-11" });
    expect(r.find((x) => x.id === "vitu")!.aReceber).toBe(100);
    expect(r.find((x) => x.id === "gisa")!.aRepassar).toBe(100);
  });
});
