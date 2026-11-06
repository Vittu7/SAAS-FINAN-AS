import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decidirTela, obterNivel, iniciarCadastroTotp, confirmarCadastro, verificarCodigo, listarFatores,
  mensagemMfa, codigoValido, type MfaApi,
} from "../src/lib/adminMfa";

const SEGREDO = "JBSWY3DPEHPK3PXP-segredo-unico";
const QR = "data:image/svg+xml;utf-8,<svg>qr-unico</svg>";
const CODIGO = "493021";

function api(over: Partial<MfaApi> = {}): MfaApi {
  return {
    enroll: vi.fn(async () => ({ data: { id: "fator-1", totp: { qr_code: QR, secret: SEGREDO, uri: "otpauth://x" } }, error: null })),
    challenge: vi.fn(async () => ({ data: { id: "desafio-1" }, error: null })),
    verify: vi.fn(async () => ({ data: {}, error: null })),
    listFactors: vi.fn(async () => ({
      data: { totp: [{ id: "fator-1", friendly_name: "A", factor_type: "totp", status: "verified", created_at: "2026-11-05T10:00:00Z" }], all: [] },
      error: null,
    })),
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null })),
    refreshSession: vi.fn(async () => ({ error: null })),
    ...over,
  } as MfaApi;
}

describe("decidirTela (§5.8 R9)", () => {
  it.each([
    ["aal1", "aal1", "cadastro"],
    ["aal1", "aal2", "verificacao"],
    ["aal2", "aal2", "liberado"],
    ["aal2", "aal1", "bloqueado"],
  ] as const)("%s/%s → %s", (atual, proximo, tela) => {
    expect(decidirTela(atual, proximo)).toBe(tela);
  });

  it("falha fechado com valores ausentes ou desconhecidos", () => {
    expect(decidirTela(null, null)).toBe("bloqueado");
    expect(decidirTela(undefined, "aal2")).toBe("bloqueado");
    expect(decidirTela("aal3", "aal3")).toBe("bloqueado");
  });
});

describe("obterNivel", () => {
  it("devolve o par atual/próximo e null em falha", async () => {
    expect(await obterNivel(api())).toEqual({ atual: "aal2", proximo: "aal2" });
    const erro = api({ getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: null, error: { message: "x" } })) });
    expect(await obterNivel(erro)).toBeNull();
    const lanca = api({ getAuthenticatorAssuranceLevel: vi.fn(async () => { throw new Error("off"); }) });
    expect(await obterNivel(lanca)).toBeNull();
  });
});

describe("cadastro do TOTP", () => {
  it("devolve id, horário, QR e segredo", async () => {
    const r = await iniciarCadastroTotp(api());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fatorId).toBe("fator-1");
      expect(r.qrDataUri).toBe(QR);
      expect(r.segredo).toBe(SEGREDO);
      expect(new Date(r.criadoEm).toString()).not.toBe("Invalid Date");
    }
  });

  it("usa um nome amigável único para não colidir com cadastro anterior", async () => {
    const a = api();
    await iniciarCadastroTotp(a);
    await iniciarCadastroTotp(a);
    const nomes = (a.enroll as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].friendlyName);
    expect(nomes[0]).toMatch(/^HomeCash Admin /);
    expect(new Set(nomes).size).toBe(2);
    expect((a.enroll as ReturnType<typeof vi.fn>).mock.calls[0][0].factorType).toBe("totp");
  });

  it("insufficient_aal vira mensagem em português", async () => {
    const a = api({ enroll: vi.fn(async () => ({ data: null, error: { code: "insufficient_aal", message: "AAL2 required" } })) });
    const r = await iniciarCadastroTotp(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/verifique|autenticador|segundo/i);
  });

  it("confirmar: challenge + verify com o código; rejeita código mal formado sem chamar a API", async () => {
    const a = api();
    expect((await confirmarCadastro("fator-1", "12ab56", a)).ok).toBe(false);
    expect(a.challenge).not.toHaveBeenCalled();
    expect((await confirmarCadastro("fator-1", CODIGO, a)).ok).toBe(true);
    expect(a.verify).toHaveBeenCalledWith({ factorId: "fator-1", challengeId: "desafio-1", code: CODIGO });
  });
});

