import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";

// Vitu recebe 1000 em outubro e paga no cartão dele uma compra de 100 da Gisa; a Gisa repassa em novembro.
const salario = { id: "s", mes: "2026-10", tipo: "entrada", categoria: "Salário", valor: 1000, owner_id: "vitu", responsavel_id: "vitu" };
const compra = (extra: any = {}) => ({ id: "c", mes: "2026-10", nome: "Tênis", cartao: "Nubank", parcelaAtual: 1, parcelaTotal: 1, valor: 100, owner_id: "vitu", responsavel_id: "gisa", ...extra });
const pago = { repasse_pago: true, repasse_pago_em: "2026-11-05T10:00:00Z" };

const todos = (c: any) => ({ extrato: [salario], cartao: [c], contas: [] });
const somenteEu = (c: any) => ({ extrato: [salario], cartao: [{ ...c, foraDoMeuSaldo: true }], contas: [] });
const soGisa = (c: any) => ({ extrato: [], cartao: [c], contas: [] });

describe("painel: resultado do mês x total disponível", () => {
  it("Todos: o repasse é transferência interna e não altera nada", () => {
    for (const c of [compra(), compra(pago)]) {
      const p = calcularPainel(todos(c), { mes: "2026-11" });
      expect(p.entradas).toBe(0);
      expect(p.repassesRecebidos).toBe(0);
      expect(p.saldoAnterior).toBe(900);
      expect(p.totalDisponivel).toBe(900);
    }
    const out = calcularPainel(todos(compra()), { mes: "2026-10" });
    expect(out).toMatchObject({ entradas: 1000, saidas: 100, resultadoMes: 900, totalDisponivel: 900 });
  });

  it("Somente eu: adiantar sai do bolso e o repasse concluído devolve, sem virar receita", () => {
    const antes = calcularPainel(somenteEu(compra()), { mes: "2026-10" });
    expect(antes).toMatchObject({ entradas: 1000, saidas: 0, resultadoMes: 1000, adiantado: 100, aReceber: 100, totalDisponivel: 900 });
    const pendente = calcularPainel(somenteEu(compra()), { mes: "2026-11" });
    expect(pendente).toMatchObject({ saldoAnterior: 900, totalDisponivel: 900, repassesRecebidos: 0, aReceber: 100 });
    const concluido = calcularPainel(somenteEu(compra(pago)), { mes: "2026-11" });
    expect(concluido).toMatchObject({ entradas: 0, resultadoMes: 0, repassesRecebidos: 100, aReceber: 0, saldoAnterior: 900, totalDisponivel: 1000 });
  });

  it("repasse concluído só conta a partir do mês da conclusão", () => {
    expect(calcularPainel(somenteEu(compra(pago)), { mes: "2026-10" }).totalDisponivel).toBe(900);
    expect(calcularPainel(somenteEu(compra(pago)), { mes: "2026-12" })).toMatchObject({ repassesRecebidos: 0, saldoAnterior: 1000, totalDisponivel: 1000 });
  });

  it("sem duplicidade: Somente eu + só Gisa = Todos", () => {
    for (const c of [compra(), compra(pago)]) {
      for (const mes of ["2026-10", "2026-11", "2026-12"]) {
        const eu = calcularPainel(somenteEu(c), { mes }).totalDisponivel;
        const gisa = calcularPainel(soGisa(c), { mes, escopo: new Set(["gisa"]) }).totalDisponivel;
        expect(eu + gisa).toBe(calcularPainel(todos(c), { mes }).totalDisponivel);
      }
    }
  });

  it("quem deve: a despesa fica no resultado e o dinheiro só sai quando o repasse é concluído", () => {
    const escopo = new Set(["gisa"]);
    expect(calcularPainel(soGisa(compra()), { mes: "2026-10", escopo })).toMatchObject({ saidas: 100, resultadoMes: -100, aRepassar: 100, totalDisponivel: 0 });
    expect(calcularPainel(soGisa(compra(pago)), { mes: "2026-11", escopo })).toMatchObject({ repassesEnviados: 100, aRepassar: 0, saldoAnterior: 0, totalDisponivel: -100 });
  });

  it("mês no vermelho com dinheiro acumulado: resultado negativo, total positivo", () => {
    const e = { extrato: [{ id: "x", mes: "2026-12", pagamento: "Pix", valor: 200, descricao: "Gasto" }], cartao: [], contas: [] };
    const p = calcularPainel(e, { mes: "2026-12", saldoInicial: 1000 });
    expect(p.resultadoMes).toBe(-200);
    expect(p.saldoAnterior).toBe(1000);
    expect(p.totalDisponivel).toBe(800);
  });

  it("o negativo de um mês passa para o seguinte (não é zerado)", () => {
    const e = { extrato: [{ id: "x", mes: "2026-10", valor: 300 }, { id: "y", mes: "2026-11", tipo: "entrada", categoria: "Extra", valor: 100 }], cartao: [], contas: [] };
    expect(calcularPainel(e, { mes: "2026-11" })).toMatchObject({ saldoAnterior: -300, totalDisponivel: -200 });
  });

  it("entradas discriminadas por origem e meses vazios entre os lançamentos", () => {
    const e = { extrato: [{ id: "a", mes: "2026-10", tipo: "entrada", categoria: "Salário", valor: 3000 }, { id: "b", mes: "2026-10", tipo: "entrada", categoria: "Extra", valor: 500 }], cartao: [], contas: [] };
    const p = calcularPainel(e, { mes: "2026-12" });
    expect(calcularPainel(e, { mes: "2026-10" }).entradasPorOrigem).toEqual([{ rotulo: "Salário", valor: 3000 }, { rotulo: "Extra", valor: 500 }]);
    expect(p).toMatchObject({ entradas: 0, saldoAnterior: 3500, totalDisponivel: 3500 });
  });
});
