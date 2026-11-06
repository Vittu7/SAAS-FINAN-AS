import { describe, it, expect } from "vitest";
import { listarMigracoesPainel, normalizar, MARCA, ARQUIVOS_PAINEL } from "./helpers/sqlArquivos";

const migracoes = listarMigracoesPainel();

// Objetos que as migrações do painel podem criar ou alterar (nada antigo).
const TABELAS_NOVAS = [
  "public.admin_usuarios",
  "public.admin_auditoria",
  "public.admin_acessos_negados",
  "homecash_interno.acessos_negados_contagem",
  "public.admin_sessoes_suporte",
  "public.admin_suporte_confirmacoes",
  "public.erros_app",
  "public.solicitacoes",
  "public.solicitacoes_anexos",
  "homecash_interno.solicitacoes_envios",
  "homecash_interno.servidor_segredos",
  "homecash_interno.anexos_validacao",
  "homecash_interno.anexo_leituras",
];

describe("migração 20 existe", () => {
  it("o arquivo da fase 1 está no repositório", () => {
    expect(migracoes.map((m) => m.arquivo)).toContain(ARQUIVOS_PAINEL[0]);
  });
});

describe.each(migracoes)("$arquivo", ({ bruto, sql }) => {
  const norm = normalizar(sql);

  it("pré-checagem é o primeiro bloco, antes de qualquer create", () => {
    const iDo = norm.indexOf("do $pre$");
    const iCreate = norm.search(/\bcreate\b/);
    expect(iDo).toBeGreaterThan(-1);
    expect(iDo).toBeLessThan(iCreate);
    // antes do bloco só podem existir begin e set local
    const antes = norm.slice(0, iDo);
    expect(antes.replace(/begin;|set local [^;]+;/g, "").trim()).toBe("");
  });

  it("roda numa transação com lock_timeout e termina com commit", () => {
    expect(norm).toMatch(/^begin;/);
    expect(norm).toContain("set local lock_timeout");
    expect(norm.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("todo objeto criado leva comment homecash-admin:v1", () => {
    const grupos: [RegExp, string][] = [
      [/create table if not exists ([a-z_.]+)/g, "table"],
      [/create schema if not exists ([a-z_]+)/g, "schema"],
      [/create or replace function ([a-z_.]+)\(/g, "function"],
    ];
    for (const [re, tipo] of grupos) {
      for (const m of norm.matchAll(re)) {
        const nome = m[1];
        const esperado = new RegExp(`comment on ${tipo} ${nome.replace(".", "\\.")}[ (][^;]*'${MARCA}'`);
        expect(norm, `${tipo} ${nome} sem marcação`).toMatch(esperado);
      }
    }
    expect([...norm.matchAll(/create trigger /g)].length).toBeGreaterThanOrEqual(8);
    expect([...norm.matchAll(/create table if not exists /g)].length).toBeGreaterThanOrEqual(4);
    for (const m of norm.matchAll(/create trigger ([a-z_]+) [^;]*? on ([a-z_.]+) /g)) {
      const esperado = new RegExp(`comment on trigger ${m[1]} on ${m[2].replace(".", "\\.")} is '${MARCA}'`);
      expect(norm, `trigger ${m[1]} sem marcação`).toMatch(esperado);
    }
  });

  it("nenhum drop table/schema/function, truncate, delete from ou update/delete em tabela antiga", () => {
    expect(norm).not.toMatch(/\bdrop (table|schema|function|view|column|type|extension)\b/);
    expect(norm).not.toMatch(/(^|;)\s*truncate\b/);
    expect(norm).not.toMatch(/\bdelete from\b/);
    expect(norm).not.toMatch(/\balter table [a-z_.]+ (drop|alter|rename)\b/);
  });

  it("alter table só em tabelas novas", () => {
    for (const m of norm.matchAll(/alter table (?:if exists )?([a-z_.]+)/g)) {
      expect(TABELAS_NOVAS, `alter em ${m[1]}`).toContain(m[1]);
    }
    expect(norm).not.toMatch(/\balter (function|policy|default privileges)\b/);
  });

  it("nenhum create or replace trigger; drop trigger só em tabela nova", () => {
    expect(norm).not.toMatch(/create or replace trigger/);
    for (const m of norm.matchAll(/drop trigger if exists [a-z_]+ on ([a-z_.]+)/g)) {
      expect(TABELAS_NOVAS).toContain(m[1]);
    }
    for (const m of norm.matchAll(/create trigger [a-z_]+ [^;]*? on ([a-z_.]+) /g)) {
      expect(TABELAS_NOVAS, `trigger em ${m[1]}`).toContain(m[1]);
    }
  });

  it("não cria triggers nem toca em tabelas antigas", () => {
    for (const antiga of ["extrato", "cartao", "contas_fixas", "perfis", "grupos_familiares"]) {
      expect(norm).not.toMatch(new RegExp(`(insert into|update|alter table|create trigger [a-z_]+ [^;]*? on) public\\.${antiga}\\b`));
    }
  });

  it("não referencia a migração 19 local nem funções antigas de grupo", () => {
    expect(norm).not.toContain("supabase-19-excluir");
    expect(norm).not.toContain("entrar_grupo_familiar");
    expect(norm).not.toContain("excluir_grupo_familiar");
  });

  it("service_role só aparece para ser revogado; nunca recebe grant; sem alter default privileges", () => {
    expect(norm).not.toMatch(/grant [^;]*\bservice_role\b/);
    expect(norm).not.toMatch(/alter default privileges/);
    // toda menção é uma revogação, a checagem de existência do papel ou a verificação de postura
    for (const m of norm.matchAll(/service_role/g)) {
      const trecho = norm.slice(Math.max(0, m.index! - 90), m.index! + 40);
      expect(trecho, trecho).toMatch(/revoke all on|rolname = |has_(table|function)_privilege\(|service_role (tem|executa)|from service_role|%s de service_role|nos objetos novos/);
    }
  });

  it("revoga os privilégios padrão de service_role nas tabelas, funções e sequências novas", () => {
    expect(norm).toContain("revoke all on table %s from service_role");
    expect(norm).toContain("revoke all on function %s from service_role");
    expect(norm).toContain("revoke all on sequence %s from service_role");
    expect(norm).toMatch(/select 1 from pg_roles where rolname = 'service_role'/);
  });

  it("a pré-checagem exige as colunas de auth.sessions usadas pela validação da sessão MFA", () => {
    const pre = norm.slice(norm.indexOf("do $pre$"), norm.indexOf("$pre$;"));
    for (const col of ["id", "user_id", "aal", "factor_id", "not_after"]) expect(pre).toContain(`'${col}'`);
    expect(pre).toContain("auth.sessions");
  });

  it("admin_usuarios também bloqueia TRUNCATE (trigger por instrução)", () => {
    expect(norm).toMatch(/create trigger trg_admin_usuarios_imutavel_truncate before truncate on public\.admin_usuarios for each statement execute function homecash_interno\.trg_imutavel_truncate\(\)/);
  });

  it("o índice criado leva a marcação", () => {
    expect(norm).toMatch(/comment on index homecash_interno\.acessos_negados_contagem_hora is 'homecash-admin:v1'/);
  });

  it("contém validação de estrutura, assert de postura e bloco de desfazer comentado", () => {
    expect(norm).toContain("do $estrutura$");
    expect(norm).toContain("do $postura$");
    expect(norm.indexOf("do $estrutura$")).toBeLessThan(norm.indexOf("do $postura$"));
    expect(bruto).toMatch(/^-- DESFAZER/m);
    expect(bruto).toMatch(/^-- drop /m);
    // o desfazer nunca é executado: nenhuma linha dele sem comentário
    expect(norm).not.toMatch(/\bdrop (table|function|schema)/);
  });

  it("toda tabela nova liga RLS e revoga acesso da API", () => {
    for (const m of norm.matchAll(/create table if not exists ([a-z_.]+)/g)) {
      const t = m[1].replace(".", "\\.");
      expect(norm, `RLS em ${m[1]}`).toMatch(new RegExp(`alter table ${t} enable row level security`));
      expect(norm, `revoke em ${m[1]}`).toMatch(new RegExp(`revoke all on table ${t} from public, anon, authenticated`));
    }
  });
});

describe("numeração das migrações (spec #35)", () => {
  it("o painel usa 20, 23, 24 e 25 e nunca os números dos arquivos que já existiam", () => {
    expect([...ARQUIVOS_PAINEL].map((a) => a.slice(9, 11))).toEqual(["20", "23", "24", "25"]);
  });
  it("os arquivos preexistentes 19, 21 e 22 não são lidos nem referenciados pela migração do painel", () => {
    for (const m of migracoes) {
      expect(m.sql).not.toMatch(/supabase-(19|21|22)-/);
    }
  });
});
