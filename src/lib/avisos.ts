/**
 * Avisos (toasts) do HomeCash: confirmações de sucesso e mensagens de erro.
 *
 * É um repositório simples fora do React, então qualquer lugar (hooks, funções, componentes) pode chamar
 * `avisos.sucesso("Entrada cadastrada")` SEM provider. O componente <Avisos /> (montado uma vez no layout)
 * desenha a lista. Regra de ouro: só chame `sucesso` DEPOIS que a operação foi concluída de fato.
 */
import { useSyncExternalStore } from "react";

export type TipoAviso = "sucesso" | "erro" | "aviso" | "info";

export type Aviso = { id: number; tipo: TipoAviso; titulo: string; detalhe?: string; duracao: number };

const MAXIMO_NA_TELA = 4;
const JANELA_DUPLICADO_MS = 1500;
const DURACAO: Record<TipoAviso, number> = { sucesso: 4000, info: 4500, aviso: 7000, erro: 8000 };

let lista: Aviso[] = [];
let proximoId = 1;
const ouvintes = new Set<() => void>();
const ultimoPorChave = new Map<string, number>();

const notificar = () => ouvintes.forEach((f) => f());

function emitir(tipo: TipoAviso, titulo: string, detalhe?: string): number {
  const chave = `${tipo}|${titulo}|${detalhe ?? ""}`;
  const agora = Date.now();
  const anterior = ultimoPorChave.get(chave);
  // Mesma mensagem disparada duas vezes em seguida (clique duplo, efeito repetido): mostra uma só
  if (anterior !== undefined && agora - anterior < JANELA_DUPLICADO_MS) {
    return lista.find((a) => `${a.tipo}|${a.titulo}|${a.detalhe ?? ""}` === chave)?.id ?? 0;
  }
  ultimoPorChave.set(chave, agora);
  if (ultimoPorChave.size > 50) ultimoPorChave.clear();

  const aviso: Aviso = { id: proximoId++, tipo, titulo, detalhe, duracao: DURACAO[tipo] };
  lista = [...lista, aviso].slice(-MAXIMO_NA_TELA);
  notificar();
  return aviso.id;
}

export const avisos = {
  sucesso: (titulo: string, detalhe?: string) => emitir("sucesso", titulo, detalhe),
  erro: (titulo: string, detalhe?: string) => emitir("erro", titulo, detalhe),
  aviso: (titulo: string, detalhe?: string) => emitir("aviso", titulo, detalhe),
  info: (titulo: string, detalhe?: string) => emitir("info", titulo, detalhe),
  fechar(id: number) {
    if (!lista.some((a) => a.id === id)) return;
    lista = lista.filter((a) => a.id !== id);
    notificar();
  },
};

const inscrever = (f: () => void) => {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
};
const VAZIO: Aviso[] = [];

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(inscrever, () => lista, () => VAZIO);
}

/** Traduz erros técnicos (Supabase/rede) para uma frase que o usuário entende, com o que fazer em seguida. */
export function explicarFalha(erro: unknown): string {
  const e = (erro ?? {}) as { message?: string; code?: string; status?: number };
  const msg = String(e.message ?? (typeof erro === "string" ? erro : "") ?? "");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg) || (typeof navigator !== "undefined" && navigator.onLine === false))
    return "Sem conexão com a internet. Confira sua rede e tente de novo.";
  if (/jwt|not authenticated|sessão|session|refresh token/i.test(msg) || e.status === 401)
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (e.code === "42501" || /row-level security|permission denied/i.test(msg))
    return "Você não tem permissão para fazer isso.";
  if (e.code === "23505" || /duplicate key/i.test(msg)) return "Já existe um registro igual a esse.";
  if (e.code === "23503") return "Este item está ligado a outros registros e não pôde ser alterado.";
  if (e.code === "23502" || e.code === "22P02" || e.code === "23514") return "Algum campo está vazio ou com valor inválido. Confira e tente de novo.";
  if (e.code === "PGRST204" || e.code === "42703" || e.code === "PGRST202" || e.code === "42883" || e.code === "42P01")
    return "O banco de dados ainda não tem uma atualização necessária. Execute os scripts SQL mais recentes do projeto no Supabase.";
  return msg || "Algo deu errado. Tente novamente em instantes.";
}

/** Atalho para o caso mais comum: "Não foi possível <ação>" + explicação. */
export function falhou(acao: string, erro: unknown) {
  console.error(`Erro ao ${acao}:`, erro);
  return avisos.erro(`Não foi possível ${acao}`, explicarFalha(erro));
}
