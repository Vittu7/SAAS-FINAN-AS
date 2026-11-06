import { describe, it, expect } from "vitest";
import { ehBloqueioPorLancamentos, lancamentosDosConvidados, ABA_DO_LANCAMENTO } from "../src/lib/bloqueioExclusao";

const DADOS = {
  extrato: [
    { id: "e1", responsavel_id: "teste", mes: "2026-11", descricao: "Açaí", valor: 100, categoria: "Alimentação", data: "2026-11-04" },
    { id: "e2", responsavel_id: "vitu", mes: "2026-11", descricao: "Gasolina", valor: 200 },
    { id: "e3", responsavel_id: "teste", mes: "2026-11", descricao: "Repasse", valor: 5, repasseSintetico: true },
  ],
  cartao: [{ id: "c1", responsavel_id: "mae", mes: "2026-10", nome: "TV", cartao: "Nubank", valor: 300 }],
  contas: [
    { id: "f1", responsavel_id: "mae", mes: "2026-11", nome: "Internet", vencimento: 10, valor: 99.9 },
    { id: "f2", responsavel_id: "mae", mes: "2026-09", nome: "Luz", vencimento: 5, valor: 80 },
  ],
};
const CONVIDADOS = [{ id: "teste", nome: "Teste" }, { id: "mae", nome: "Mãe" }, { id: "gsa", nome: "GSA" }];

describe("bloqueio de exclusão por lançamentos", () => {
  it("reconhece a mensagem da trava e da pré-validação, e só ela", () => {
    expect(ehBloqueioPorLancamentos({ code: "P0001", message: 'O convidado "Teste" ainda é o responsável por 1 lançamento(s).' })).toBe(true);
    expect(ehBloqueioPorLancamentos({ code: "P0001", message: "Não é possível excluir o grupo. Convidados com lançamentos vinculados: ..." })).toBe(true);
    expect(ehBloqueioPorLancamentos({ code: "P0001", message: "Só o gestor do grupo pode excluir o grupo." })).toBe(false);
    expect(ehBloqueioPorLancamentos({ code: "23502", message: "convidado lançamento" })).toBe(false);
    expect(ehBloqueioPorLancamentos(null)).toBe(false);
  });

  it("agrupa por convidado, ignora quem não tem lançamento e linhas sintéticas", () => {
    const g = lancamentosDosConvidados(DADOS, CONVIDADOS);
    expect(g.map((x) => x.convidado.id)).toEqual(["teste", "mae"]);
    expect(g[0].lancamentos).toHaveLength(1);
    expect(g[0].lancamentos[0]).toMatchObject({ tabela: "extrato", id: "e1", descricao: "Açaí", valor: 100, categoria: "Alimentação", data: "2026-11-04" });
    expect(g[1].lancamentos.map((l) => l.id)).toEqual(["f1", "c1", "f2"]); // mais recente primeiro
  });

  it("cada tipo aponta para a aba certa", () => {
    expect(ABA_DO_LANCAMENTO).toEqual({ extrato: "lancamentos", cartao: "cartao", contas: "contas" });
  });
});
