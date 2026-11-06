import { describe, it, expect } from "vitest";
import { calcularPainel, composicaoDoDisponivel } from "../src/lib/painel";
import { financeiroDoGrupo } from "../src/lib/financeiroGrupo";
import { aguardandoRepasseDoResponsavel, marcarForaDaVisao } from "../src/lib/grupo";
import { faturasEmAberto, MES_CORTE_CAIXA } from "../src/lib/pagamentoFatura";
import type { Estado } from "../src/lib/types";

type Item = Record<string, unknown>;

/**
 * Regra definitiva (diagnóstico aprovado):
 * - Meu disponível = minhas entradas − minhas despesas (competência). Crédito conta na compra; pagar fatura e repasse
 *   não mexem nele; repasse nunca é entrada nem despesa adicional.
 * - Despesa que outro lançou para mim só entra no meu financeiro quando o autor CONFIRMA o recebimento do repasse,
 *   no mês original da despesa.
 * - Grupo (de quem lançou) = meu disponível + repasses recebidos − utilizado pelos integrantes.
 * Cenário: lançamentos reais de outubro e novembro de 2026 (todos criados pelo Vitu).
 */
const V = "vitu", G = "gisa", M = "mae", D = "dimitrios";
const NOME: Record<string, string> = { [V]: "Vitu", [G]: "Gisa", [M]: "Mãe", [D]: "Dimitrios" };
const CONFIRMADO = { repasse_pago: true, repasse_pago_em: "2026-11-06T02:31:57Z" };
const OUT = "2026-10", NOV = "2026-11";

let seq = 0;
const base = (mes: string, resp: string, valor: number, conf: boolean) => ({
  id: `i${++seq}`, mes, valor, owner_id: V, responsavel_id: resp, responsavel: NOME[resp], autorNome: "Vitu", ...(conf ? CONFIRMADO : {}),
});
const ext = (mes: string, resp: string, valor: number, forma: string, conf = false) => ({ ...base(mes, resp, valor, conf), tipo: "saida", pagamento: forma, descricao: `gasto ${seq}` });
const entrada = (mes: string, valor: number) => ({ id: `i${++seq}`, mes, tipo: "entrada", categoria: "Salário", valor, owner_id: V, responsavel_id: V, responsavel: "Vitu", pagamento: "MERCADO PAGO Débito" });
const parc = (mes: string, resp: string, valor: number, cartao: string, atual: number, total: number, conf = false) => ({ ...base(mes, resp, valor, conf), cartao, nome: `parcela ${seq}`, parcelaAtual: atual, parcelaTotal: total });
const fixa = (mes: string, resp: string, valor: number, forma: string, pago: boolean, conf = false) => ({ ...base(mes, resp, valor, conf), nome: `fixa ${seq}`, formaPagamento: forma, pago, vencimento: 10 });

