import { describe, it, expect, beforeEach } from "vitest";
import { validarSenha, traduzirErroAuth, interpretarCadastro, lembrarConta, contasLembradas, esquecerConta, SENHA_MIN, emailValido } from "../src/lib/auth";

beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    dump: () => [...mem.values()].join("|"),
  };
});

describe("senha", () => {
  it("exige no mínimo 6 caracteres", () => {
    expect(SENHA_MIN).toBe(6);
    expect(validarSenha("12345")).toMatch(/pelo menos 6 caracteres/);
    expect(validarSenha("")).not.toBeNull();
    expect(validarSenha("123456")).toBeNull();
    expect(validarSenha("uma senha bem maior")).toBeNull();
  });
});

describe("mensagens de erro", () => {
  it("traduz os erros mais comuns", () => {
    expect(traduzirErroAuth(new Error("Invalid login credentials"))).toBe("E-mail ou senha incorretos.");
    expect(traduzirErroAuth({ message: "Email not confirmed" })).toMatch(/não foi confirmado/);
    expect(traduzirErroAuth({ message: "User already registered" })).toMatch(/já está cadastrado/);
    expect(traduzirErroAuth({ message: "Password should be at least 6 characters" })).toMatch(/pelo menos 6/);
    expect(traduzirErroAuth({ message: "email rate limit exceeded" })).toMatch(/Muitas tentativas/);
    expect(traduzirErroAuth({ message: "Error sending confirmation email" })).toMatch(/enviar o e-mail/);
    expect(traduzirErroAuth({ message: "Database error saving new user" })).toMatch(/erro no servidor/);
  });
  it("valida e-mail", () => {
    expect(emailValido("a@b.co")).toBe(true);
    expect(emailValido("a@b")).toBe(false);
  });
});

describe("resposta do cadastro", () => {
  it("sem sessão = precisa confirmar o e-mail", () => {
    expect(interpretarCadastro({ user: { identities: [{}] }, session: null })).toBe("confirmar-email");
  });
  it("com sessão = já entrou (confirmação desativada no servidor)", () => {
    expect(interpretarCadastro({ user: { identities: [{}] }, session: {} })).toBe("logado");
  });
  it("e-mail já existente é detectado", () => {
    expect(interpretarCadastro({ user: { identities: [] }, session: null })).toBe("ja-cadastrado");
  });
});

describe("contas lembradas neste aparelho", () => {
  it("guarda só e-mail, nome e foto — nunca senha", () => {
    lembrarConta({ email: "Ana@Mail.com", nome: "Ana", avatar: "http://x/a.jpg", senha: "segredo123", password: "segredo123" } as any);
    const salvo = (localStorage as any).dump();
    expect(salvo).not.toContain("segredo123");
    expect(contasLembradas()).toEqual([{ email: "ana@mail.com", nome: "Ana", avatar: "http://x/a.jpg" }]);
  });
  it("não duplica, limita e permite remover", () => {
    for (let i = 0; i < 7; i++) lembrarConta({ email: `u${i}@x.com`, nome: `U${i}`, avatar: null });
    lembrarConta({ email: "u6@x.com", nome: "Novo nome", avatar: null });
    expect(contasLembradas()).toHaveLength(5);
    expect(contasLembradas()[0].nome).toBe("Novo nome");
    esquecerConta("U6@x.com");
    expect(contasLembradas().some((c) => c.email === "u6@x.com")).toBe(false);
  });
});
