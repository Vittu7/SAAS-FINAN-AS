import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(__dirname, "..", "supabase", "supabase-23-contas-fixas.sql"), "utf8");
// só o código: sem comentários de linha
const codigo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").toLowerCase();

describe("supabase-23-contas-fixas.sql", () => {
  it("só adiciona colunas e redefine a trava: nenhum update, delete, drop ou truncate de dados", () => {
    expect(codigo).not.toMatch(/\bupdate\s+public\./);
    expect(codigo).not.toMatch(/\bdelete\s+from\b/);
    expect(codigo).not.toMatch(/\bdrop\s+(table|column|trigger|function)\b/);
    expect(codigo).not.toMatch(/\btruncate\b/);
    expect(codigo).not.toMatch(/\binsert\s+into\b/);
  });

  it("toda coluna nova é opcional ou tem padrão que mantém o comportamento atual", () => {
    expect(codigo).toContain("add column if not exists valor_variavel boolean not null default false");
    expect(codigo).toContain("add column if not exists valor_confirmado boolean not null default true");
    expect(codigo).toContain("add column if not exists pago_em date;");
    expect(codigo).toContain("add column if not exists encerrada_em text;");
    expect(codigo).toContain("add column if not exists dia_fechamento smallint;");
  });

  it("a trava de repasse confirmado só ganha pago_em; o resto da regra segue igual", () => {
    expect(codigo).toContain("- 'pago' - 'pago_em' - 'repasse_conta'");
    expect(codigo).toContain("estorne o repasse antes de excluir");
    expect(codigo).toContain("estorne o repasse antes de editar");
    expect(codigo).not.toMatch(/- 'valor'|- 'nome'|- 'repasse_pago'|- 'mes'/);
  });
});
