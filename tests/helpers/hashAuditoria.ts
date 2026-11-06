// Especificação executável do hash da cadeia de auditoria (spec §5.4).
// Reproduz em TypeScript o que o Postgres faz em
//   homecash_interno.hash_linha_auditoria():
//   sha256( jsonb_build_array('v1', ordem, hash_anterior, id, admin_id, admin_email, acao,
//           alvo_user_id, alvo_email, recurso, linhas, motivo, sessao_suporte,
//           to_char(criado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'), parametros)::text )
// Regras do texto de jsonb: separadores ", " e ": ", chaves de objeto ordenadas por
// tamanho e depois por bytes, nulo vira null (nunca desloca campos).
import { createHash } from "node:crypto";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface LinhaAuditoria {
  ordem: number;
  hash_anterior: string;
  id: number;
  admin_id: string | null;
  admin_email: string | null;
  acao: string;
  alvo_user_id: string | null;
  alvo_email: string | null;
  recurso: string | null;
  linhas: number | null;
  motivo: string | null;
  sessao_suporte: string | null;
  criado_em: string; // 'YYYY-MM-DDTHH:MM:SS.ffffff' em UTC
  parametros: Json;
  hash?: string;
}

export const ZEROS = "0".repeat(64);

function comparaChaves(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}

/** Texto canônico de um valor jsonb. */
export function jsonbTexto(v: Json): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(jsonbTexto).join(", ")}]`;
  const chaves = Object.keys(v).sort(comparaChaves);
  return `{${chaves.map((k) => `${JSON.stringify(k)}: ${jsonbTexto(v[k])}`).join(", ")}}`;
}

export function serializarLinha(l: LinhaAuditoria): string {
  return jsonbTexto([
    "v1", l.ordem, l.hash_anterior, l.id, l.admin_id, l.admin_email, l.acao, l.alvo_user_id,
    l.alvo_email, l.recurso, l.linhas, l.motivo, l.sessao_suporte, l.criado_em, l.parametros,
  ]);
}

export function hashLinha(l: LinhaAuditoria): string {
  return createHash("sha256").update(serializarLinha(l), "utf8").digest("hex");
}

/** Monta a próxima linha da cadeia, como o trigger de inserção faz. */
export function encadear(anterior: LinhaAuditoria | null, nova: Omit<LinhaAuditoria, "ordem" | "hash_anterior" | "hash">): LinhaAuditoria {
  const linha: LinhaAuditoria = {
    ...nova,
    ordem: (anterior?.ordem ?? 0) + 1,
    hash_anterior: anterior?.hash ?? ZEROS,
  };
  linha.hash = hashLinha(linha);
  return linha;
}

export interface ResultadoVerificacao {
  verificadas: number;
  primeiraQuebra: number | null;
  proxima: number | null;
}

/**
 * Verifica uma página, como admin_verificar_auditoria: lê a linha imediatamente anterior
 * a `desde` para encadear a primeira da página.
 */
export function verificarPagina(cadeia: LinhaAuditoria[], desde = 1, limite = 5000): ResultadoVerificacao {
  const ordenada = [...cadeia].sort((a, b) => a.ordem - b.ordem);
  const anterior = [...ordenada].reverse().find((l) => l.ordem < desde) ?? null;
  const pagina = ordenada.filter((l) => l.ordem >= desde).slice(0, limite);
  const resto = ordenada.filter((l) => l.ordem >= desde).slice(limite);
  let prev = anterior;
  let quebra: number | null = null;
  for (const l of pagina) {
    const esperaOrdem = (prev?.ordem ?? 0) + 1;
    const esperaAnterior = prev?.hash ?? ZEROS;
    const ruim = l.ordem !== esperaOrdem || l.hash_anterior !== esperaAnterior || l.hash !== hashLinha(l);
    if (ruim && quebra === null) quebra = l.ordem;
    prev = l;
  }
  return { verificadas: pagina.length, primeiraQuebra: quebra, proxima: resto[0]?.ordem ?? null };
}

/** Verifica a cadeia inteira encadeando as páginas. */
export function verificarTudo(cadeia: LinhaAuditoria[], limite = 5000): ResultadoVerificacao {
  let desde = 1;
  let total = 0;
  for (;;) {
    const r = verificarPagina(cadeia, desde, limite);
    total += r.verificadas;
    if (r.primeiraQuebra !== null) return { verificadas: total, primeiraQuebra: r.primeiraQuebra, proxima: r.proxima };
    if (r.proxima === null) return { verificadas: total, primeiraQuebra: null, proxima: null };
    desde = r.proxima;
  }
}
