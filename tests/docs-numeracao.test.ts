import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const spec = ler("docs/superpowers/specs/2026-11-05-painel-admin-design.md");
const plano = ler("docs/superpowers/plans/2026-11-05-painel-admin.md");
const proxy = ler("src/proxy.ts");

describe("numeração final das migrações do painel (spec #35)", () => {
  const finais = [
    "supabase-20-admin-base.sql",
    "supabase-23-admin-suporte.sql",
    "supabase-24-erros-solicitacoes.sql",
    "supabase-25-solicitacoes-anexos-email.sql",
  ];
  it.each([["spec", spec], ["plano", plano]])("%s usa só os nomes finais", (_n, texto) => {
    for (const f of finais) expect(texto, f).toContain(f);
    for (const antigo of ["supabase-19-admin-base", "supabase-20-admin-suporte", "supabase-21-admin-suporte", "supabase-21-erros-solicitacoes", "supabase-22-erros-solicitacoes", "supabase-22-solicitacoes-anexos-email", "supabase-23-solicitacoes-anexos-email"]) {
      expect(texto, antigo).not.toContain(antigo);
    }
  });
  it.each([["spec", spec], ["plano", plano]])("%s preserva os três arquivos que já existiam", (_n, texto) => {
    for (const f of ["supabase-19-excluir-grupo-convidado.sql", "supabase-21-storage.sql", "supabase-22-remove-objetos-antigos.sql"]) {
      expect(texto, f).toContain(f);
    }
  });
});

describe("CSP temporária e portão G-CSP", () => {
  it("o proxy marca a política como temporária e obrigatória antes da fase 3", () => {
    expect(proxy).toContain("TEMPORÁRIA");
    expect(proxy).toContain("G-CSP");
  });
  it("spec e plano exigem o portão G-CSP antes de publicar a fase 3", () => {
    expect(spec).toContain("G-CSP");
    expect(plano).toContain("G-CSP");
    expect(spec).toMatch(/experimental\.sri` está refutada/);
  });
});
