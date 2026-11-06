// Ajudantes dos testes estáticos das migrações do painel (sem banco).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MARCA = "homecash-admin:v1";

// Numeração final (spec #35): 19, 21 e 22 já existem no repositório e NÃO são do painel.
export const ARQUIVOS_PAINEL = [
  "supabase-20-admin-base.sql",
  "supabase-23-admin-suporte.sql",
  "supabase-24-erros-solicitacoes.sql",
  "supabase-25-solicitacoes-anexos-email.sql",
] as const;

export type Categoria = "A" | "B" | "C" | "D" | "E" | "F";

// Classificação de cada função nova (spec §5.2). Cada fase acrescenta as suas.
export const CATEGORIAS: Record<string, Categoria> = {
  // migração 20
  "public.sou_admin": "B",
  "public.registrar_tentativa_admin": "B",
  "public.admin_registrar_acesso": "A",
  "public.admin_resumo": "A",
  "public.admin_listar_usuarios": "A",
  "public.admin_usuario_detalhe": "A",
  "public.admin_listar_auditoria": "A",
  "public.admin_verificar_auditoria": "A",
  "homecash_interno.checar_admin": "D",
  "homecash_interno.registrar_auditoria": "D",
  "homecash_interno.registrar_negado": "D",
  "homecash_interno.hash_linha_auditoria": "D",
  "homecash_interno.hash_linha_negado": "D",
  "homecash_interno.trg_cadeia_auditoria": "F",
  "homecash_interno.trg_cadeia_negados": "F",
  "homecash_interno.trg_imutavel_linha": "F",
  "homecash_interno.trg_imutavel_truncate": "F",
  "homecash_interno.trg_ultimo_admin": "F",
  "homecash_interno.trg_auditar_admin_usuarios": "F",
};

export interface Migracao {
  arquivo: string;
  bruto: string;
  /** SQL sem comentários de linha e de bloco. */
  sql: string;
}

export interface Funcao {
  nome: string; // schema.nome
  argumentos: string;
  retorno: string;
  cabecalho: string; // do "create" até o primeiro $$
  corpo: string; // entre os $$
  texto: string;
}

export function semComentarios(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

export function normalizar(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function listarMigracoesPainel(): Migracao[] {
  const raiz = join(process.cwd(), "supabase");
  const saida: Migracao[] = [];
  for (const arquivo of ARQUIVOS_PAINEL) {
    const caminho = join(raiz, arquivo);
    if (!existsSync(caminho)) continue;
    const bruto = readFileSync(caminho, "utf8");
    saida.push({ arquivo, bruto, sql: semComentarios(bruto) });
  }
  return saida;
}

/** Remove os blocos `do $tag$ ... $tag$;` (pré-checagem, validações). */
export function semBlocosDo(sql: string): string {
  return sql.replace(/\bdo\s+\$(\w*)\$[\s\S]*?\$\1\$\s*;/gi, "");
}

/** Funções criadas fora de blocos `do`, com corpo delimitado por `$$`. */
export function extrairFuncoes(sql: string): Funcao[] {
  const limpo = semBlocosDo(sql);
  const pedacos = limpo.split(/create or replace function/i).slice(1);
  const funcoes: Funcao[] = [];
  for (const pedaco of pedacos) {
    const m = pedaco.match(/^\s*([a-z_0-9.]+)\s*\(([^)]*)\)\s*returns\s+([a-z_0-9.]+)/i);
    if (!m) continue;
    const partes = pedaco.split("$$");
    funcoes.push({
      nome: m[1].toLowerCase(),
      argumentos: m[2],
      retorno: m[3].toLowerCase(),
      cabecalho: partes[0],
      corpo: partes[1] ?? "",
      texto: pedaco,
    });
  }
  return funcoes;
}

export function funcoesDe(sql: string, categoria: Categoria): Funcao[] {
  return extrairFuncoes(sql).filter((f) => CATEGORIAS[f.nome] === categoria);
}

export function extrairFuncao(sql: string, nome: string): Funcao {
  const f = extrairFuncoes(sql).find((x) => x.nome === nome);
  if (!f) throw new Error(`função ${nome} não encontrada`);
  return f;
}

/** Primeira instrução depois do `begin` do corpo (plpgsql). */
export function primeiraInstrucao(corpo: string): string {
  const i = corpo.search(/\bbegin\b/i);
  if (i < 0) return "";
  return corpo.slice(i + 5).trim().split(";")[0].toLowerCase();
}
