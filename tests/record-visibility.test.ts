import { describe, expect, it } from "vitest";
import { registroVisivelParaUsuario } from "../src/lib/record-visibility";

describe("registroVisivelParaUsuario", () => {
  it("permite ao proprietário ver seu próprio registro privado", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u1", privado: true },
        "u1",
        "g1",
      ),
    ).toBe(true);
  });

  it("preserva a visibilidade dos registros marcados como legados", () => {
    expect(
      registroVisivelParaUsuario(
        {
          owner_id: "u2",
          grupo_id: "g1",
          responsavel_id: "perfil-u1",
          privado: false,
          compartilhado_com: null,
          legado_privacidade_v1: true,
        },
        "u1",
        "g1",
      ),
    ).toBe(true);
  });

  it("nega por padrão registro de outra pessoa sem compartilhamento explícito", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", grupo_id: "g1", privado: false, compartilhado_com: null },
        "u1",
        "g1",
      ),
    ).toBe(false);
  });

  it("não libera registro legado apenas por pertencer ao mesmo grupo", () => {
    expect(
      registroVisivelParaUsuario(
        {
          owner_id: "u2",
          grupo_id: "g1",
          responsavel_id: "perfil-u2",
          privado: false,
          legado_privacidade_v1: true,
        },
        "u1",
        "g1",
        "perfil-u1",
      ),
    ).toBe(false);
  });

  it("nega registro privado legado para outro membro", () => {
    expect(
      registroVisivelParaUsuario(
        {
          owner_id: "u2",
          grupo_id: "g1",
          responsavel_id: "perfil-u2",
          privado: true,
          compartilhado_com: "u1",
          legado_privacidade_v1: true,
        },
        "u1",
        "g1",
        "perfil-u1",
      ),
    ).toBe(false);
  });

  it("nega registro legado sem vínculo anterior com usuário ou grupo", () => {
    expect(
      registroVisivelParaUsuario(
        {
          owner_id: "u2",
          grupo_id: "g2",
          responsavel_id: "perfil-u2",
          privado: false,
          legado_privacidade_v1: true,
        },
        "u1",
        "g1",
        "perfil-u1",
      ),
    ).toBe(false);
  });

  it("nega registro marcado como privado mesmo que exista destinatário", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", privado: true, compartilhado_com: "u1" },
        "u1",
        "g1",
      ),
    ).toBe(false);
  });

  it("permite compartilhamento individual usando o ID do perfil do destinatário", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", grupo_id: "g1", compartilhado_com: "perfil-u1" },
        "u1",
        "g1",
        "perfil-u1",
      ),
    ).toBe(true);
  });

  it("permite registro compartilhado explicitamente com o usuário", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", privado: false, compartilhado_com: "u1" },
        "u1",
        "g1",
      ),
    ).toBe(true);
  });

  it("permite compartilhamento individual em tabela sem coluna privado", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", grupo_id: "g1", compartilhado_com: "u1" },
        "u1",
        "g1",
      ),
    ).toBe(true);
  });

  it("nega registro de tabela sem coluna privado quando não há compartilhamento", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", grupo_id: "g1", compartilhado_com: null },
        "u1",
        "g1",
      ),
    ).toBe(false);
  });

  it("permite registro compartilhado explicitamente com o grupo atual", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", grupo_id: "g1", privado: false, compartilhado_com: "g1" },
        "u1",
        "g1",
      ),
    ).toBe(true);
  });

  it("nega compartilhamento com outro grupo", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u2", grupo_id: "g2", privado: false, compartilhado_com: "g2" },
        "u1",
        "g1",
      ),
    ).toBe(false);
  });

  it("nega acesso quando não há usuário autenticado", () => {
    expect(
      registroVisivelParaUsuario(
        { owner_id: "u1", privado: true },
        null,
        null,
      ),
    ).toBe(false);
  });
});

