/**
 * FECHAMENTO MENSAL — regras puras (sem React e sem Supabase).
 *
 * - O controle começa num mês inicial escolhido pela pessoa. Meses anteriores ficam como "histórico" (como hoje).
 * - O mês em aberto é o primeiro mês, desde o inicial, que ainda não foi fechado. Os fechados formam sempre uma
 *   sequência contínua, porque só se fecha o mês em aberto e só se reabre o último fechado.
 * - Só dá para fechar um mês que já terminou (data de hoje no horário de Brasília, informada por quem chama).
 * - Meses depois do mês em aberto que já começaram ficam "em espera"; meses futuros são "previsão".
 * - Um lançamento fica travado se QUEM LANÇOU ou O RESPONSÁVEL fechou aquele mês. Convidado não fecha mês.
 * - Fechar não paga contas nem confirma repasses.
 * A garantia definitiva fica no banco (supabase-18-fechamento-mensal.sql); estas regras dão a mensagem antes.
 */
import { addMeses, rotuloMes } from "./finance";

export type StatusMes = "historico" | "fechado" | "aberto" | "espera" | "previsao";
export type EstadoFechamento = { mesInicial: string | null; fechados: Set<string> };
export type Retrato = {
  entrou: number;
  saiu: number;
  resultado: number;
  disponivel: number;
  contasPendentes: number;
  receber: number;
  repassar: number;
  sobraPrevista: number;
};
export type EventoFechamento = { mes: string; tipo: "fechamento" | "reabertura"; em: string; por: string | null; motivo: string | null };

export const ROTULO_STATUS: Record<StatusMes, string> = {
  historico: "Histórico",
  fechado: "Fechado",
  aberto: "Em aberto",
  espera: "Em espera",
  previsao: "Previsão",
};

const nomeMes = (mes: string) => rotuloMes(mes).split(" de ")[0].toLowerCase();

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

export const mesTerminou = (mes: string, hoje: string) => mes < hoje.slice(0, 7);

/** Primeiro mês, desde o inicial, que não está fechado. Null quando o controle não foi ativado. */
export function mesDeTrabalho(e: EstadoFechamento): string | null {
  if (!e.mesInicial) return null;
  let m = e.mesInicial;
  for (let n = 0; e.fechados.has(m) && n < 600; n++) m = addMeses(m, 1);
  return m;
}

export function statusDoMes(mes: string, e: EstadoFechamento, hoje: string): StatusMes {
  if (!e.mesInicial || mes < e.mesInicial) return "historico";
  if (e.fechados.has(mes)) return "fechado";
  const t = mesDeTrabalho(e)!;
  if (mes === t) return "aberto";
  return mes <= hoje.slice(0, 7) ? "espera" : "previsao";
}

type Ok = { ok: true } | { ok: false; motivo: string };

export function podeFechar(mes: string, e: EstadoFechamento, hoje: string): Ok {
  if (!e.mesInicial) return { ok: false, motivo: "Ative o fechamento mensal primeiro." };
  if (e.fechados.has(mes)) return { ok: false, motivo: `${rotuloMes(mes)} já está fechado.` };
  if (mes < e.mesInicial) return { ok: false, motivo: `${rotuloMes(mes)} é anterior ao início do fechamento mensal.` };
  const t = mesDeTrabalho(e)!;
  if (mes !== t) return { ok: false, motivo: `Feche ${nomeMes(t)} antes.` };
  if (!mesTerminou(mes, hoje)) return { ok: false, motivo: `${rotuloMes(mes)} ainda não terminou. O fechamento fica disponível a partir de 1º de ${nomeMes(addMeses(mes, 1))}.` };
  return { ok: true };
}

export function ultimoFechado(e: EstadoFechamento): string | null {
  let ultimo: string | null = null;
  for (const m of e.fechados) if (!ultimo || m > ultimo) ultimo = m;
  return ultimo;
}

export function podeReabrir(mes: string, e: EstadoFechamento): Ok {
  if (!e.fechados.has(mes)) return { ok: false, motivo: `${rotuloMes(mes)} não está fechado.` };
  const u = ultimoFechado(e)!;
  if (mes !== u) return { ok: false, motivo: `Para reabrir ${nomeMes(mes)}, reabra antes ${nomeMes(u)}.` };
  return { ok: true };
}

export const MOTIVO_MINIMO = 10;
export function validarMotivo(motivo: string): string | null {
  return motivo.trim().length >= MOTIVO_MINIMO ? null : `Explique o motivo com pelo menos ${MOTIVO_MINIMO} letras.`;
}

/** Meses fechados por pessoa (id do perfil → meses). Quem não aparece (ex.: convidado) não fechou nada. */
export type FechadosPorPessoa = Map<string, Set<string>>;

/**
 * Lançamento travado? Considera o mês atual do lançamento e, numa edição, o mês para onde ele iria.
 * Trava se quem lançou ou o responsável fechou o mês.
 */
