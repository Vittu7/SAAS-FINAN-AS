#!/usr/bin/env node
/**
 * Verificação de segredos: código-fonte, bundle do cliente (.next/static) e histórico do Git.
 *
 * Uso:
 *   node scripts/verificar-segredos.mjs              # código + build (se existir)
 *   node scripts/verificar-segredos.mjs --historico  # inclui todo o histórico do Git
 *
 * Falha (exit 1) se encontrar: JWT com role=service_role, chave `sb_secret_`,
 * variável NEXT_PUBLIC_* com nome SERVICE/SECRET, ou JWT fixo (hardcoded) no código-fonte.
 * Uma chave `anon` dentro de .next/static é ESPERADA (é pública) e só é reportada como informação.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const RAIZ = process.cwd();
const IGNORAR = new Set(["node_modules", ".git", ".vercel", "coverage"]);
const EXT_TEXTO = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html|txt|map|yml|yaml|sql|env|example)$/i;

const RE_JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g;
const RE_SB_SECRET = /sb_secret_[A-Za-z0-9_-]{8,}/g;
const RE_PUBLIC_SECRET = /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)[A-Z0-9_]*/g;

const falhas = [];
const infos = [];

function papelDoJwt(jwt) {
  try {
    const payload = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

function analisar(texto, origem, { ehBundle, ehCodigo, ehHistorico = false }) {
  for (const jwt of texto.match(RE_JWT) ?? []) {
    const role = papelDoJwt(jwt);
    if (role === "service_role") {
      falhas.push(`[CRÍTICO] JWT service_role em ${origem}`);
    } else if (role === "anon" && (ehBundle || ehHistorico)) {
      infos.push(`chave anon (pública, role=anon) presente em ${origem} — esperado/sem risco por si só`);
    } else if (ehCodigo) {
      falhas.push(`[ALTO] JWT fixo (hardcoded, role=${role ?? "?"}) em ${origem} — mover para variável de ambiente`);
    }
  }
  if (RE_SB_SECRET.test(texto)) falhas.push(`[CRÍTICO] chave sb_secret_ em ${origem}`);
  RE_SB_SECRET.lastIndex = 0;
  for (const m of texto.match(RE_PUBLIC_SECRET) ?? []) {
    falhas.push(`[CRÍTICO] variável pública com nome sensível (${m}) em ${origem}`);
  }
}

function percorrer(dir, opcoes) {
  if (!existsSync(dir)) return;
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const caminho = join(dir, nome);
    const st = statSync(caminho);
    if (st.isDirectory()) {
      percorrer(caminho, opcoes);
    } else if (EXT_TEXTO.test(nome) && st.size < 20 * 1024 * 1024) {
      // package-lock e docs não são "código" para a regra de JWT fixo
      const ehCodigo = opcoes.ehCodigo && !/package-lock\.json$|\.md$/i.test(nome);
      analisar(readFileSync(caminho, "utf8"), relative(RAIZ, caminho), { ...opcoes, ehCodigo });
    }
  }
}

// 1) código-fonte e configs
for (const d of ["src", "public", "scripts", "tests"]) percorrer(join(RAIZ, d), { ehBundle: false, ehCodigo: true });
for (const f of ["next.config.ts", "package.json", ".env.example", "README.md", "LEIA-ME.md"]) {
  if (existsSync(join(RAIZ, f))) analisar(readFileSync(join(RAIZ, f), "utf8"), f, { ehBundle: false, ehCodigo: f === "next.config.ts" });
}

// 2) arquivos .env rastreados pelo Git (exceto o exemplo)
const rastreados = spawnSync("git", ["ls-files"], { encoding: "utf8" }).stdout?.split("\n") ?? [];
for (const f of rastreados) {
  if (/(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith(".env.example")) falhas.push(`[ALTO] arquivo de ambiente rastreado pelo Git: ${f}`);
}

// 3) bundle do cliente
const bundle = join(RAIZ, ".next", "static");
if (existsSync(bundle)) percorrer(bundle, { ehBundle: true, ehCodigo: false });
else infos.push("build não encontrado (.next/static): rode `npm run build` para verificar o bundle do cliente.");

// 4) histórico do Git
if (process.argv.includes("--historico")) {
  const log = spawnSync("git", ["log", "--all", "-p", "--no-color"], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  analisar(log.stdout ?? "", "histórico do Git", { ehBundle: false, ehCodigo: false, ehHistorico: true });
  const arquivos = spawnSync("git", ["log", "--all", "--name-only", "--pretty=format:"], { encoding: "utf8" }).stdout ?? "";
  for (const f of new Set(arquivos.split("\n"))) {
    if (/(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith(".env.example")) falhas.push(`[ALTO] arquivo de ambiente já commitado no histórico: ${f}`);
  }
}

for (const i of new Set(infos)) console.log("ℹ️ ", i);
if (falhas.length) {
  for (const f of new Set(falhas)) console.error("❌", f);
  console.error(`\n${new Set(falhas).size} problema(s) encontrado(s).`);
  process.exit(1);
}
console.log("✅ Nenhum segredo privilegiado encontrado.");
