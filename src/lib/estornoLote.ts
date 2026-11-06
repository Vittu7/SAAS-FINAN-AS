/**
 * Estorno em lote de repasses confirmados (regras puras, sem React e sem Supabase).
 * Não cria fluxo paralelo: o estorno continua sendo a ação "reabrir" de atualizar_repasse; aqui só se decide
 * QUEM entra na seleção e QUEM está bloqueado (mês fechado), para a tela mostrar antes de confirmar.
 */
import { arred } from "./calculos";
import type { LancGrupo } from "./grupo";

type Alvo = Pick<LancGrupo, "chave" | "autorId" | "respId" | "repassePago">;

/** Só quem recebeu (autor) estorna, e só repasse confirmado (nunca um já estornado, nunca o próprio gasto). */
export const elegivelParaEstorno = (l: Alvo, meuId: string): boolean =>
  Boolean(meuId) && l.repassePago && l.autorId === meuId && l.autorId !== l.respId;

export type PlanoEstorno<T extends Alvo> = {
  /** Podem ser estornados agora */
  liberados: T[];
  /** Bloqueados (ex.: mês fechado), com o motivo para mostrar ao usuário */
  bloqueados: { item: T; motivo: string }[];
  /** Fora da seleção por não valerem (já estornados, de outro autor ou repetidos) */
  ignorados: T[];
  total: number;
};

/**
 * Separa o que será estornado do que está bloqueado. `verificar` devolve o motivo do bloqueio (ou null) e normalmente
 * é a mesma verificação das travas de fechamento usada nos estornos individuais.
 */
export function planoDeEstorno<T extends Alvo & { valor: number }>(itens: T[], meuId: string, verificar?: (l: T) => string | null): PlanoEstorno<T> {
  const vistos = new Set<string>();
  const liberados: T[] = [];
  const bloqueados: { item: T; motivo: string }[] = [];
  const ignorados: T[] = [];
  for (const l of itens) {
    if (vistos.has(l.chave) || !elegivelParaEstorno(l, meuId)) { ignorados.push(l); continue; }
    vistos.add(l.chave);
    const motivo = verificar ? verificar(l) : null;
    if (motivo) bloqueados.push({ item: l, motivo });
    else liberados.push(l);
  }
  return { liberados, bloqueados, ignorados, total: arred(liberados.reduce((t, l) => t + l.valor, 0)) };
}
