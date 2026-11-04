/**
 * Cartão unificado: um mesmo cartão (ex.: Nubank) pode ter CRÉDITO (limite/fatura) e DÉBITO (saldo).
 * No banco continuam sendo duas formas de pagamento ligadas pelo nome ("Nubank Crédito" e "Nubank Débito"),
 * mas na hora de lançar a pessoa escolhe UM cartão e depois "Crédito" ou "Débito".
 */
import { tipoDaConta } from "./contas";
import type { TipoCartao } from "./contas";
import { COR_PADRAO } from "./useOpcoes";

/** Fundo padrão dos cartões de crédito em todos os módulos (mesma cor cadastrada em Configurações). */
export function gradienteCartao(cor?: string | null) {
  return `linear-gradient(135deg, ${cor || COR_PADRAO}, #0f172a)`;
}

type Forma = { id: string; nome: string; cor: string; tipo_cartao?: string | null; eh_cartao?: boolean | null };

/** "Nubank Crédito" / "Nubank Débito" → "Nubank". */
export const nomeBaseCartao = (nome: string) => nome.replace(/\s+(Crédito|Débito)$/i, "").trim();
const chave = (nome: string) => nomeBaseCartao(nome).toLocaleLowerCase("pt-BR");

export type VariantesCartao = Partial<Record<TipoCartao, Forma>>;

/** Variantes (crédito e/ou débito) de cada cartão, agrupadas pelo nome base. */
export function variantesPorCartao<T extends Forma>(formas: T[]): Map<string, Partial<Record<TipoCartao, T>>> {
  const mapa = new Map<string, Partial<Record<TipoCartao, T>>>();
  for (const f of formas) {
    const tipo = tipoDaConta(f);
    if (!tipo) continue;
    const k = chave(f.nome);
    mapa.set(k, { ...(mapa.get(k) ?? {}), [tipo]: f });
  }
  return mapa;
}

/** Lista para o seletor: cartões com crédito E débito viram uma única entrada (o nome base). */
export function unificarCartoes<T extends Forma>(formas: T[]): T[] {
  const variantes = variantesPorCartao(formas);
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const f of formas) {
    const v = variantes.get(chave(f.nome));
    if (tipoDaConta(f) && v?.credito && v?.debito) {
      const k = chave(f.nome);
      if (vistos.has(k)) continue;
      vistos.add(k);
      saida.push({ ...f, id: `cartao:${k}`, nome: nomeBaseCartao(f.nome), tipo_cartao: null, eh_cartao: false });
    } else saida.push(f);
  }
  return saida;
}

/** Nome mostrado no seletor para a forma escolhida (o nome base, se ela faz parte de um cartão unificado). */
export function nomeNoSeletor(formas: Forma[], escolhida: string): string {
  const f = formas.find((x) => x.nome === escolhida);
  if (!f || !tipoDaConta(f)) return escolhida;
  const v = variantesPorCartao(formas).get(chave(f.nome));
  return v?.credito && v?.debito ? nomeBaseCartao(f.nome) : escolhida;
}

/** Forma real a usar quando a pessoa escolhe `nomeSeletor` (e, se for cartão unificado, o tipo preferido). */
export function formaEscolhida(formas: Forma[], nomeSeletor: string, preferido: TipoCartao): string {
  const v = variantesPorCartao(formas).get(nomeSeletor.toLocaleLowerCase("pt-BR"));
  const exato = formas.find((f) => f.nome === nomeSeletor);
  if (exato && !(v?.credito && v?.debito && !tipoDaConta(exato))) return exato.nome;
  return (v?.[preferido] ?? v?.credito ?? v?.debito)?.nome ?? nomeSeletor;
}
