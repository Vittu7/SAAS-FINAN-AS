/**
 * Lançamento com repasse confirmado não pode ser editado nem excluído até o estorno (regra 3; o banco impõe a mesma
 * regra no trigger lancamento_trava_repasse_confirmado). Em vez de só um aviso de erro, a tela abre uma orientação
 * (RepasseTravadoModal) que explica o que fazer e leva até Grupo → Repasses.
 *
 * É um repositório simples fora do React (mesmo padrão de avisos.ts): o store de dados chama `pedirOrientacaoRepasse`
 * sem provider e o modal, montado uma vez na página, desenha. Aqui nada é estornado, editado ou excluído.
 */
import { useSyncExternalStore } from "react";
import { lancamentosDoGrupo, type LancGrupo } from "./grupo";

export type TabelaRepasse = "extrato" | "cartao" | "contas";

export type OrientacaoRepasse = {
  acao: "editar" | "excluir";
  /** Repasse(s) confirmado(s) que travam o lançamento; vazio se os dados não bastaram para identificá-lo. */
  repasses: LancGrupo[];
  /** Lançamentos travados da mesma série (compra parcelada ou conta fixa) além do mostrado. */
  outrosDaSerie: number;
};

/** O erro do banco é a trava de repasse confirmado? */
export const ehTravaDeRepasse = (erro: unknown): boolean =>
  /repasse confirmado/i.test(String((erro as { message?: string } | null)?.message ?? ""));

export type LinhaRepasse = { id?: unknown; repasse_pago?: unknown; repassePago?: unknown };
type Linha = LinhaRepasse;

/**
 * Monta a orientação a partir dos lançamentos da tela. `ids` são os que se quer alterar (vários numa série).
 * Só entram os que de fato têm repasse confirmado.
 */
export function montarOrientacaoRepasse(
  tabela: TabelaRepasse,
  itens: Linha[],
  ids: (string | number)[],
  acao: "editar" | "excluir",
): OrientacaoRepasse {
  const alvo = new Set(ids.map(String));
  const travados = itens.filter((i) => alvo.has(String(i.id)) && Boolean(i.repassePago ?? i.repasse_pago));
  const repasses = lancamentosDoGrupo({ [tabela]: travados }).filter((l) => l.repassePago);
  // o lançamento clicado vem primeiro; o resto da série só entra como contagem
  const principal = repasses.find((l) => alvo.size === 1 || l.id === String(ids[0])) ?? repasses[0];
  return { acao, repasses: principal ? [principal] : [], outrosDaSerie: Math.max(0, travados.length - (principal ? 1 : 0)) };
}

/* ---------- repositório ---------- */
let atual: OrientacaoRepasse | null = null;
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((f) => f());

export function pedirOrientacaoRepasse(o: OrientacaoRepasse) {
  atual = o;
  notificar();
}
export function fecharOrientacaoRepasse() {
  if (!atual) return;
  atual = null;
  notificar();
}
const inscrever = (f: () => void) => {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
};
export function useOrientacaoRepasse(): OrientacaoRepasse | null {
  return useSyncExternalStore(inscrever, () => atual, () => null);
}
