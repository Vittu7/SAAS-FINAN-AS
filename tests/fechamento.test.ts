import { describe, it, expect } from "vitest";
import {
  bloqueioParaLancar,
  diferencasDoRetrato,
  mesDeTrabalho,
  mesTerminou,
  podeFechar,
  podeReabrir,
  statusDoMes,
  travaDoLancamento,
  travaDoEstorno,
  validarMotivo,
  verificarAlteracao,
  type EstadoFechamento,
} from "../src/lib/fechamento";

const HOJE = "2026-12-02";
const est = (fechados: string[], mesInicial: string | null = "2026-09"): EstadoFechamento => ({ mesInicial, fechados: new Set(fechados) });

describe("mês em aberto e status de cada mês", () => {
  it("o mês em aberto é o primeiro não fechado desde o início do controle", () => {
    expect(mesDeTrabalho(est(["2026-09", "2026-10"]))).toBe("2026-11");
    expect(mesDeTrabalho(est([]))).toBe("2026-09");
    expect(mesDeTrabalho(est([], null))).toBeNull();
  });
  it("histórico, fechado, aberto, em espera e previsão", () => {
    const e = est(["2026-09", "2026-10"]);
    expect(statusDoMes("2026-08", e, HOJE)).toBe("historico");
    expect(statusDoMes("2026-10", e, HOJE)).toBe("fechado");
    expect(statusDoMes("2026-11", e, HOJE)).toBe("aberto");
    expect(statusDoMes("2026-12", e, HOJE)).toBe("espera"); // já começou, mas novembro não foi fechado
    expect(statusDoMes("2027-01", e, HOJE)).toBe("previsao");
  });
  it("sem controle ativado, tudo funciona como hoje (histórico)", () => {
    expect(statusDoMes("2026-11", est([], null), HOJE)).toBe("historico");
    expect(bloqueioParaLancar("2026-11", est([], null), HOJE)).toBeNull();
  });
  it("um mês só termina depois do último dia (horário de Brasília vem de fora)", () => {
    expect(mesTerminou("2026-11", "2026-11-30")).toBe(false);
    expect(mesTerminou("2026-11", "2026-12-01")).toBe(true);
  });
});

describe("fechar e reabrir", () => {
  it("só fecha o mês em aberto, e só depois que ele terminou", () => {
    const e = est(["2026-09", "2026-10"]);
    expect(podeFechar("2026-11", e, HOJE)).toEqual({ ok: true });
    expect(podeFechar("2026-11", e, "2026-11-28").ok).toBe(false);
    expect(podeFechar("2026-12", e, "2027-01-05").ok).toBe(false); // novembro ainda aberto
    expect(podeFechar("2026-10", e, HOJE).ok).toBe(false); // já fechado
    expect(podeFechar("2026-08", e, HOJE).ok).toBe(false); // antes do início
  });
  it("só reabre o último mês fechado", () => {
    const e = est(["2026-09", "2026-10"]);
    expect(podeReabrir("2026-10", e).ok).toBe(true);
    expect(podeReabrir("2026-09", e).ok).toBe(false);
    expect(podeReabrir("2026-11", e).ok).toBe(false);
  });
  it("reabrir outubro deixa novembro e dezembro em espera", () => {
    const e = est(["2026-09"]); // outubro reaberto
    expect(mesDeTrabalho(e)).toBe("2026-10");
    expect(statusDoMes("2026-11", e, HOJE)).toBe("espera");
    expect(statusDoMes("2026-12", e, HOJE)).toBe("espera");
  });
  it("motivo da reabertura é obrigatório (10 letras ou mais)", () => {
    expect(validarMotivo("")).not.toBeNull();
    expect(validarMotivo("   curto  ")).not.toBeNull();
    expect(validarMotivo("Faltou lançar a conta de luz")).toBeNull();
  });
});

describe("bloqueio de alterações", () => {
  const porPessoa = new Map([["vitu", new Set(["2026-09", "2026-10"])], ["gisa", new Set(["2026-09"])]]);
  it("lançamento travado se quem lançou OU o responsável fechou o mês", () => {
    expect(travaDoLancamento({ mes: "2026-10", owner_id: "vitu", responsavel_id: "vitu" }, porPessoa).travado).toBe(true);
    // Gisa lançou para Vitu em outubro: Vitu fechou outubro, então Gisa também não altera
    expect(travaDoLancamento({ mes: "2026-10", owner_id: "gisa", responsavel_id: "vitu" }, porPessoa)).toEqual({ travado: true, quem: ["vitu"] });
    expect(travaDoLancamento({ mes: "2026-11", owner_id: "gisa", responsavel_id: "vitu" }, porPessoa).travado).toBe(false);
  });
  it("convidado não fecha mês: vale só o fechamento de quem lançou", () => {
    expect(travaDoLancamento({ mes: "2026-10", owner_id: "vitu", responsavel_id: "convidada" }, porPessoa).travado).toBe(true);
    expect(travaDoLancamento({ mes: "2026-10", owner_id: "gisa", responsavel_id: "convidada" }, porPessoa).travado).toBe(false);
  });
  it("mudar a data de um lançamento para dentro de um mês fechado também é bloqueado", () => {
    expect(travaDoLancamento({ mes: "2026-11", owner_id: "vitu", responsavel_id: "vitu" }, porPessoa, "2026-10").travado).toBe(true);
  });
  it("lançar: mês fechado e meses em espera não aceitam lançamento novo; histórico aceita", () => {
    const e = est(["2026-09", "2026-10"]);
    expect(bloqueioParaLancar("2026-10", e, HOJE)).toMatch(/fechado/);
    expect(bloqueioParaLancar("2026-12", e, HOJE)).toMatch(/novembro/i);
    expect(bloqueioParaLancar("2026-11", e, HOJE)).toBeNull();
    expect(bloqueioParaLancar("2026-08", e, HOJE)).toBeNull();
  });
  it("estorno de repasse confirmado em mês fechado é bloqueado (para qualquer um dos dois lados)", () => {
    const rep = { owner_id: "gisa", responsavel_id: "vitu", repasse_pago: true, repasse_pago_em: "2026-10-20T13:00:00Z" };
    expect(travaDoEstorno(rep, porPessoa).travado).toBe(true);
    expect(travaDoEstorno({ ...rep, repasse_pago_em: "2026-11-20T13:00:00Z" }, porPessoa).travado).toBe(false);
    expect(travaDoEstorno({ ...rep, repasse_pago: false }, porPessoa).travado).toBe(false);
  });
});