export function travaDoLancamento(
  item: { mes?: string | null; owner_id?: string | null; responsavel_id?: string | null },
  porPessoa: FechadosPorPessoa,
  mesNovo?: string | null,
): { travado: boolean; quem: string[] } {
  const pessoas = [item.owner_id, item.responsavel_id].filter((x): x is string => Boolean(x));
  const meses = [item.mes, mesNovo].filter((x): x is string => Boolean(x));
  const quem = new Set<string>();
  for (const p of pessoas) for (const m of meses) if (porPessoa.get(p)?.has(m)) quem.add(p);
  return { travado: quem.size > 0, quem: [...quem] };
}

/** Estorno (reabrir repasse confirmado) muda o mês em que o repasse foi confirmado: bloqueado se esse mês está fechado. */
export function travaDoEstorno(
  item: { owner_id?: string | null; responsavel_id?: string | null; repasse_pago?: boolean | null; repasse_pago_em?: string | null },
  porPessoa: FechadosPorPessoa,
): { travado: boolean; quem: string[] } {
  if (!item.repasse_pago || !item.repasse_pago_em) return { travado: false, quem: [] };
  const mes = hojeEmBrasilia(new Date(item.repasse_pago_em)).slice(0, 7);
  return travaDoLancamento({ mes, owner_id: item.owner_id, responsavel_id: item.responsavel_id }, porPessoa);
}

/** Lançamento NOVO no mês: proibido em mês fechado e em meses depois do mês em aberto. */
export function bloqueioParaLancar(mes: string, e: EstadoFechamento, hoje: string): string | null {
  const s = statusDoMes(mes, e, hoje);
  if (s === "fechado") return `${rotuloMes(mes)} está fechado. Para lançar nele, reabra o mês.`;
  if (s === "espera" || s === "previsao") {
    const t = mesDeTrabalho(e)!;
    return `Feche ${nomeMes(t)} para começar a lançar em ${nomeMes(mes)}.`;
  }
  return null;
}

type ItemLanc = { mes?: string | null; owner_id?: string | null; responsavel_id?: string | null; repasse_pago?: boolean | null; repasse_pago_em?: string | null };
export type ContextoTrava = { estado: EstadoFechamento; porPessoa: FechadosPorPessoa; hoje: string; meuId: string; nomes: Map<string, string> };
export type Alteracao =
  | { tipo: "novo"; mes: string; responsavelId?: string | null }
  | { tipo: "editar"; item: ItemLanc; mesNovo?: string | null }
  | { tipo: "remover"; itens: ItemLanc[] }
  | { tipo: "pagar"; item: ItemLanc }
  | { tipo: "estornar"; itens: ItemLanc[] };

const quemFechou = (quem: string[], mes: string, ctx: ContextoTrava) => {
  if (quem.includes(ctx.meuId)) return `${rotuloMes(mes)} está fechado. Reabra o mês para alterar.`;
  const nomes = quem.map((q) => ctx.nomes.get(q) || "Outro membro").join(" e ");
  return `${nomes} já fechou ${nomeMes(mes)}. Peça para reabrir o mês antes de alterar.`;
};

/**
 * Mensagem para o usuário quando a alteração mexe em mês fechado (ou null se pode seguir).
 * É só o aviso antecipado: o banco recusa a mesma operação pelas travas da migração 18.
 */
export function verificarAlteracao(a: Alteracao, ctx: ContextoTrava): string | null {
  if (a.tipo === "novo") {
    const proprio = bloqueioParaLancar(a.mes, ctx.estado, ctx.hoje);
    if (proprio) return proprio;
    if (a.responsavelId && ctx.porPessoa.get(a.responsavelId)?.has(a.mes)) return quemFechou([a.responsavelId], a.mes, ctx);
    return null;
  }
  if (a.tipo === "editar" || a.tipo === "pagar") {
    const mesNovo = a.tipo === "editar" ? a.mesNovo : null;
    const t = travaDoLancamento(a.item, ctx.porPessoa, mesNovo);
    if (!t.travado) return null;
    const mes = a.item.mes && t.quem.some((q) => ctx.porPessoa.get(q)?.has(a.item.mes!)) ? a.item.mes : mesNovo || a.item.mes || "";
    return quemFechou(t.quem, mes, ctx);
  }
  if (a.tipo === "remover") {
    const travados = a.itens.filter((i) => travaDoLancamento(i, ctx.porPessoa).travado);
    if (travados.length === 0) return null;
    const meses = [...new Set(travados.map((i) => String(i.mes)))].sort();
    return `Há lançamentos desta série em meses fechados (${meses.map(nomeMes).join(", ")}). Reabra o mês para excluir.`;
  }
  for (const i of a.itens) {
    const t = travaDoEstorno(i, ctx.porPessoa);
    if (t.travado) return `Este repasse foi confirmado em um mês fechado. ${quemFechou(t.quem, hojeEmBrasilia(new Date(i.repasse_pago_em!)).slice(0, 7), ctx)}`;
  }
  return null;
}

const CAMPOS: (keyof Retrato)[] = ["entrou", "saiu", "resultado", "disponivel", "contasPendentes", "receber", "repassar", "sobraPrevista"];

/** Campos do retrato que mudaram desde o fechamento (deveria ser vazio: o banco trava as alterações). */
export function diferencasDoRetrato(retrato: Retrato, atual: Retrato): (keyof Retrato)[] {
  return CAMPOS.filter((k) => Math.abs((Number(retrato[k]) || 0) - (Number(atual[k]) || 0)) >= 0.005);
}