const N = "NUBANK", I = "ITAU", MP = "MERCADO PAGO", INT = "Inter";
const extrato = [
  entrada(OUT, 2159),
  // Dimitrios (confirmados)
  ext(OUT, D, 62.28, N, true), ext(OUT, D, 45, N, true), ext(OUT, D, 135, N, true), ext(OUT, D, 135.8, N, true), ext(OUT, D, 131, I, true),
  // Gisa (confirmados)
  ext(OUT, G, 69.3, I, true), ext(OUT, G, 44.98, I, true), ext(OUT, G, 31.2, N, true), ext(OUT, G, 5, N, true),
  // Mãe (confirmados)
  ext(OUT, M, 20, I, true), ext(OUT, M, 40.8, N, true),
  // Vitu (minhas, no crédito)
  ext(OUT, V, 100, N), ext(OUT, V, 47, N), ext(OUT, V, 42.6, N), ext(OUT, V, 130.2, N), ext(OUT, V, 9.9, MP), ext(OUT, V, 31.2, N), ext(OUT, V, 44.98, N),
  ext(OUT, V, 14.88, I), ext(OUT, V, 14, I), ext(OUT, V, 70, I), ext(OUT, V, 52, I), ext(OUT, V, 5, N), ext(OUT, V, 77, N), ext(OUT, V, 65, N),
  // Novembro
  entrada(NOV, 2159), ext(NOV, G, 250, MP), ext(NOV, G, 200, MP), ext(NOV, V, 250, MP), ext(NOV, V, 200, MP),
];
const cartao = [
  parc(OUT, G, 215, N, 4, 5, true), parc(OUT, G, 125, "DEBITO", 2, 4, true), parc(OUT, M, 436, MP, 3, 7, true), parc(OUT, V, 215, N, 4, 5), parc(OUT, V, 125, "DEBITO", 2, 4),
  parc(NOV, G, 215, N, 5, 5), parc(NOV, G, 125, "DEBITO", 3, 4), parc(NOV, M, 436, MP, 4, 7), parc(NOV, V, 125, "DEBITO", 3, 4), parc(NOV, V, 215, N, 5, 5),
];
const contas = [
  fixa(OUT, D, 13.25, N, true, true), fixa(OUT, G, 13.25, N, true, true), fixa(OUT, G, 300, "CAIXA Débito", true), fixa(OUT, G, 25, INT, true), fixa(OUT, M, 13.25, N, true),
  fixa(OUT, V, 13.25, N, true), fixa(OUT, V, 133, "DEBITO", true), fixa(OUT, V, 46, "MERCADO PAGO Débito", true), fixa(OUT, V, 110, "DEBITO", true), fixa(OUT, V, 300, "CAIXA Débito", true),
  fixa(NOV, D, 13.25, N, false), fixa(NOV, G, 13.25, N, false), fixa(NOV, G, 25, INT, false), fixa(NOV, G, 300, "CAIXA Débito", false), fixa(NOV, M, 13.25, N, false),
  fixa(NOV, V, 46, "MERCADO PAGO Débito", false), fixa(NOV, V, 133, "DEBITO", false), fixa(NOV, V, 300, "CAIXA Débito", false), fixa(NOV, V, 13.25, N, false), fixa(NOV, V, 110, "DEBITO", false),
];
const todos = { extrato, cartao, contas };
const CREDITO = [N, I, MP, INT];
const fatura = (cartaoNome: string, valor: number, data = "2026-11-06") => ({ id: `f-${cartaoNome}`, cartao: cartaoNome, mes: OUT, conta: "MERCADO PAGO Débito", valor, data });
const FATURAS = [fatura(INT, 25), fatura(I, 416.16), fatura(MP, 445.9), fatura(N, 1481.06)];

function visao(mes: string, pagamentos = FATURAS) {
  const escopo = new Set([V]);
  const f = (l: Item[]) => l.map((i) => marcarForaDaVisao(i, escopo));
  const dados = { extrato: f(extrato), cartao: f(cartao), contas: f(contas) };
  const painel = calcularPainel(dados, { mes, saldoInicial: 0, meuId: V, dadosRepasses: todos, escopo, cartoesCredito: CREDITO, pagamentosFatura: pagamentos, mesCorteCaixa: MES_CORTE_CAIXA });
  return { painel, grupo: financeiroDoGrupo(painel, todos, V) };
}

describe("meu financeiro: entradas − minhas despesas", () => {
  it("outubro = 2.159,00 − 1.646,01 = 512,99 (crédito conta na compra; adiantado e a receber ficam de fora)", () => {
    const { painel } = visao(OUT);
    expect(painel).toMatchObject({ entradasRenda: 2159, saidasRealizadas: 1646.01, resultadoRealizado: 512.99, totalDisponivel: 512.99 });
  });

  it("novembro acumula outubro: 512,99 + (2.159,00 − 1.392,25) = 1.279,74", () => {
    expect(visao(NOV).painel.totalDisponivel).toBe(1279.74);
  });

  it("pagar a fatura (em novembro, em outubro ou nunca) não muda o disponível nem desconta de novo", () => {
    for (const mes of [OUT, NOV]) {
      const semPagar = visao(mes, []).painel.totalDisponivel;
      const emNovembro = visao(mes).painel.totalDisponivel;
      const emOutubro = visao(mes, FATURAS.map((p) => ({ ...p, data: "2026-10-30" }))).painel.totalDisponivel;
      expect(emNovembro).toBe(semPagar);
      expect(emOutubro).toBe(semPagar);
    }
  });

  it("repasse confirmado não é entrada nem resultado", () => {
    const { painel } = visao(NOV);
    expect(painel.entradas).toBe(2159);
    expect(painel.resultadoMes).toBe(766.75);
    expect(painel.entradasPorOrigem.some((o) => o.rotulo === "Repasse recebido")).toBe(false);
  });

  it("a composição do disponível soma exatamente o total", () => {
    for (const mes of [OUT, NOV]) {
      const { painel } = visao(mes);
      expect(Math.round(composicaoDoDisponivel(painel, "mês anterior").reduce((t, l) => t + l.valor, 0) * 100) / 100).toBe(painel.totalDisponivel);
    }
  });
});

