/**
 * PAGAMENTO DE FATURA DO CARTÃO DE CRÉDITO.
 *
 * - A compra no crédito já é despesa (no mês dela, do responsável). O pagamento da fatura NUNCA é despesa:
 *   só tira dinheiro da conta usada (saldo da conta) e quita a fatura (total − pago = restante).
 * - Cada pagamento tem identificação própria (id gerado uma vez no formulário): reenviar o mesmo id não duplica.
 * - Total Disponível (painel): as compras do titular dele mesmo continuam saindo no mês da compra (despesa).
 *   As compras que o titular fez para OUTRA pessoa (responsável diferente) só tiram dinheiro quando a fatura é
 *   paga: até lá são um compromisso ("fatura em aberto"), e o repasse recebido é entrada real. Como a fatura mistura
 *   compras próprias e de terceiros, cada pagamento é dividido na proporção da fatura (parte de terceiros / total).
 */
import { arred, ehEntrada, mesEmBrasilia, semDuplicados } from "./calculos";
import type { Estado } from "./types";

/** Fatura de um cartão em um mês: soma tudo o que o grupo lançou nele (que o usuário pode ver). */
export function calcularFatura(estado: Estado, nome: string, mes: string, limite: number) {
  const parcelas = estado.cartao.filter(i => i.cartao === nome && i.mes === mes).map(i => ({ id: `cartao:${i.id}`, descricao: i.descricao || i.nome, categoria: i.categoria, responsavel: i.responsavel, responsavelAvatar: (i as any).responsavelAvatar, responsavelCor: (i as any).responsavelCor, valor: Number(i.valor) || 0, detalhe: `${i.parcelaAtual}/${i.parcelaTotal}` }));
  const compras = estado.extrato.filter(i => i.pagamento === nome && i.mes === mes).map(i => ({ id: `extrato:${i.id}`, descricao: i.descricao, categoria: i.categoria, responsavel: i.responsavel, responsavelAvatar: (i as any).responsavelAvatar, responsavelCor: (i as any).responsavelCor, valor: Number(i.valor) || 0, detalhe: 'Compra' }));
  const contas = estado.contas.filter(i => (i.formaPagamento || (i as typeof i & { forma_pagamento?: string }).forma_pagamento) === nome && i.mes === mes).map(i => ({ id: `contas:${i.id}`, descricao: i.nome, categoria: i.categoria || '', responsavel: i.responsavel, responsavelAvatar: (i as any).responsavelAvatar, responsavelCor: (i as any).responsavelCor, valor: Number(i.valor) || 0, detalhe: 'Conta fixa' }));
  const itens = [...parcelas, ...compras, ...contas];
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return { itens, total, disponivel: Math.max(0, limite - total), excedido: Math.max(0, total - limite) };
}

type Item = Record<string, any>;
type Dados = { extrato?: Item[]; cartao?: Item[]; contas?: Item[] };
const num = (v: unknown) => Number(v) || 0;

export type PagamentoFatura = {
  id: string;
  /** nome do cartão de crédito (forma de pagamento) */
  cartao: string;
  /** mês da fatura paga (AAAA-MM) */
  mes: string;
  /** conta de débito de onde saiu o dinheiro */
  conta: string;
  valor: number;
  /** data do pagamento (AAAA-MM-DD) */
  data: string;
};

export type SituacaoFatura = "aberta" | "parcial" | "paga";

export type ResumoFatura = { total: number; pago: number; restante: number; situacao: SituacaoFatura };

export const pagamentosDaFatura = (lista: PagamentoFatura[], cartao: string, mes: string) =>
  lista.filter((p) => p.cartao === cartao && p.mes === mes).sort((a, b) => a.data.localeCompare(b.data));

export function resumoFatura(total: number, pagamentos: PagamentoFatura[]): ResumoFatura {
  const t = arred(num(total));
  const pago = arred(pagamentos.reduce((s, p) => s + num(p.valor), 0));
  const restante = Math.max(0, arred(t - pago));
  const situacao: SituacaoFatura = t > 0 && restante === 0 ? "paga" : pago > 0 ? "parcial" : "aberta";
  return { total: t, pago, restante, situacao };
}

export const ROTULO_SITUACAO: Record<SituacaoFatura, string> = { aberta: "Aberta", parcial: "Parcialmente paga", paga: "Paga" };

/** Mensagem de erro ou null quando o pagamento pode ser feito. */
export function validarPagamento(valor: number, restante: number, opts: { conta?: string; id?: string; existentes?: PagamentoFatura[] } = {}): string | null {
  if (opts.id && opts.existentes?.some((p) => p.id === opts.id)) return "Este pagamento já foi registrado.";
  if (!(valor > 0)) return "Informe um valor maior que zero.";
  if (restante <= 0) return "Esta fatura já está paga.";
  if (arred(valor) > arred(restante)) return `O valor não pode ser maior que o restante da fatura.`;
  if (opts.conta !== undefined && !opts.conta) return "Escolha a conta de onde sairá o dinheiro.";
  return null;
}

