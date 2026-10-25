import { describe, it, expect, beforeEach } from "vitest";
import { lerListaDoUsuario, salvarDoUsuario, lerDoUsuario } from "../src/lib/usuarioStorage";

beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as any).window = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

describe("armazenamento individual por usuário", () => {
  it("o histórico de um usuário não aparece para outro", () => {
    salvarDoUsuario("ana", "recentes", ["fatura", "graficos"]);
    expect(lerListaDoUsuario("ana", "recentes")).toEqual(["fatura", "graficos"]);
    expect(lerListaDoUsuario("bia", "recentes")).toEqual([]);
  });
  it("sem usuário logado não lê nem grava nada", () => {
    salvarDoUsuario(null, "recentes", ["fatura"]);
    expect(lerListaDoUsuario(null, "recentes")).toEqual([]);
  });
  it("orientações novas começam do zero e preservam padrões", () => {
    const padrao = { boasVindas: false, guiaOculto: false, dicas: [] as string[] };
    salvarDoUsuario("ana", "onboarding", { boasVindas: true });
    expect(lerDoUsuario("ana", "onboarding", padrao)).toEqual({ boasVindas: true, guiaOculto: false, dicas: [] });
    expect(lerDoUsuario("bia", "onboarding", padrao)).toEqual(padrao);
  });
});
