import { describe, it, expect } from "vitest";
import { garantirPerfil, salvarPerfil, nomePadrao } from "../src/lib/perfil";

/** Banco falso mínimo: uma tabela "perfis" com regra opcional que nega UPDATE (simula RLS). */
function criarBanco({ negarUpdate = false, negarInsert = false } = {}) {
  const linhas: any[] = [];
  const metaCalls: any[] = [];
  const client: any = {
    auth: { updateUser: async (d: any) => void metaCalls.push(d) },
    storage: { from: () => ({}) },
    from: (_t: string) => {
      const q: any = { _f: {} as any, _mode: "select" as string, _patch: null as any, _row: null as any };
      q.select = () => q;
      q.eq = (c: string, v: any) => ((q._f[c] = v), q);
      q.update = (p: any) => ((q._mode = "update"), (q._patch = p), q);
      q.insert = async (row: any) => {
        if (negarInsert) return { error: { message: "RLS" } };
        linhas.push({ ...row });
        return { error: null };
      };
      q.maybeSingle = async () => {
        const alvo = linhas.find((l) => Object.entries(q._f).every(([c, v]) => l[c] === v));
        if (q._mode === "update") {
          if (negarUpdate || !alvo) return { data: null, error: null }; // RLS: 0 linhas, sem erro
          Object.assign(alvo, q._patch);
        }
        return { data: alvo ? { ...alvo } : null, error: null };
      };
      return q;
    },
  };
  return { client, linhas, metaCalls };
}

const user = { id: "u1", email: "maria.silva@mail.com", user_metadata: {} };

describe("perfil", () => {
  it("nome padrão vem do e-mail", () => expect(nomePadrao(user)).toBe("Maria silva"));

  it("cria o perfil de quem acabou de se cadastrar (antes o salvar não gravava nada)", async () => {
    const { client, linhas } = criarBanco();
    expect(linhas).toHaveLength(0);
    const p = await garantirPerfil(client, user);
    expect(linhas).toHaveLength(1);
    expect(p.id).toBe("u1");
  });

  it("não sobrescreve perfil existente", async () => {
    const { client, linhas } = criarBanco();
    linhas.push({ id: "u1", nome_usuario: "Maria", avatar_url: "http://f/1.jpg" });
    const p = await garantirPerfil(client, user);
    expect(p.nome_usuario).toBe("Maria");
    expect(linhas).toHaveLength(1);
  });

  it("salvar nome e foto persiste e fica disponível numa nova leitura", async () => {
    const { client, metaCalls } = criarBanco();
    await salvarPerfil(client, user, { nome: "  Maria S.  " });
    await salvarPerfil(client, user, { avatar_url: "http://f/novo.jpg" });
    const depois = await garantirPerfil(client, user); // "sair e entrar de novo"
    expect(depois.nome_usuario).toBe("Maria S.");
    expect(depois.avatar_url).toBe("http://f/novo.jpg");
    expect(metaCalls.length).toBe(2); // cópia nos dados da conta
  });

  it("avisa claramente quando o banco não grava (em vez de fingir que salvou)", async () => {
    const { client } = criarBanco({ negarUpdate: true });
    await expect(salvarPerfil(client, user, { nome: "X" })).rejects.toThrow(/não confirmou o salvamento/);
  });
});
