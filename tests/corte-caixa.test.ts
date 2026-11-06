import { describe, it, expect } from "vitest";
import { calcularPainel, composicaoDoDisponivel } from "../src/lib/painel";
import { marcarForaDaVisao } from "../src/lib/grupo";
import { MES_CORTE_CAIXA, type PagamentoFatura } from "../src/lib/pagamentoFatura";

/**
 * Fronteira do MES_CORTE_CAIXA (2026-10): lançamentos de meses ANTERIORES ao corte seguem a regra antiga mesmo quando o
 * repasse (ou o estorno) acontece depois do corte. A regra de competência vale só para lançamentos a partir do corte.
 */
type Item = Record<string, unknown>;
const SET = "2026-09", OUT = "2026-10", NOV = "2026-11", DEZ = "2026-12";
const MESES = [SET, OUT, NOV, DEZ];
const eu = new Set(["eu"]);

const salario = (mes: string): Item => ({ id: `sal-${mes}`, mes, tipo: "entrada", categoria: "Salário", valor: 1000, owner_id: "eu", responsavel_id: "eu" });
/** Eu lancei e a Gisa é a responsável (adiantado). */
const adiantei = (mes: string, extra: Item = {}): Item => ({ id: `adi-${mes}`, mes, tipo: "saida", valor: 100, pagamento: "Pix", descricao: "Gisa", owner_id: "eu", responsavel_id: "gisa", responsavel: "Gisa", ...extra });
/** A Gisa lançou e eu sou o responsável (devo). */
const devo = (mes: string, extra: Item = {}): Item => ({ id: `devo-${mes}`, mes, tipo: "saida", valor: 100, pagamento: "Pix", descricao: "Minha parte", owner_id: "gisa", responsavel_id: "eu", responsavel: "Eu", ...extra });
const concluidoEm = (data: string): Item => ({ repasse_pago: true, repasse_pago_em: `${data}T12:00:00Z` });

function serie(itens: Item[], corte: string | null, opts: { pagamentos?: PagamentoFatura[]; cartoes?: string[]; meses?: string[] } = {}) {
  const dados = { extrato: itens.map((i) => marcarForaDaVisao(i, eu)), cartao: [] as Item[], contas: [] as Item[] };
  return (opts.meses ?? MESES).map((mes) =>
    calcularPainel(dados, { mes, meuId: "eu", escopo: eu, dadosRepasses: { extrato: itens, cartao: [], contas: [] }, cartoesCredito: opts.cartoes ?? [], pagamentosFatura: opts.pagamentos ?? [], mesCorteCaixa: corte }),
  );
}
const totais = (p: ReturnType<typeof serie>) => p.map((x) => x.totalDisponivel);

describe("corte: adiantamento em setembro e devolução em novembro", () => {
  const itens = [salario(SET), adiantei(SET, concluidoEm("2026-11-05"))];
  it("a devolução volta ao disponível em novembro, como na regra antiga", () => {
    expect(totais(serie(itens, null))).toEqual([900, 900, 1000, 1000]);
    expect(totais(serie(itens, MES_CORTE_CAIXA))).toEqual([900, 900, 1000, 1000]);
  });
  it("o acerto aparece separado e a composição continua somando o total", () => {
    const p = serie(itens, MES_CORTE_CAIXA);
    expect(p[2].acertosAnterioresAoCorte).toBe(100);
    expect(p[1].acertosAnterioresAoCorte).toBe(0);
    for (const x of p) {
      expect(Math.round(composicaoDoDisponivel(x, "anterior").reduce((t, l) => t + l.valor, 0) * 100) / 100).toBe(x.totalDisponivel);
      // regra nova: sobra = total + faturasOutros; regra antiga (meses antes do corte): sobra = total + receber − repassar + faturasOutros
      const ident = x.regraCompetencia ? x.totalDisponivel + x.previsao.faturasOutros : x.totalDisponivel + x.previsao.receber - x.previsao.repassar + x.previsao.faturasOutros;
      expect(Math.round(ident * 100) / 100).toBe(x.sobraPrevista);
    }
  });
  it("repasse não vira renda no mês do recebimento", () => {
    const nov = serie(itens, MES_CORTE_CAIXA)[2];
    expect(nov.entradas).toBe(0);
    expect(nov.entradasPorOrigem.some((o) => o.rotulo === "Repasse recebido")).toBe(false);
  });
});

describe("corte: despesa de setembro (eu devo) e repasse em novembro", () => {
  const itens = [salario(SET), devo(SET, concluidoEm("2026-11-05"))];
  it("o dinheiro sai só quando o repasse é concluído, como na regra antiga", () => {
    expect(totais(serie(itens, null))).toEqual([1000, 1000, 900, 900]);
    expect(totais(serie(itens, MES_CORTE_CAIXA))).toEqual([1000, 1000, 900, 900]);
  });
  it("sem conclusão a despesa continua reservada (não some nem duplica)", () => {
    const pendente = [salario(SET), devo(SET)];
    expect(totais(serie(pendente, MES_CORTE_CAIXA))).toEqual(totais(serie(pendente, null)));
  });
});