/** Vencimento (AAAA-MM-DD) da fatura de `mes` para o dia informado; dia 31 em mês curto vira o último dia. */
export function vencimentoDaFatura(mes: string, dia: number | null | undefined): string | null {
  const d = Math.trunc(num(dia));
  if (!/^\d{4}-\d{2}$/.test(mes) || d < 1 || d > 31) return null;
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return `${mes}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

export type FaturaAberta = { cartao: string; mes: string; total: number; pago: number; restante: number };

/**
 * Faturas com valor a pagar (informativo, para o bloco "Ainda vai sair" do Resumo).
 * A conta fixa pendente lançada no cartão fica de fora: ela já aparece como conta pendente e só entra na fatura
 * quando é marcada como paga. Assim o mesmo valor nunca aparece duas vezes.
 */
export function faturasEmAberto(estado: Estado, cartoes: string[], pagamentos: PagamentoFatura[], meses: string[]): FaturaAberta[] {
  const lista: FaturaAberta[] = [];
  for (const cartao of cartoes) {
    for (const mes of meses) {
      const pendentes = estado.contas
        .filter((c) => (c.formaPagamento || (c as typeof c & { forma_pagamento?: string }).forma_pagamento) === cartao && c.mes === mes && !c.pago)
        .reduce((s, c) => s + num(c.valor), 0);
      const total = arred(calcularFatura(estado, cartao, mes, 0).total - pendentes);
      if (total <= 0) continue;
      const r = resumoFatura(total, pagamentosDaFatura(pagamentos, cartao, mes));
      if (r.restante > 0) lista.push({ cartao, mes, total: r.total, pago: r.pago, restante: r.restante });
    }
  }
  return lista;
}

const nomeDoCartao = (origem: "extrato" | "cartao" | "contas", i: Item): string =>
  String((origem === "cartao" ? i.cartao : origem === "extrato" ? i.pagamento : i.formaPagamento ?? i.forma_pagamento) ?? "");

/**
 * Parcela é do crédito quando tem cartão; a partir do mês de corte (regra de caixa) só se esse cartão é de crédito cadastrado.
 * Parcela em "DEBITO" ou em forma sem cartão não tem fatura para pagar: o dinheiro saiu na compra, como qualquer despesa.
 * Meses antes do corte seguem como sempre (histórico preservado). À vista e conta fixa: só se a forma é cartão de crédito.
 */
function ehNoCredito(origem: "extrato" | "cartao" | "contas", i: Item, cartao: string, cartoesCredito: Set<string>): boolean {
  if (origem !== "cartao") return cartoesCredito.has(cartao);
  if (!cartao) return false;
  return String(i.mes) < MES_CORTE_CAIXA || cartoesCredito.has(cartao);
}

/** Itens lançados no crédito (parcelas sempre; à vista e contas fixas quando a forma é um cartão de crédito). */
function itensNoCredito(e: Dados, cartoesCredito: Set<string>) {
  const lista: { origem: "extrato" | "cartao" | "contas"; item: Item; cartao: string }[] = [];
  for (const origem of ["extrato", "cartao", "contas"] as const) {
    for (const item of semDuplicados(e[origem] || [], origem)) {
      if (ehEntrada(item) || item.repasseSintetico) continue;
      const cartao = nomeDoCartao(origem, item);
      if (ehNoCredito(origem, item, cartao, cartoesCredito)) lista.push({ origem, item, cartao });
    }
  }
  return lista;
}

/** Item no crédito do titular (eu) que foi feito para OUTRA pessoa: o dinheiro só sai quando a fatura é paga. */
export function compraDeTerceirosNoCredito(origem: "extrato" | "cartao" | "contas", i: Item, meuId: string | null | undefined, cartoesCredito: Set<string>): boolean {
  if (!meuId || ehEntrada(i) || i.repasseSintetico) return false;
  if (i.owner_id !== meuId || !i.responsavel_id || i.responsavel_id === meuId) return false;
  return ehNoCredito(origem, i, nomeDoCartao(origem, i), cartoesCredito);
}

/**
 * Mês de corte da REGRA DE CAIXA do crédito (decisão do responsável). Faturas de meses anteriores ficam como estavam
 * (histórico preservado: não há pagamentos antigos registrados e nenhum é inventado).
 */
export const MES_CORTE_CAIXA = "2026-10";

export type AjusteFaturas = {
  /** mês → compras no crédito (de terceiros; e, a partir do mês de corte, também as do próprio titular) cujo responsável está DENTRO da visão, já nas saídas; somam de volta no mês da compra */
  emAberto: Record<string, number>;
  /** mês do pagamento → parte de terceiros dos pagamentos de faturas ANTERIORES ao corte (proporcional; regra antiga) */
  pago: Record<string, number>;
  /** mês do pagamento → valor inteiro pago de faturas a partir do corte (parcial = o que foi pago); tira do disponível */
  pagoCaixa: Record<string, number>;
  /**
   * mês do pagamento → repasses JÁ CONFIRMADOS de compras de terceiros no crédito (responsável fora da visão) que
   * compensam nesse pagamento, proporcional ao valor pago (só a partir do corte). Sem pagamento da fatura, nada entra.
   */
  recebido: Record<string, number>;
};

/**
 * Efeito dos pagamentos de fatura no Total Disponível.
 * `dados` = TODOS os lançamentos (sem filtro de pessoas). `escopo` = ids da visão (null = todo o grupo).
 * Só vale para as faturas do próprio usuário (`meuId`), que são as que ele consegue pagar no app.
 */
export function ajusteDeFaturas(
  dados: Dados,
  pagamentos: PagamentoFatura[],
  opts: {
    meuId?: string | null;
    escopo?: Set<string> | null;
    cartoesCredito?: Set<string>;
    /**
     * REGRA DE CAIXA (a partir deste mês, AAAA-MM): compra no crédito do titular só tira dinheiro quando a fatura é paga,
     * e o repasse de compra de terceiros no crédito só compensa quando a fatura é paga. Sem o campo, vale a regra antiga.
     */
    mesCorte?: string | null;
  },
): AjusteFaturas {
  const r: AjusteFaturas = { emAberto: {}, pago: {}, pagoCaixa: {}, recebido: {} };
  const { meuId, escopo = null } = opts;
  const cartoesCredito = opts.cartoesCredito ?? new Set<string>();
  if (!meuId || (escopo && !escopo.has(meuId))) return r;
  const corte = opts.mesCorte ?? null;
  const caixa = (mes: string) => corte !== null && mes >= corte;
  const noCredito = itensNoCredito(dados, cartoesCredito);
  const terceiros = noCredito.filter((x) => compraDeTerceirosNoCredito(x.origem, x.item, meuId, cartoesCredito));
  const ehTerceiro = (x: (typeof noCredito)[number]) => terceiros.includes(x);
  // Conta fixa ainda não paga fica reservada (faltaPagar) e não entra na fatura: só conta depois de paga
  const pendente = (x: (typeof noCredito)[number]) => x.origem === "contas" && !x.item.pago;
  const responsavelDe = (x: (typeof noCredito)[number]) => String(x.item.responsavel_id ?? x.item.owner_id ?? "");

  for (const x of noCredito) {
    const mes = String(x.item.mes);
    if (ehTerceiro(x)) {
      if (escopo && !escopo.has(String(x.item.responsavel_id))) continue; // fora da visão: nunca esteve nas saídas
      if (caixa(mes) && pendente(x)) continue;
    } else if (!(caixa(mes) && x.item.owner_id === meuId && !pendente(x) && (!escopo || escopo.has(responsavelDe(x))))) {
      continue; // compra própria no crédito só soma de volta com a regra de caixa (e só as minhas, no meu cartão)
    }
    r.emAberto[mes] = arred((r.emAberto[mes] || 0) + num(x.item.valor));
  }
  for (const p of pagamentos) {
    const mesPag = p.data.slice(0, 7);
    if (caixa(p.mes)) {
      // Fatura da regra de caixa: o valor pago inteiro sai do disponível, no mês do pagamento
      r.pagoCaixa[mesPag] = arred((r.pagoCaixa[mesPag] || 0) + num(p.valor));
      const daFatura = noCredito.filter((x) => x.cartao === p.cartao && String(x.item.mes) === p.mes && x.item.owner_id === meuId && !pendente(x));
      const total = daFatura.reduce((s, x) => s + num(x.item.valor), 0);
      if (total <= 0) continue;
      // Repasse confirmado de compra de terceiros (responsável fora da visão) compensa na proporção do que foi pago.
      // Nunca antes de a confirmação existir: se o repasse foi confirmado depois do pagamento, entra no mês da
      // confirmação (assim um mês já passado, e talvez fechado, nunca muda por uma confirmação posterior).
      for (const x of daFatura) {
        if (!(ehTerceiro(x) && escopo && !escopo.has(String(x.item.responsavel_id)) && Boolean(x.item.repasse_pago ?? x.item.repassePago))) continue;
        const confirmadoEm = mesEmBrasilia(x.item.repasse_pago_em ?? x.item.repassePagoEm, mesPag);
        const mesEntrada = confirmadoEm > mesPag ? confirmadoEm : mesPag;
        r.recebido[mesEntrada] = arred((r.recebido[mesEntrada] || 0) + (num(p.valor) * num(x.item.valor)) / total);
      }
      continue;
    }
    const daFatura = noCredito.filter((x) => x.cartao === p.cartao && String(x.item.mes) === p.mes);
    const total = daFatura.reduce((s, x) => s + num(x.item.valor), 0);
    const deTerceiros = daFatura.filter(ehTerceiro).reduce((s, x) => s + num(x.item.valor), 0);
    if (total <= 0 || deTerceiros <= 0) continue;
    r.pago[mesPag] = arred((r.pago[mesPag] || 0) + (num(p.valor) * deTerceiros) / total);
  }
  return r;
}
