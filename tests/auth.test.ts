import { describe, it, expect, beforeEach } from "vitest";
import { traduzirErroAuth, erroDaUrl, limparContasLembradas } from "../src/lib/auth";

beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

describe("mensagens de erro (login só com Google)", () => {
  it("traduz os erros mais comuns", () => {
    expect(traduzirErroAuth({ message: "missing OAuth secret" })).toMatch(/Google ainda não está configurado/);
    expect(traduzirErroAuth({ message: "Unsupported provider: provider is not enabled" })).toMatch(/Google ainda não está configurado/);
    expect(traduzirErroAuth({ message: "Signups not allowed for this instance" })).toMatch(/cadastro está desativado/);
    expect(traduzirErroAuth({ message: "email rate limit exceeded" })).toMatch(/Muitas tentativas/);
    expect(traduzirErroAuth({ message: "Database error saving new user" })).toMatch(/erro no servidor/);
    expect(traduzirErroAuth({ message: "Failed to fetch" })).toMatch(/Sem conexão/);
  });
  it("não mostra mensagens de senha ou confirmação de e-mail", () => {
    expect(traduzirErroAuth({ message: "Invalid login credentials" })).toBe("Invalid login credentials");
  });
});

describe("erro devolvido na URL após voltar do Google", () => {
  it("lê o erro da query string", () => {
    expect(erroDaUrl("?error=access_denied&error_description=User+denied", "")).toMatch(/cancelado|denied/i);
  });
  it("lê o erro do fragmento (#)", () => {
    expect(erroDaUrl("", "#error=server_error&error_description=Database+error+saving+new+user")).toMatch(/erro no servidor/);
  });
  it("sem erro devolve null", () => {
    expect(erroDaUrl("", "")).toBeNull();
    expect(erroDaUrl("?foo=1", "#access_token=abc")).toBeNull();
  });
});

describe("limpeza do login antigo", () => {
  it("apaga a lista de contas lembradas (e-mails guardados no aparelho)", () => {
    localStorage.setItem("hc:contas-lembradas", JSON.stringify([{ email: "a@b.com", nome: "A", avatar: null }]));
    limparContasLembradas();
    expect(localStorage.getItem("hc:contas-lembradas")).toBeNull();
  });
});
