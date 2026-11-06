import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();

function arquivos(dir: string, exts = [".ts", ".tsx"]): string[] {
  const abs = join(RAIZ, dir);
  if (!existsSync(abs)) return [];
  const saida: string[] = [];
  for (const nome of readdirSync(abs)) {
    const p = join(abs, nome);
    if (statSync(p).isDirectory()) saida.push(...arquivos(join(dir, nome), exts));
    else if (exts.some((e) => nome.endsWith(e))) saida.push(p);
  }
  return saida;
}

const ler = (p: string) => readFileSync(p, "utf8");
const rel = (p: string) => relative(RAIZ, p).replace(/\\/g, "/");

// Código que mostra conteúdo escrito por terceiros ao administrador.
const ALVOS_ADMIN = [
  ...arquivos("src/app/admin"),
  ...arquivos("src/components/admin"),
  ...arquivos("src/app/api"),
];
const CODIGO_SRC = arquivos("src");

describe("a área do painel existe", () => {
  it("há arquivos de interface do painel para varrer", () => {
    expect(arquivos("src/app/admin").length).toBeGreaterThanOrEqual(4);
    expect(arquivos("src/components/admin").length).toBeGreaterThanOrEqual(4);
  });
});

describe("conteúdo de terceiros é texto (spec §11)", () => {
  const PROIBIDOS: [string, RegExp][] = [
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["innerHTML", /\.innerHTML|innerHTML\s*=/],
    ["eval(", /\beval\s*\(/],
    ["new Function", /new\s+Function\b/],
    ["<iframe", /<iframe/i],
    ["<object", /<object[\s>]/i],
    ["<embed", /<embed[\s>]/i],
    ["document.write", /document\.write/],
  ];
  it.each(PROIBIDOS)("nenhum arquivo do painel usa %s", (_nome, re) => {
    for (const f of ALVOS_ADMIN) expect(ler(f), rel(f)).not.toMatch(re);
  });

  it("links só literais: caminho do painel, https ou mailto; target _blank leva rel noreferrer", () => {
    for (const f of ALVOS_ADMIN) {
      const c = ler(f);
      for (const m of c.matchAll(/href=(\{[^}]*\}|"[^"]*")/g)) {
        const v = m[1];
        const ok = /^"(\/|https:\/\/|mailto:|#)/.test(v) || /^\{`\/admin/.test(v) || /^\{"\/(admin)?[^"]*"\}$/.test(v) || /^\{ROTAS_ADMIN(\.|\[)[^}]*\}$/.test(v);
        expect(ok, `${rel(f)}: href=${v}`).toBe(true);
      }
      if (/target="_blank"/.test(c)) expect(c, rel(f)).toMatch(/rel="[^"]*noreferrer/);
    }
  });

  it("imagens do painel só por <img> (nunca background de URL de terceiros em estilo inline)", () => {
    for (const f of ALVOS_ADMIN) expect(ler(f), rel(f)).not.toMatch(/url\(\$\{/);
  });
});

describe("segredos e credenciais privilegiadas", () => {
  const SEGREDOS = /SOLICITACOES_SEGREDO_SERVIDOR|EMAIL_API_KEY|SERVICE_ROLE|service_role/i;

  it("nenhuma variável secreta tem prefixo NEXT_PUBLIC_", () => {
    for (const f of CODIGO_SRC) {
      expect(ler(f), rel(f)).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SEGREDO|EMAIL_API|API_KEY_SERVIDOR)/);
    }
  });

  it("service_role e segredos de servidor não aparecem em nenhum arquivo de src", () => {
    for (const f of CODIGO_SRC) {
      const nome = rel(f);
      // a rota de servidor (fase 5) é o único lugar autorizado a citar os segredos
      if (nome.startsWith("src/app/api/") || nome.startsWith("src/lib/servidor/")) continue;
      expect(ler(f), nome).not.toMatch(SEGREDOS);
    }
  });

  it("o painel usa só o cliente do app (chave anon) e nunca importa useFinanceStore", () => {
    for (const f of ALVOS_ADMIN) {
      expect(ler(f), rel(f)).not.toMatch(/useFinanceStore/);
    }
    const sup = ler(join(RAIZ, "src/lib/supabase.ts"));
    expect(sup).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(sup).not.toMatch(SEGREDOS);
  });
});

describe("dados do painel ficam só em memória (spec §5.6)", () => {
  it("sem escrita em localStorage, sessionStorage, cookies ou console nos arquivos do painel", () => {
    for (const f of ALVOS_ADMIN) {
      const c = ler(f);
      expect(c, rel(f)).not.toMatch(/(local|session)Storage\s*\.\s*setItem/);
      expect(c, rel(f)).not.toMatch(/document\.cookie\s*=/);
      expect(c, rel(f)).not.toMatch(/console\.(log|info|debug|warn|error)/);
    }
  });
});

describe("o painel nunca decide permissão por cargo (E5-1)", () => {
  it("nenhum arquivo do painel usa perfis.cargo para liberar ou bloquear", () => {
    for (const f of ALVOS_ADMIN) {
      const c = ler(f);
      expect(c, rel(f)).not.toMatch(/\.cargo\b/);
      expect(c, rel(f)).not.toMatch(/['"]gestor['"]/);
    }
  });
});

describe("a CSP do painel", () => {
  // DESVIO documentado: com cacheComponents o HTML é estático e não recebe nonce (ver src/proxy.ts),
  // então 'unsafe-inline' em script é aceito até o responsável decidir (nonce é impossível aqui).
  const candidatos = [join(RAIZ, "src/proxy.ts"), join(RAIZ, "proxy.ts")].filter(existsSync);

  it("existe um único proxy e ele só age em /admin", () => {
    expect(candidatos.length).toBe(1);
    const c = ler(candidatos[0]);
    expect(c).toMatch(/source:\s*"\/admin\/:path\*"/);
    expect(c).not.toMatch(/matcher:\s*\[?\s*"\/\(\.\*\)"/);
  });

  it("trava origens externas de script, conexão, objeto, frame, base e formulário", () => {
    const c = ler(candidatos[0]);
    expect(c).toContain("frame-ancestors 'none'");
    expect(c).toContain("object-src 'none'");
    expect(c).toContain("base-uri 'self'");
    expect(c).toContain("form-action 'self'");
    expect(c).toContain("nosniff");
    const script = c.match(/"script-src[^"]*"|`script-src[^`]*`/)?.[0] ?? "";
    expect(script).toContain("script-src 'self'");
    expect(script).not.toMatch(/\*|https:|data:|blob:/);
    const conexao = c.match(/"connect-src[^"]*"/)?.[0] ?? "";
    expect(conexao).toContain("'self'");
    expect(conexao).toContain("supabase.co");
    expect(conexao).not.toMatch(/ \*[ "]/);
  });

  it("unsafe-eval só em desenvolvimento", () => {
    const c = ler(candidatos[0]);
    for (const m of c.matchAll(/unsafe-eval/g)) {
      const antes = c.slice(Math.max(0, m.index! - 80), m.index!);
      expect(antes).toMatch(/dev\s*\?/);
    }
  });

  it("img-src permite data: (QR do autenticador) e o resto só do próprio site", () => {
    const c = ler(candidatos[0]);
    const img = c.match(/"img-src[^"]*"/)?.[0] ?? "";
    expect(img).toContain("data:");
    expect(img).not.toContain("https:");
  });
});
