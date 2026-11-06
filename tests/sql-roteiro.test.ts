import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { semComentarios, normalizar } from "./helpers/sqlArquivos";

const dir = join(process.cwd(), "supabase", "testes");
const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql"));

describe("roteiros de banco (supabase/testes)", () => {
  it("existe o roteiro da migração 20", () => {
    expect(arquivos).toContain("admin-base.sql");
  });

  describe.each(arquivos)("%s", (nome) => {
    const bruto = readFileSync(join(dir, nome), "utf8");
    const norm = normalizar(semComentarios(bruto));

    it("é uma transação que termina em rollback e nunca confirma", () => {
      expect(norm).toMatch(/^begin;/);
      expect(norm.trimEnd().endsWith("rollback;")).toBe(true);
      expect(norm).not.toMatch(/\bcommit\b/);
    });

    it("avisa no cabeçalho que só roda com autorização", () => {
      expect(bruto.slice(0, 900)).toMatch(/NÃO EXECUTAR sem autorização/);
    });

    it("não toca em tabelas de domínio nem cria objetos fora de zz_ e auth de teste", () => {
      expect(norm).not.toMatch(/(insert into|update|delete from|truncate) public\.(extrato|cartao|contas_fixas|grupos_familiares)\b/);
      for (const m of norm.matchAll(/create (table|function) (public\.[a-z_0-9]+)/g)) {
        expect(m[2].startsWith("public.zz_"), m[2]).toBe(true);
      }
    });

    it("a última consulta devolve o resumo das verificações", () => {
      // A consulta final sempre devolve uma linha: falhas, total e quais (nunca zero linhas).
      expect(norm).toContain("as falhas");
      expect(norm).toContain("as total");
      expect(norm).toContain("'nenhuma'");
    });
  });

  it("o roteiro da migração 20 cobre cada correção e cada Review Focus", () => {
    const s = normalizar(readFileSync(join(dir, "admin-base.sql"), "utf8"));
    const cobertura: Record<string, string[]> = {
      "sessão MFA (item 1)": ["sessao_invalida", "mfa_requerida", "mfa_nao_configurada", "not_after"],
      "teto e admin cadastrado (itens 2 e 8)": ["enchimento", "generate_series(1, 200)", "generate_series(1, 2000)"],
      "último admin (item 3)": ["23514", "pg_advisory_xact_lock(7104, 1)"],
      "truncate (item 4)": ["truncate public.admin_usuarios"],
      "página (item 6)": ["100001", "2147483647"],
      "rota (item 7)": ["rota_invalida"],
      "cadeia dos negados (item 9)": ["'negados'", "disable trigger trg_negados_imutavel_linha"],
      "service_role (item 11)": ["service_role"],
      "Review Focus 1: cargo forjado": ["set cargo = 'gestor'", "acesso_negado"],
      "Review Focus 2: admin_id nulo": ["admin_id is null"],
      "Review Focus 3: busca hostil": ["drop table x", "busca \"%\""],
      "Review Focus 4: usuário sem grupo": ["sem grupo"],
      "Review Focus 5: JWT antigo": ["delete from auth.mfa_factors where id", "mfa_expirada"],
    };
    for (const [nome, chaves] of Object.entries(cobertura)) {
      for (const k of chaves) expect(s, `${nome}: ${k}`).toContain(k.toLowerCase());
    }
  });
});
