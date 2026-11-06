import { describe, it, expect } from "vitest";
import { ehTravaDeRepasse, montarOrientacaoRepasse } from "../src/lib/repasseTravado";

const extrato = [
  { id: "e1", owner_id: "vitu", responsavel_id: "gisa", mes: "2026-10", descricao: "Mercado", valor: 120, autorNome: "Vitu", responsavel: "Gisa", repasse_pago: true, repasse_pago_em: "2026-10-20T12:00:00Z" },
  { id: "e2", owner_id: "vitu", responsavel_id: "gisa", mes: "2026-10", descricao: "Padaria", valor: 20, autorNome: "Vitu", responsavel: "Gisa", repasse_pago: false },
  { id: "e3", owner_id: "vitu", responsavel_id: "vitu", mes: "2026-10", descricao: "Gasolina", valor: 200, repasse_pago: true },
];

describe("orientação de repasse confirmado", () => {
  it("reconhece a mensagem da trava do banco", () => {
    expect(ehTravaDeRepasse({ message: "Este lançamento tem repasse confirmado. Estorne o repasse antes de editar." })).toBe(true);
    expect(ehTravaDeRepasse({ message: "outra coisa" })).toBe(false);
    expect(ehTravaDeRepasse(null)).toBe(false);
  });

  it("identifica quem repassou, quem recebeu, valor e mês do repasse confirmado", () => {
    const o = montarOrientacaoRepasse("extrato", extrato, ["e1"], "excluir");
    expect(o.acao).toBe("excluir");
    expect(o.repasses).toHaveLength(1);
    expect(o.repasses[0]).toMatchObject({ id: "e1", descricao: "Mercado", valor: 120, mes: "2026-10", autorId: "vitu", autorNome: "Vitu", respId: "gisa", respNome: "Gisa", repassePago: true });
    expect(o.outrosDaSerie).toBe(0);
  });

  it("não inventa dados: sem repasse entre pessoas, a orientação vem sem detalhes", () => {
    const o = montarOrientacaoRepasse("extrato", extrato, ["e3"], "editar");
    expect(o.repasses).toEqual([]);
  });

  it("ignora lançamentos sem repasse confirmado", () => {
    expect(montarOrientacaoRepasse("extrato", extrato, ["e2"], "editar").repasses).toEqual([]);
  });

  it("série: mostra o lançamento clicado e conta os demais travados", () => {
    const contas = [
      { id: "f1", owner_id: "vitu", responsavel_id: "gisa", mes: "2026-09", nome: "Internet", valor: 100, autorNome: "Vitu", responsavel: "Gisa", repasse_pago: true },
      { id: "f2", owner_id: "vitu", responsavel_id: "gisa", mes: "2026-10", nome: "Internet", valor: 100, autorNome: "Vitu", responsavel: "Gisa", repasse_pago: true },
      { id: "f3", owner_id: "vitu", responsavel_id: "gisa", mes: "2026-11", nome: "Internet", valor: 100, autorNome: "Vitu", responsavel: "Gisa", repasse_pago: false },
    ];
    const o = montarOrientacaoRepasse("contas", contas, ["f2", "f1", "f3"], "excluir");
    expect(o.repasses[0].id).toBe("f2");
    expect(o.outrosDaSerie).toBe(1);
  });
});
