/**
 * Descobre todas as linhas da MESMA série para excluir de todos os meses:
 * - conta fixa: mesmo `serie_id` (criado junto com a conta e copiado a cada mês); sem ele, mesmo autor,
 *   responsável, nome, forma de pagamento e categoria;
 * - compra parcelada: mesmo autor, cartão, descrição, total de parcelas e responsável, e mesmo mês de origem
 *   (mês − parcela atual + 1). Valor e categoria podem ter sido editados numa parcela e não separam a série.
 */
import { addMeses } from "./finance";

type Linha = Record<string, any>;
const norm = (v: unknown) => String(v ?? "").trim().toLocaleLowerCase("pt-BR");

export function idsDaSerieCartao(todas: Linha[], id: string): string[] {
  const base = todas.find((c) => c.id === id);
  if (!base) return [id];
  const origem = (c: Linha) => addMeses(String(c.mes), 1 - (Number(c.parcela_atual ?? c.parcelaAtual) || 1));
  const alvo = origem(base);
  return todas
    .filter(
      (c) =>
        c.owner_id === base.owner_id &&
        norm(c.cartao) === norm(base.cartao) &&
        norm(c.nome ?? c.descricao) === norm(base.nome ?? base.descricao) &&
        Number(c.parcela_total ?? c.parcelaTotal) === Number(base.parcela_total ?? base.parcelaTotal) &&
        (c.responsavel_id ?? null) === (base.responsavel_id ?? null) &&
        origem(c) === alvo,
    )
    .map((c) => c.id);
}

export function idsDaSerieConta(todas: Linha[], id: string): string[] {
  const base = todas.find((c) => c.id === id);
  if (!base) return [id];
  if (base.serie_id) return todas.filter((c) => c.serie_id === base.serie_id && c.owner_id === base.owner_id).map((c) => c.id);
  const forma = (c: Linha) => norm(c.forma_pagamento ?? c.formaPagamento);
  return todas
    .filter(
      (c) =>
        !c.serie_id &&
        c.owner_id === base.owner_id &&
        (c.responsavel_id ?? null) === (base.responsavel_id ?? null) &&
        norm(c.nome) === norm(base.nome) &&
        forma(c) === forma(base) &&
        norm(c.categoria) === norm(base.categoria),
    )
    .map((c) => c.id);
}
