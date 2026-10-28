import { describe, it, expect } from "vitest";
import { contarLancamentosSemGrupo, oferecerInclusaoNoGrupo } from "../src/lib/lancamentosGrupo";

/** Banco falso: três tabelas com linhas {owner_id, grupo_id}. */
function criarBanco() {
  const tabelas: Record<string, any[]> = {
    extrato: [{ owner_id: "u1", grupo_id: null }, { owner_id: "u1", grupo_id: null }, { owner_id: "u2", grupo_id: null }],
    cartao: [{ owner_id: "u1", grupo_id: "g0" }],
    contas_fixas: [{ owner_id: "u1", grupo_id: null }],
  };
  const client: any = {
    from: (t: string) => {
      const q: any = { _f: [] as [string, any][], _upd: null as any, _head: false };
      q.select = (_c?: string, opts?: any) => ((q._head = !!opts?.head), q);
      q.update = (p: any) => ((q._upd = p), q);
      q.eq = (c: string, v: any) => (q._f.push([c, v]), q);
      q.is = (c: string, v: any) => (q._f.push([c, v]), q);
      q.then = (res: any) => {
        const alvo = tabelas[t].filter((l) => q._f.every(([c, v]: any) => l[c] === v));
        if (q._upd) alvo.forEach((l) => Object.assign(l, q._upd));
        res(q._head ? { count: alvo.length, error: null } : { data: alvo.map(() => ({ id: 1 })), error: null });
      };
      return q;
    },
  };
  return { client, tabelas };
}

describe("lançamentos sem grupo", () => {
  it("conta só os do usuário que estão sem grupo", async () => {
    const { client } = criarBanco();
    expect(await contarLancamentosSemGrupo(client, "u1")).toBe(3);
  });

  it("se a pessoa aceitar, inclui no grupo", async () => {
    const { client, tabelas } = criarBanco();
    const msg = await oferecerInclusaoNoGrupo(client, "u1", "g1", () => true);
    expect(msg).toContain("3 lançamento");
    expect(tabelas.extrato.filter((l) => l.owner_id === "u1").every((l) => l.grupo_id === "g1")).toBe(true);
    expect(tabelas.extrato.find((l) => l.owner_id === "u2")!.grupo_id).toBeNull();
    expect(tabelas.cartao[0].grupo_id).toBe("g0"); // já tinha grupo: não mexe
  });

  it("se a pessoa recusar, nada muda", async () => {
    const { client, tabelas } = criarBanco();
    const msg = await oferecerInclusaoNoGrupo(client, "u1", "g1", () => false);
    expect(msg).toContain("só seus");
    expect(tabelas.extrato.filter((l) => l.owner_id === "u1").every((l) => l.grupo_id === null)).toBe(true);
  });

  it("não pergunta quando não há lançamentos sem grupo", async () => {
    const { client } = criarBanco();
    let perguntou = false;
    expect(await oferecerInclusaoNoGrupo(client, "u3", "g1", () => ((perguntou = true), true))).toBeNull();
    expect(perguntou).toBe(false);
  });
});
