import { describe, it, expect } from "vitest";
import { calcularPainel } from "../src/lib/painel";
import { marcarForaDaVisao } from "../src/lib/grupo";

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

  it("Somente eu: adiantar sai do bolso e o repasse concluído vira entrada real e devolve o valor", () => {
    const antes = calcularPainel(somenteEu(compra()), { mes: "2026-10" });
    expect(antes).toMatchObject({ entradas: 1000, saidas: 0, resultadoMes: 1000, adiantado: 100, aReceber: 100, totalDisponivel: 900 });
    const pendente = calcularPainel(somenteEu(compra()), { mes: "2026-11" });
    expect(pendente).toMatchObject({ saldoAnterior: 900, totalDisponivel: 900, repassesRecebidos: 0, aReceber: 100 });
    const concluido = calcularPainel(somenteEu(compra(pago)), { mes: "2026-11" });
    expect(concluido).toMatchObject({ entradas: 100, resultadoMes: 100, repassesRecebidos: 100, aReceber: 0, saldoAnterior: 900, totalDisponivel: 1000 });
  });

  it("repasse concluído só conta a partir do mês da conclusão (outubro nunca é recalculado)", () => {
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

describe("painel: aportes em caixinhas", () => {
  const base = { extrato: [salario], cartao: [], contas: [] };
  it("aporte feito com o saldo da conta reduz o total disponível, sem virar despesa", () => {
    const sem = calcularPainel(base, { mes: "2026-10" });
    const com = calcularPainel(base, { mes: "2026-10", caixinhaMovs: [{ tipo: "aporte", valor: 300, conta: "Nubank", data: "2026-10-15" }] });
    expect(sem.totalDisponivel).toBe(1000);
    expect(com).toMatchObject({ totalDisponivel: 700, aportesCaixinha: 300, saidas: 0, resultadoMes: 1000, entradas: 1000 });
  });
  it("o efeito acumula nos meses seguintes e o resgate devolve", () => {
    const movs = [
      { tipo: "aporte", valor: 300, conta: "Nubank", data: "2026-10-15" },
      { tipo: "resgate", valor: 100, conta: "Nubank", data: "2026-11-03" },
    ];
    expect(calcularPainel(base, { mes: "2026-11", caixinhaMovs: movs })).toMatchObject({ saldoAnterior: 700, resgatesCaixinha: 100, totalDisponivel: 800 });
  });
  it("aporte sem conta (não usou o saldo) não altera o disponível; rendimento também não", () => {
    const movs = [
      { tipo: "aporte", valor: 300, conta: "", data: "2026-10-15" },
      { tipo: "rendimento", valor: 10, conta: "Nubank", data: "2026-10-20" },
    ];
    expect(calcularPainel(base, { mes: "2026-10", caixinhaMovs: movs }).totalDisponivel).toBe(1000);
  });
  it("repasse 'aguardando' sai de aReceber e vai para aReceberAguardando", () => {
    const e = { extrato: [salario], cartao: [{ ...compra({ repasse_informado: true }), foraDoMeuSaldo: true }], contas: [] };
    expect(calcularPainel(e, { mes: "2026-10" })).toMatchObject({ aReceber: 0, aReceberAguardando: 100 });
  });
});

describe("painel: visão individual de quem recebeu o repasse", () => {
  // Gisa lança uma compra de 100 para o Vitu; o Vitu repassa (concluído em novembro).
  const salGisa = { id: "sg", mes: "2026-10", tipo: "entrada", categoria: "Salário", valor: 1000, owner_id: "gisa", responsavel_id: "gisa" };
  const compraVitu = (extra: any = {}) => ({ id: "cv", mes: "2026-10", nome: "Mercado", cartao: "Inter", parcelaAtual: 1, parcelaTotal: 1, valor: 100, owner_id: "gisa", responsavel_id: "vitu", ...extra });
  const visaoGisa = (c: any) => {
    const escopo = new Set(["gisa"]);
    return { escopo, dados: { extrato: [salGisa], cartao: [marcarForaDaVisao(c, escopo)], contas: [] } };
  };

  it("marca como fora do saldo só quando o responsável não está na visão", () => {
    expect(marcarForaDaVisao(compraVitu(), new Set(["gisa"])).foraDoMeuSaldo).toBe(true);
    expect(marcarForaDaVisao(compraVitu(), new Set(["gisa", "vitu"])).foraDoMeuSaldo).toBeUndefined();
    expect(marcarForaDaVisao(compraVitu(), null).foraDoMeuSaldo).toBeUndefined();
  });

  it("repasse concluído soma (+) no Total Disponível de quem recebeu", () => {
    const pend = visaoGisa(compraVitu());
    expect(calcularPainel(pend.dados, { mes: "2026-11", escopo: pend.escopo })).toMatchObject({ saldoAnterior: 900, totalDisponivel: 900, repassesRecebidos: 0 });
    const ok = visaoGisa(compraVitu(pago));
    expect(calcularPainel(ok.dados, { mes: "2026-11", escopo: ok.escopo })).toMatchObject({ repassesRecebidos: 100, totalDisponivel: 1000 });
  });
});
