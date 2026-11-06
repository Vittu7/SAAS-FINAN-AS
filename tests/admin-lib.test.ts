import { describe, it, expect, vi } from "vitest";
import {
  chamarAdmin, mensagemErroAdmin, paginar, souAdmin, registrarTentativaAdmin, ehErroDeMfa,
  CODIGOS_ERRO_ADMIN, type RpcFn,
} from "../src/lib/admin";

const rpcCom = (data: unknown, error: { message: string; code?: string } | null = null): RpcFn =>
  vi.fn(async () => ({ data, error }));

describe("chamarAdmin", () => {
  it("devolve ok e dados", async () => {
    const rpc = rpcCom({ ok: true, dados: { usuarios: 3 } });
    const r = await chamarAdmin<{ usuarios: number }>("admin_resumo", undefined, rpc);
    expect(r).toEqual({ ok: true, dados: { usuarios: 3 } });
    expect(rpc).toHaveBeenCalledWith("admin_resumo", {});
  });

  it("devolve o erro do envelope sem lançar", async () => {
    const r = await chamarAdmin("admin_resumo", undefined, rpcCom({ ok: false, erro: "mfa_requerida" }));
    expect(r).toEqual({ ok: false, erro: "mfa_requerida" });
  });

  it("código desconhecido do servidor vira erro_desconhecido", async () => {
    const r = await chamarAdmin("x", undefined, rpcCom({ ok: false, erro: "algo_novo" }));
    expect(r).toEqual({ ok: false, erro: "erro_desconhecido" });
  });

  it("função inexistente vira funcao_nao_instalada", async () => {
    const a = await chamarAdmin("x", undefined, rpcCom(null, { message: "Could not find the function public.x in the schema cache", code: "PGRST202" }));
    const b = await chamarAdmin("x", undefined, rpcCom(null, { message: "function public.x() does not exist", code: "42883" }));
    expect(a).toEqual({ ok: false, erro: "funcao_nao_instalada" });
    expect(b).toEqual({ ok: false, erro: "funcao_nao_instalada" });
  });

  it("outros erros e exceções viram erro_rede e nunca lançam", async () => {
    expect(await chamarAdmin("x", undefined, rpcCom(null, { message: "boom" }))).toEqual({ ok: false, erro: "erro_rede" });
    const lanca: RpcFn = async () => { throw new Error("offline"); };
    expect(await chamarAdmin("x", undefined, lanca)).toEqual({ ok: false, erro: "erro_rede" });
  });

  it("resposta fora do formato do envelope vira erro_rede", async () => {
    expect(await chamarAdmin("x", undefined, rpcCom("texto"))).toEqual({ ok: false, erro: "erro_rede" });
    expect(await chamarAdmin("x", undefined, rpcCom(null))).toEqual({ ok: false, erro: "erro_rede" });
  });
});

describe("paginar", () => {
  it("limite acima de 200 é cortado", () => {
    expect(paginar(1, 5000)).toEqual({ p_pagina: 1, p_limite: 200 });
  });
  it("página acima do máximo é cortada em 100000", () => {
    expect(paginar(2_000_000_000, 25).p_pagina).toBe(100000);
  });
  it("página negativa, zero ou inválida vira 1", () => {
    expect(paginar(-3, 25).p_pagina).toBe(1);
    expect(paginar(0, 25).p_pagina).toBe(1);
    expect(paginar(Number.NaN, 25).p_pagina).toBe(1);
    expect(paginar(2.7, 25).p_pagina).toBe(2);
  });
  it("limite zero, negativo ou inválido usa o padrão", () => {
    expect(paginar(1, 0).p_limite).toBe(25);
    expect(paginar(1, -4).p_limite).toBe(25);
    expect(paginar(1, Number.NaN).p_limite).toBe(25);
  });
});

describe("mensagens em português", () => {
  it("cada código tem mensagem não vazia e sem o código técnico", () => {
    for (const c of CODIGOS_ERRO_ADMIN) {
      const m = mensagemErroAdmin(c);
      expect(m.length).toBeGreaterThan(5);
      expect(m).not.toContain("_");
    }
  });
  it("acesso negado não revela se o painel existe", () => {
    expect(mensagemErroAdmin("acesso_negado").toLowerCase()).not.toContain("admin");
  });
  it("só os códigos de MFA mandam para a tela de segurança", () => {
    expect(ehErroDeMfa("mfa_requerida")).toBe(true);
    expect(ehErroDeMfa("mfa_nao_configurada")).toBe(true);
    expect(ehErroDeMfa("mfa_expirada")).toBe(true);
    expect(ehErroDeMfa("fator_nao_aprovado")).toBe(true);
    expect(ehErroDeMfa("acesso_negado")).toBe(false);
  });
});

describe("souAdmin e registrarTentativaAdmin", () => {
  it("souAdmin devolve boolean e falha fechado", async () => {
    expect(await souAdmin(rpcCom(true))).toBe(true);
    expect(await souAdmin(rpcCom(false))).toBe(false);
    expect(await souAdmin(rpcCom(null, { message: "x" }))).toBe(false);
    expect(await souAdmin(rpcCom("true"))).toBe(false);
  });
  it("registrarTentativaAdmin envia só a rota e nunca lança", async () => {
    const rpc = rpcCom({ ok: true });
    await registrarTentativaAdmin("/admin/usuarios", rpc);
    expect(rpc).toHaveBeenCalledWith("registrar_tentativa_admin", { p_rota: "/admin/usuarios" });
    const lanca: RpcFn = async () => { throw new Error("x"); };
    await expect(registrarTentativaAdmin("/admin", lanca)).resolves.toBeUndefined();
  });
});