describe("retrato do fechamento", () => {
  it("aponta o que mudou desde o fechamento", () => {
    const r = { entrou: 100, saiu: 50, resultado: 50, disponivel: 900, contasPendentes: 0, receber: 0, repassar: 0, sobraPrevista: 900 };
    expect(diferencasDoRetrato(r, { ...r })).toEqual([]);
    expect(diferencasDoRetrato(r, { ...r, saiu: 60, resultado: 40 })).toEqual(["saiu", "resultado"]);
  });
});

describe("verificarAlteracao: todas as formas de mexer num mês fechado", () => {
  const ctx = {
    estado: est(["2026-09", "2026-10"]),
    porPessoa: new Map([["vitu", new Set(["2026-09", "2026-10"])], ["gisa", new Set(["2026-09", "2026-10", "2026-11"])]]),
    hoje: HOJE,
    meuId: "vitu",
    nomes: new Map([["vitu", "Vitu"], ["gisa", "Gisa"]]),
  };
  const meu = (mes: string, extra: any = {}) => ({ mes, owner_id: "vitu", responsavel_id: "vitu", ...extra });
  it("lançamento novo retroativo em mês fechado: bloqueado", () => {
    expect(verificarAlteracao({ tipo: "novo", mes: "2026-10" }, ctx)).toMatch(/fechado/);
    expect(verificarAlteracao({ tipo: "novo", mes: "2026-11" }, ctx)).toBeNull();
  });
  it("lançar para outra pessoa que já fechou o mês: bloqueado com o nome dela", () => {
    expect(verificarAlteracao({ tipo: "novo", mes: "2026-11", responsavelId: "gisa" }, ctx)).toMatch(/Gisa já fechou novembro/);
  });
  it("editar, mudar a data para um mês fechado, marcar como paga e excluir série", () => {
    expect(verificarAlteracao({ tipo: "editar", item: meu("2026-10") }, ctx)).toMatch(/fechado/);
    expect(verificarAlteracao({ tipo: "editar", item: meu("2026-11"), mesNovo: "2026-10" }, ctx)).toMatch(/fechado/);
    expect(verificarAlteracao({ tipo: "editar", item: meu("2026-11"), mesNovo: "2026-12" }, ctx)).toBeNull();
    expect(verificarAlteracao({ tipo: "pagar", item: meu("2026-10") }, ctx)).toMatch(/fechado/);
    expect(verificarAlteracao({ tipo: "remover", itens: [meu("2026-10"), meu("2026-11"), meu("2026-12")] }, ctx)).toMatch(/outubro/);
    expect(verificarAlteracao({ tipo: "remover", itens: [meu("2026-11"), meu("2026-12")] }, ctx)).toBeNull();
  });
  it("lançamento de Gisa em que Vitu é responsável, em mês que Vitu fechou: Gisa também não altera", () => {
    const ctxGisa = { ...ctx, meuId: "gisa", estado: est(["2026-09", "2026-10", "2026-11"]) };
    expect(verificarAlteracao({ tipo: "editar", item: { mes: "2026-10", owner_id: "gisa", responsavel_id: "vitu" } }, ctxGisa)).toMatch(/fechado/);
  });
  it("estornar repasse confirmado em mês fechado: bloqueado", () => {
    expect(verificarAlteracao({ tipo: "estornar", itens: [{ owner_id: "vitu", responsavel_id: "gisa", repasse_pago: true, repasse_pago_em: "2026-10-15T12:00:00Z" }] }, ctx)).toMatch(/mês fechado/);
    expect(verificarAlteracao({ tipo: "estornar", itens: [{ owner_id: "vitu", responsavel_id: "convidada", repasse_pago: true, repasse_pago_em: "2026-12-01T12:00:00Z" }] }, ctx)).toBeNull();
  });
  it("virada do mês usa o horário de Brasília (00:30 UTC de 1/11 ainda é outubro)", () => {
    expect(verificarAlteracao({ tipo: "estornar", itens: [{ owner_id: "vitu", responsavel_id: "x", repasse_pago: true, repasse_pago_em: "2026-11-01T00:30:00Z" }] }, ctx)).toMatch(/mês fechado/);
  });
});