describe("verificarCodigo (login em cada sessão)", () => {
  it("usa o primeiro fator TOTP verificado e não precisa renovar quando o nível já é aal2", async () => {
    const a = api();
    const r = await verificarCodigo(CODIGO, a);
    expect(r.ok).toBe(true);
    expect(a.verify).toHaveBeenCalledWith({ factorId: "fator-1", challengeId: "desafio-1", code: CODIGO });
    expect(a.refreshSession).not.toHaveBeenCalled();
  });

  it("renova a sessão só como reserva, se o nível continuar aal1", async () => {
    const a = api({ getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null })) });
    const r = await verificarCodigo(CODIGO, a);
    expect(a.refreshSession).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
  });

  it("sem fator cadastrado, orienta o cadastro", async () => {
    const a = api({ listFactors: vi.fn(async () => ({ data: { totp: [], all: [] }, error: null })) });
    const r = await verificarCodigo(CODIGO, a);
    expect(r.ok).toBe(false);
    expect(a.challenge).not.toHaveBeenCalled();
  });

  it.each([
    ["mfa_verification_failed", /código.*(incorreto|inválido)/i],
    ["mfa_challenge_expired", /expirou/i],
    ["mfa_verification_rejected", /muitas tentativas/i],
  ])("%s tem mensagem em português", async (code, esperado) => {
    const a = api({ verify: vi.fn(async () => ({ data: null, error: { code, message: "x" } })) });
    const r = await verificarCodigo(CODIGO, a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(esperado);
  });

  it("código com formato errado não chama a API", async () => {
    const a = api();
    expect((await verificarCodigo("123", a)).ok).toBe(false);
    expect(a.listFactors).not.toHaveBeenCalled();
  });
});

describe("fatores e mensagens", () => {
  it("lista só os campos necessários e nunca expõe segredo", async () => {
    const f = await listarFatores(api());
    expect(f).toEqual([{ id: "fator-1", nome: "A", tipo: "totp", situacao: "verified", criadoEm: "2026-11-05T10:00:00Z" }]);
  });
  it("codigoValido exige exatamente 6 dígitos", () => {
    expect(codigoValido("123456")).toBe(true);
    expect(codigoValido(" 123456 ")).toBe(true);
    expect(codigoValido("12345")).toBe(false);
    expect(codigoValido("1234567")).toBe(false);
    expect(codigoValido("12345a")).toBe(false);
  });
  it("mensagem genérica quando o erro é desconhecido", () => {
    expect(mensagemMfa({ message: "???" })).toMatch(/não foi possível/i);
  });
});

describe("QR e segredo nunca vão para armazenamento nem console", () => {
  const gravado: string[] = [];
  const espioes: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(() => {
    gravado.length = 0;
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: () => null, removeItem: () => {}, clear: () => {},
      setItem: (k: string, v: string) => void gravado.push(`${k}=${v}`),
    };
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
      getItem: () => null, removeItem: () => {}, clear: () => {},
      setItem: (k: string, v: string) => void gravado.push(`${k}=${v}`),
    };
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      espioes.push(vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void gravado.push(a.join(" "))));
    }
  });
  afterEach(() => {
    espioes.splice(0).forEach((e) => e.mockRestore());
  });

  it("fluxo completo de cadastro e verificação", async () => {
    const a = api({ verify: vi.fn(async () => ({ data: null, error: { code: "mfa_verification_failed", message: `código ${CODIGO} inválido` } })) });
    await iniciarCadastroTotp(a);
    await confirmarCadastro("fator-1", CODIGO, a);
    await verificarCodigo(CODIGO, a);
    const tudo = gravado.join("\n");
    expect(tudo).not.toContain(SEGREDO);
    expect(tudo).not.toContain("qr-unico");
    expect(tudo).not.toContain(CODIGO);
  });

  it("o código digitado não volta na mensagem de erro", async () => {
    const a = api({ verify: vi.fn(async () => ({ data: null, error: { code: "mfa_verification_failed", message: `bad ${CODIGO}` } })) });
    const r = await verificarCodigo(CODIGO, a);
    expect(JSON.stringify(r)).not.toContain(CODIGO);
  });
});
