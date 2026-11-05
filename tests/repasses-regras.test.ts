import { describe, it, expect } from "vitest";
import { acoesDoRepasse, lancamentosDoGrupo, resumoRepasses } from "../src/lib/grupo";
import { calcularPainel } from "../src/lib/painel";
import { travadoPorRepasse } from "../src/lib/grupo";

const l = (situacaoRepasse: "pendente" | "aguardando" | "concluido") => ({ autorId: "vitu", respId: "gisa", situacaoRepasse });

describe("quem pode fazer o quê num repasse", () => {
  it("só o destinatário (quem pagou a despesa) confirma o recebimento", () => {
    expect(acoesDoRepasse(l("aguardando"), "vitu")).toEqual(["concluir"]);
    expect(acoesDoRepasse(l("aguardando"), "gisa")).not.toContain("concluir");
    expect(acoesDoRepasse(l("aguardando"), "outra")).toEqual([]);
  });
  it("quem deve informa e pode cancelar o aviso, mas nunca confirma", () => {
    expect(acoesDoRepasse(l("pendente"), "gisa")).toEqual(["informar"]);
    expect(acoesDoRepasse(l("aguardando"), "gisa")).toEqual(["desinformar"]);
    expect(acoesDoRepasse(l("concluido"), "gisa")).toEqual([]);
  });
  it("repasse confirmado não pode ser confirmado de novo: só estornado por quem recebeu", () => {
    expect(acoesDoRepasse(l("concluido"), "vitu")).toEqual(["reabrir"]);
    expect(acoesDoRepasse(l("concluido"), "vitu")).not.toContain("concluir");
  });
  it("convidado não usa o app: quem recebeu registra direto do pendente", () => {
    expect(acoesDoRepasse({ autorId: "vitu", respId: "convidada", situacaoRepasse: "pendente" }, "vitu")).toEqual(["concluir"]);
  });
});

describe("repasses envolvendo convidados", () => {
  const sal = { id: "s", mes: "2026-10", tipo: "entrada", valor: 1000, owner_id: "vitu", responsavel_id: "vitu" };
  const remedio = (extra: any = {}) => ({ id: "r", mes: "2026-10", descricao: "Remédios", pagamento: "Pix", valor: 150, owner_id: "vitu", responsavel_id: "lurdes", responsavel: "Vó Lurdes", ...extra });
  it("o convidado deve, mas não tem saldo próprio: nada é descontado dele", () => {
    const lista = lancamentosDoGrupo({ extrato: [remedio()], cartao: [], contas: [] }, "2026-11");
    const r = resumoRepasses(lista, "vitu");
    expect(r.aReceber.agora).toBe(150);
    // visão só do convidado: não há saldo (sem entradas nem contas dele)
    const p = calcularPainel({ extrato: [remedio()], cartao: [], contas: [] }, { mes: "2026-10", escopo: new Set(["lurdes"]) });
    expect(p.repassesEnviados).toBe(0);
  });
  it("registrar o recebimento do convidado entra só no saldo de quem recebeu, uma vez", () => {
    const pago = remedio({ repasse_pago: true, repasse_pago_em: "2026-10-20T12:00:00Z", foraDoMeuSaldo: true });
    const antes = calcularPainel({ extrato: [sal, { ...remedio(), foraDoMeuSaldo: true }], cartao: [], contas: [] }, { mes: "2026-10", escopo: new Set(["vitu"]) });
    const depois = calcularPainel({ extrato: [sal, pago], cartao: [], contas: [] }, { mes: "2026-10", escopo: new Set(["vitu"]) });
    expect(antes.totalDisponivel).toBe(850);
    expect(depois.totalDisponivel).toBe(1000);
    expect(depois.entradasRenda).toBe(1000); // repasse não vira renda
  });
});

describe("despesa com repasse confirmado fica travada até o estorno", () => {
  it("trava edição/exclusão (a mesma regra está no banco, migração 14)", () => {
    expect(travadoPorRepasse([{ id: "1", repasse_pago: true }], ["1"])).toBe(true);
    expect(travadoPorRepasse([{ id: "1", repasse_pago: false }], ["1"])).toBe(false);
  });
});
