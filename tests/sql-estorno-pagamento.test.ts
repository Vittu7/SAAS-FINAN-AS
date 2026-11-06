import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(__dirname, "..", "supabase", "supabase-24-estorno-pagamento-fatura.sql"), "utf8");
const codigo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").toLowerCase();

describe("supabase-24-estorno-pagamento-fatura.sql", () => {
  it("só adiciona a coluna estornado_em e uma trava: não altera nem apaga nenhum dado", () => {
    expect(codigo).toContain("add column if not exists estornado_em timestamptz;");
    expect(codigo).not.toMatch(/\bupdate\s+public\./);
    expect(codigo).not.toMatch(/\bdelete\s+from\b/);
    expect(codigo).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(codigo).not.toMatch(/\btruncate\b/);
    expect(codigo).not.toMatch(/\binsert\s+into\b/);
  });
  it("a trava só aceita estornado_em de vazio para preenchido e recusa estorno repetido", () => {
    expect(codigo).toContain("old.estornado_em is not null");
    expect(codigo).toContain("- 'estornado_em'");
    expect(codigo).toContain("before update on public.pagamentos_fatura");
  });
});