describe("despesas a pagar do meu financeiro", () => {
  const pagar = (mes: string, ateData: string, pagamentos = FATURAS) => {
    const l = faturasEmAberto(todos as unknown as Estado, CREDITO, pagamentos, [mes === OUT ? "2026-09" : OUT, mes], { meuId: V, ateData });
    return Math.round(l.reduce((t, f) => t + (f.restanteProprio ?? f.restante), 0) * 100) / 100;
  };
  it("outubro: só a minha parte das faturas (932,01), não os 2.368,12 da fatura inteira", () => {
    expect(pagar(OUT, "2026-10-31")).toBe(932.01);
    const inteira = faturasEmAberto(todos as unknown as Estado, CREDITO, FATURAS, ["2026-09", OUT], { meuId: V, ateData: "2026-10-31" }).reduce((t, f) => t + f.restante, 0);
    expect(Math.round(inteira * 100) / 100).toBe(2368.12);
  });
  it("depois de pagar, a parte minha some e o disponível continua o mesmo", () => {
    expect(pagar(NOV, "2026-11-30")).toBe(665); // só as faturas de novembro (215 Nubank + 450 Mercado Pago)
  });
  it("pagamento posterior ao mês visto não recalcula o mês anterior", () => {
    expect(pagar(OUT, "2026-10-31", FATURAS)).toBe(pagar(OUT, "2026-10-31", []));
  });
});

describe("financeiro do grupo: meu disponível + recebido − utilizado", () => {
  it("outubro: 512,99 + 0 − 1.861,11 = −1.348,12 (repasses só foram confirmados em novembro)", () => {
    const { grupo } = visao(OUT);
    expect(grupo).toMatchObject({ meuDisponivel: 512.99, utilizado: 1861.11, recebido: 0, pendente: 1861.11, disponivelGrupo: -1348.12 });
    const por = Object.fromEntries(grupo.membros.map((m) => [m.nome, m.utilizado]));
    expect(por).toEqual({ Gisa: 828.73, "Mãe": 510.05, Dimitrios: 522.33 });
  });

  it("novembro (acumulado): 1.279,74 + 1.522,86 − 3.451,86 = −649,26", () => {
    const { grupo } = visao(NOV);
    expect(grupo).toMatchObject({ meuDisponivel: 1279.74, utilizado: 3451.86, recebido: 1522.86, pendente: 1929, disponivelGrupo: -649.26, utilizadoNoMes: 1590.75, recebidoNoMes: 1522.86 });
    const por = Object.fromEntries(grupo.membros.map((m) => [m.nome, [m.utilizado, m.recebido, m.pendente]]));
    expect(por).toEqual({ Gisa: [1956.98, 503.73, 1453.25], "Mãe": [959.3, 496.8, 462.5], Dimitrios: [535.58, 522.33, 13.25] });
  });

  it("o meu financeiro não muda quando o grupo recebe repasse", () => {
    expect(visao(OUT).painel.totalDisponivel).toBe(512.99);
  });

  it("não inclui minhas despesas pessoais nem despesas de outros que eu não criei", () => {
    const alheio = { ...ext(OUT, G, 999, N), owner_id: D };
    const extra = { ...todos, extrato: [...extrato, alheio] };
    const { painel } = visao(OUT);
    expect(financeiroDoGrupo(painel, extra, V).utilizado).toBe(1861.11);
  });
});