describe("corte: estorno posterior ao corte", () => {
  it("estornar um acerto de setembro volta ao estado pendente da regra antiga", () => {
    const concluido = [salario(SET), adiantei(SET, concluidoEm("2026-11-05"))];
    const estornado = [salario(SET), adiantei(SET, { repasse_pago: false, repasse_pago_em: null })];
    expect(totais(serie(concluido, MES_CORTE_CAIXA))).toEqual([900, 900, 1000, 1000]);
    expect(totais(serie(estornado, MES_CORTE_CAIXA))).toEqual([900, 900, 900, 900]);
    expect(totais(serie(estornado, MES_CORTE_CAIXA))).toEqual(totais(serie(estornado, null)));
  });
  it("estornar o repasse de despesa que eu devo (setembro) devolve a reserva", () => {
    const concluido = [salario(SET), devo(SET, concluidoEm("2026-11-05"))];
    const estornado = [salario(SET), devo(SET, { repasse_pago: false, repasse_pago_em: null })];
    expect(totais(serie(concluido, MES_CORTE_CAIXA))[3]).toBe(900);
    expect(totais(serie(estornado, MES_CORTE_CAIXA))).toEqual([1000, 1000, 1000, 1000]);
  });
  it("estornar um acerto de outubro em diante não muda nada no meu disponível (regra nova)", () => {
    const concluido = [salario(OUT), adiantei(OUT, concluidoEm("2026-11-05"))];
    const estornado = [salario(OUT), adiantei(OUT, { repasse_pago: false, repasse_pago_em: null })];
    expect(totais(serie(concluido, MES_CORTE_CAIXA, { meses: [OUT, NOV, DEZ] }))).toEqual([1000, 1000, 1000]);
    expect(totais(serie(estornado, MES_CORTE_CAIXA, { meses: [OUT, NOV, DEZ] }))).toEqual([1000, 1000, 1000]);
  });
});

describe("corte: lançamentos a partir de outubro seguem a regra de competência", () => {
  const meses = [OUT, NOV, DEZ];
  it("adiantado para outro integrante e repasse recebido não mexem no meu disponível", () => {
    for (const rep of [{}, concluidoEm("2026-11-05")]) {
      expect(totais(serie([salario(OUT), adiantei(OUT, rep)], MES_CORTE_CAIXA, { meses }))).toEqual([1000, 1000, 1000]);
    }
  });
  it("despesa de outro lançada para mim só entra quando o repasse é concluído, no mês original", () => {
    expect(totais(serie([salario(OUT), devo(OUT)], MES_CORTE_CAIXA, { meses }))).toEqual([1000, 1000, 1000]);
    expect(totais(serie([salario(OUT), devo(OUT, concluidoEm("2026-11-05"))], MES_CORTE_CAIXA, { meses }))).toEqual([900, 900, 900]);
  });
  it("não há acerto de lançamento anterior ao corte", () => {
    const p = serie([salario(OUT), adiantei(OUT, concluidoEm("2026-11-05")), devo(OUT, concluidoEm("2026-11-05"))], MES_CORTE_CAIXA, { meses });
    expect(p.map((x) => x.acertosAnterioresAoCorte)).toEqual([0, 0, 0]);
  });
});

describe("corte: histórico preservado", () => {
  it("meses anteriores ao corte dão o mesmo resultado com ou sem corte", () => {
    const itens = [salario(SET), adiantei(SET, concluidoEm("2026-11-05")), devo(SET), { ...adiantei("2026-08"), id: "ago" }];
    const ate = serie(itens, MES_CORTE_CAIXA, { meses: ["2026-08", SET] });
    const sem = serie(itens, null, { meses: ["2026-08", SET] });
    expect(ate).toEqual(sem);
  });
  it("compra de terceiros no crédito de setembro, com a fatura paga depois do corte, segue a regra antiga", () => {
    const compra: Item = { id: "cc", mes: SET, tipo: "saida", valor: 100, pagamento: "Nubank", descricao: "Gisa no crédito", owner_id: "eu", responsavel_id: "gisa", responsavel: "Gisa" };
    const pagamentos: PagamentoFatura[] = [{ id: "f", cartao: "Nubank", mes: SET, conta: "Itaú Débito", valor: 100, data: "2026-11-10" }];
    const itens = [salario(SET), compra];
    const opts = { pagamentos, cartoes: ["Nubank"] };
    expect(totais(serie(itens, MES_CORTE_CAIXA, opts))).toEqual(totais(serie(itens, null, opts)));
    expect(totais(serie(itens, MES_CORTE_CAIXA, opts))).toEqual([1000, 1000, 900, 900]);
  });
  it("misturar lançamentos de antes e depois do corte soma cada um pela sua regra", () => {
    // setembro: adiantei 100 (devolvido em novembro); outubro: adiantei 50 (devolvido em novembro, não mexe)
    const itens = [salario(SET), salario(OUT), adiantei(SET, concluidoEm("2026-11-05")), adiantei(OUT, { id: "adi-out", valor: 50, ...concluidoEm("2026-11-05") })];
    expect(totais(serie(itens, MES_CORTE_CAIXA))).toEqual([900, 1900, 2000, 2000]);
  });
});