describe("regra para qualquer integrante: o repasse concluído reconhece a despesa do responsável", () => {
  // Autor lança 100 em outubro com o responsável; o responsável tem salário de 1000 em outubro.
  const sal = (dono: string) => ({ id: `sal-${dono}`, mes: OUT, tipo: "entrada", categoria: "Salário", valor: 1000, owner_id: dono, responsavel_id: dono });
  const gasto = (autor: string, resp: string, extra: Item = {}) => ({ id: "g1", mes: OUT, tipo: "saida", pagamento: "Pix", descricao: "Mercado", valor: 100, owner_id: autor, responsavel_id: resp, responsavel: NOME[resp], autorNome: NOME[autor], ...extra });
  const pendente = {};
  const informado = { repasse_informado: true, repasse_informado_em: "2026-11-03T12:00:00Z" };
  const concluido = { repasse_pago: true, repasse_pago_em: "2026-11-05T12:00:00Z" };

  // Visão do responsável: o app esconde o que ainda não foi concluído (mesma função usada na tela e no painel)
  const meuFinanceiro = (eu: string, lancamento: Item, mes: string) => {
    const escopo = new Set([eu]);
    const visiveis = [sal(eu), lancamento].filter((i) => !aguardandoRepasseDoResponsavel(i, eu)).map((i) => marcarForaDaVisao(i, escopo));
    return calcularPainel({ extrato: visiveis, cartao: [], contas: [] }, { mes, meuId: eu, escopo, mesCorteCaixa: MES_CORTE_CAIXA, dadosRepasses: { extrato: [sal(eu), lancamento], cartao: [], contas: [] } }).totalDisponivel;
  };
  const grupoDoAutor = (autor: string, lancamento: Item, mes: string) => {
    const dados = { extrato: [sal(autor), lancamento], cartao: [], contas: [] };
    const escopo = new Set([autor]);
    const painel = calcularPainel({ extrato: [sal(autor), marcarForaDaVisao(lancamento, escopo)], cartao: [], contas: [] }, { mes, meuId: autor, escopo, mesCorteCaixa: MES_CORTE_CAIXA, dadosRepasses: dados });
    return financeiroDoGrupo(painel, dados, autor);
  };

  for (const [autor, resp] of [[V, G], [G, V], [D, M]] as const) {
    describe(`${NOME[autor]} lança para ${NOME[resp]}`, () => {
      it("pendente e informado: nada entra no financeiro do responsável; o utilizado já conta no grupo do autor", () => {
        for (const rep of [pendente, informado]) {
          const l = gasto(autor, resp, rep);
          expect(meuFinanceiro(resp, l, OUT)).toBe(1000);
          expect(meuFinanceiro(resp, l, NOV)).toBe(1000);
          expect(grupoDoAutor(autor, l, OUT)).toMatchObject({ meuDisponivel: 1000, utilizado: 100, recebido: 0, disponivelGrupo: 900 });
        }
      });

      it("concluído em novembro: a despesa entra em outubro (mês original) e o grupo do autor registra o recebimento", () => {
        const l = gasto(autor, resp, concluido);
        expect(meuFinanceiro(resp, l, OUT)).toBe(900);
        expect(meuFinanceiro(resp, l, NOV)).toBe(900);
        expect(grupoDoAutor(autor, l, OUT)).toMatchObject({ utilizado: 100, recebido: 0, pendente: 100, disponivelGrupo: 900 });
        expect(grupoDoAutor(autor, l, NOV)).toMatchObject({ utilizado: 100, recebido: 100, pendente: 0, disponivelGrupo: 1000 });
      });

      it("o autor não vê o lançamento no financeiro dele como despesa, nem o responsável no grupo dele", () => {
        const l = gasto(autor, resp, concluido);
        expect(meuFinanceiro(autor, l, OUT)).toBe(1000);
        const grupoResp = grupoDoAutor(resp, l, NOV);
        expect(grupoResp.utilizado).toBe(0);
      });

      it("estorno restaura a pendência sem duplicar", () => {
        const estornado = gasto(autor, resp, { repasse_pago: false, repasse_pago_em: null });
        expect(meuFinanceiro(resp, estornado, OUT)).toBe(1000);
        expect(grupoDoAutor(autor, estornado, NOV)).toMatchObject({ utilizado: 100, recebido: 0, pendente: 100 });
      });
    });
  }

  it("aguardandoRepasseDoResponsavel só vale para despesa de outro autor atribuída a mim e não concluída", () => {
    expect(aguardandoRepasseDoResponsavel(gasto(V, G), G)).toBe(true);
    expect(aguardandoRepasseDoResponsavel(gasto(V, G, concluido), G)).toBe(false);
    expect(aguardandoRepasseDoResponsavel(gasto(V, G), V)).toBe(false); // sou o autor
    expect(aguardandoRepasseDoResponsavel(gasto(V, V), V)).toBe(false); // despesa minha
    expect(aguardandoRepasseDoResponsavel({ ...gasto(V, G), tipo: "entrada" }, G)).toBe(false);
  });
});
