/**
 * FINANCEIRO DO GRUPO — visão de quem CRIOU os lançamentos para outros integrantes.
 *
 * Não é um segundo motor de cálculo: parte do `Painel` pessoal (calcularPainel com escopo = só eu) e dos lançamentos
 * que EU criei (autor = eu) para outro responsável (lancamentosDoGrupo). Nenhum saldo, caixinha, fatura ou despesa
 * particular de outro integrante entra: eles aparecem só como responsáveis pelos valores que usei por eles.
 *
 * - Meu disponível = o Total disponível do Meu financeiro (minhas entradas − minhas despesas, competência).
 * - Utilizado pelos integrantes = despesas que EU criei e em que o responsável é outro integrante, desde a criação,
 *   qualquer forma de pagamento. Minhas despesas pessoais e as de terceiros que não criei ficam de fora.
 * - Repasses recebidos = só os CONFIRMADOS por mim (no mês do recebimento). Pendente e "repassado" não contam.
 * - Disponível do grupo = meu disponível + repasses recebidos − utilizado pelos integrantes.
 *   Quando um integrante devolve, o disponível do grupo sobe e o pendente dele cai na mesma quantia (sem duplicar).
 * - REGRA DE CAIXA DO GRUPO (meses a partir de MES_CORTE_CAIXA_GRUPO (out/2026); antes disso vale a fórmula acima, sem mudança):
 *   o disponível só desce quando algo é efetivamente PAGO. Conta fixa pendente e fatura em aberto não descontam:
 *   · o que o Meu financeiro já separou (minhas contas pendentes e a minha parte das faturas em aberto) volta ao disponível
 *     do grupo até ser pago (o Meu financeiro continua como está);
 *   · o que os integrantes usaram só desconta quando foi pago: à vista/débito no lançamento, conta fixa quando marcada
 *     como paga, compra no crédito na proporção do pagamento da fatura. Repasse confirmado soma na hora.
 *   Pagamento de fatura e conta paga saem da conta escolhida (saldo da conta); estornar o pagamento reverte tudo.
 * - INFORMATIVOS (só aqui, nunca descontados do disponível): contas pendentes, faturas em aberto e total pago no mês.
 *   O Meu financeiro (pessoal) não lê nada disto. Ver informativosDoGrupo.
 * - Tudo é acumulado até o mês visto, como o Total disponível. Repasse nunca é entrada nem despesa.
 */
import { arred, semDuplicados } from "./calculos";
import { dataDoItem } from "./datas";
import { addMeses } from "./finance";
import { calcularFatura, faturasEmAberto, mesDaFaturaDaConta, MES_CORTE_CAIXA, type Fechamentos, type PagamentoFatura } from "./pagamentoFatura";
import type { Estado } from "./types";
import { lancamentosDoGrupo, type LancGrupo } from "./grupo";
import type { Painel } from "./painel";

type Dados = Parameters<typeof lancamentosDoGrupo>[0];

export type MembroRepasse = {
  id: string;
  nome: string;
  avatar: string | null;
  cor: string | null;
  /** Utilizado por ele até o mês visto (acumulado) */
  utilizado: number;
  /** Que ele já devolveu e eu confirmei até o mês visto (acumulado) */
  recebido: number;
  /** utilizado − recebido */
  pendente: number;
  /** Parte do pendente que ele já marcou como "Repassado" e espera a minha confirmação (ainda não conta como recebido) */
  aguardando: number;
  /** Utilizado só neste mês */
  utilizadoNoMes: number;
  /** Devolvido (confirmado) só neste mês, de qualquer mês de despesa */
  recebidoNoMes: number;
};

/** Números informativos do Financeiro do grupo. Não entram no disponível: pendente e fatura aberta ainda não saíram do caixa. */
export type InformativosGrupo = {
  /** Contas fixas ainda não pagas/cobradas que eu criei (minhas e as que lancei para outros), até o mês visto */
  contasPendentes: number;
  /** Faturas de cartão de crédito com valor a pagar, até o mês visto (com o fechamento de cada cartão) */
  faturasEmAberto: number;
  /** Saiu de fato da conta neste mês: contas fixas pagas (débito/dinheiro, em pago_em) + pagamentos de fatura */
  totalPagoNoMes: number;
};

/** A partir deste mês o Disponível do grupo segue a regra de caixa (só desconta o que foi pago). Meses anteriores ficam como estavam. */
export const MES_CORTE_CAIXA_GRUPO = "2026-10";

/** Efeito da regra de caixa do grupo no disponível. Sem a regra (meses antigos): utilizadoPago = utilizado e naoDescontado = 0. */
export type CaixaGrupo = {
  regraCaixa: boolean;
  /** Parte do utilizado pelos integrantes que já foi paga (é o que desconta do disponível) */
  utilizadoPago: number;
  /** Minhas contas pendentes + minha parte das faturas em aberto: já separadas no Meu financeiro, voltam ao grupo até serem pagas */
  naoDescontado: number;
};

export type FinanceiroGrupo = {
  mes: string;
  regraCaixa: boolean;
  /** Utilizado pelos integrantes que já foi pago (desconta do disponível) */
  utilizadoPago: number;
  /** Contas pendentes e fatura em aberto que o Meu financeiro já separou, devolvidas ao disponível do grupo até serem pagas */
  naoDescontado: number;
  /** Meu financeiro: o mesmo Total disponível do painel pessoal */
  meuDisponivel: number;
  utilizado: number;
  recebido: number;
  pendente: number;
  aguardando: number;
  utilizadoNoMes: number;
  recebidoNoMes: number;
  /** meuDisponivel + recebido − utilizado */
  disponivelGrupo: number;
  membros: MembroRepasse[];
  /** Entradas e saídas do mês, de todo o grupo (lançamentos visíveis ao usuário) */
  entradasGrupo: MovimentoGrupo;
  saidasGrupo: MovimentoGrupo;
} & InformativosGrupo;

type Linha = Record<string, any>;
const num = (v: unknown) => Number(v) || 0;
const formaDe = (i: Linha) => String(i.formaPagamento ?? i.forma_pagamento ?? "");
const mesDoPagamento = (i: Linha) => (i.pago_em || i.pagoEm ? String(i.pago_em || i.pagoEm).slice(0, 7) : String(i.mes));

/**
 * Faturas de crédito com valor a pagar, até o mês visto. Só a partir de MES_CORTE_CAIXA: antes disso não há pagamentos
 * registrados no app, então uma fatura antiga apareceria "em aberto" sem nunca ter sido cobrada de fato.
 */
function faturasDoGrupo(dados: Dados, meuId: string, mes: string, opts: { pagamentosFatura?: PagamentoFatura[]; cartoesCredito?: string[]; fechamentos?: Fechamentos }) {
  const credito = [...new Set(opts.cartoesCredito ?? [])];
  if (credito.length === 0) return [];
  // Meses dos lançamentos e o seguinte a cada um (uma cobrança após o fechamento cai na fatura do mês seguinte)
  const mesesDosLancamentos = ["extrato", "cartao", "contas"].flatMap((o) => (((dados as any)[o] || []) as Linha[]).map((i) => String(i.mes)));
  const meses = [...new Set(mesesDosLancamentos.flatMap((m) => (/^[0-9]{4}-[0-9]{2}$/.test(m) ? [m, addMeses(m, 1)] : [])))].filter((m) => m >= MES_CORTE_CAIXA && m <= mes);
  return faturasEmAberto(dados as unknown as Estado, credito, opts.pagamentosFatura ?? [], meses, { meuId, ateData: `${mes}-31`, fechamentos: opts.fechamentos });
}

/**
 * Efeito da regra de caixa do grupo (ver cabeçalho). `meus` = lançamentos que EU criei para outros integrantes, até o mês visto.
 * Cada lançamento entra em utilizadoPago uma única vez; compra no crédito entra na proporção do que já foi pago da fatura.
 */
export function caixaDoGrupo(
  dados: Dados,
  meus: LancGrupo[],
  meuId: string,
  mes: string,
  opts: { pagamentosFatura?: PagamentoFatura[]; cartoesCredito?: string[]; fechamentos?: Fechamentos } = {},
): CaixaGrupo {
  const utilizado = arred(meus.reduce((s, l) => s + l.valor, 0));
  if (mes < MES_CORTE_CAIXA_GRUPO) return { regraCaixa: false, utilizadoPago: utilizado, naoDescontado: 0 };

  const credito = new Set(opts.cartoesCredito ?? []);
  const pagamentos = opts.pagamentosFatura ?? [];
  const fim = `${mes}-31`;
  const bruto = new Map<string, Linha>();
  for (const o of ["extrato", "cartao", "contas"] as const) for (const i of ((dados as any)[o] || []) as Linha[]) bruto.set(`${o}:${i.id}`, i);
  const estado = dados as unknown as Estado;

  // Fatura (cartão + mês) → fração já paga até o fim do mês visto
  const fracao = new Map<string, number>();
  const fracaoPaga = (cartao: string, mesFatura: string): number => {
    const chave = `${cartao}|${mesFatura}`;
    const guardada = fracao.get(chave);
    if (guardada !== undefined) return guardada;
    // Fatura anterior ao corte de caixa: não há pagamentos registrados, vale a regra de sempre (já saiu na compra)
    let f = 1;
    if (mesFatura >= MES_CORTE_CAIXA) {
      const total = calcularFatura(estado, cartao, mesFatura, 0, { somenteCobradas: true, fechamentos: opts.fechamentos }).total;
      const pago = pagamentos.filter((p) => p.cartao === cartao && p.mes === mesFatura && String(p.data) <= fim).reduce((s, p) => s + num(p.valor), 0);
      f = total > 0 ? Math.min(1, pago / total) : 0;
    }
    fracao.set(chave, f);
    return f;
  };

  let utilizadoPago = 0;
  for (const l of meus) {
    const raw = bruto.get(l.chave) ?? {};
    const forma = formaDe(raw) || l.forma;
    if (credito.has(forma)) {
      if (l.origem === "contas" && !raw.pago) continue; // conta fixa pendente no cartão: ainda não está na fatura
      const mesFatura = l.origem === "contas" ? mesDaFaturaDaConta(raw as never, opts.fechamentos) : l.mes;
      utilizadoPago += l.valor * fracaoPaga(forma, mesFatura);
    } else if (l.origem === "contas") {
      if (raw.pago && mesDoPagamento(raw) <= mes) utilizadoPago += l.valor; // conta fixa só desconta quando marcada como paga
    } else {
      utilizadoPago += l.valor; // à vista / débito / dinheiro: já saiu da conta no lançamento
    }
  }

  const proprias = semDuplicados(((dados as any).contas || []) as Linha[], "contas").filter(
    (i) => String(i.owner_id ?? "") === meuId && String(i.responsavel_id ?? i.owner_id ?? "") === meuId && !i.repasseSintetico && !i.pago && String(i.mes) <= mes,
  );
  const pendentesProprias = proprias.reduce((s, i) => s + num(i.valor), 0);
  const faturaPropria = faturasDoGrupo(dados, meuId, mes, opts).reduce((s, f) => s + (f.restanteProprio ?? 0), 0);
  return { regraCaixa: true, utilizadoPago: arred(utilizadoPago), naoDescontado: arred(pendentesProprias + faturaPropria) };
}

/**
 * Contas pendentes, faturas em aberto e total pago no mês. Só informam; o disponível não muda.
 * - Conta fixa no crédito pendente/cobrada nunca entra em "pago": o dinheiro só sai quando a fatura é paga (pagamentos de fatura).
 * - Cada valor aparece uma vez: a fixa paga no débito conta aqui e não em pagamentos de fatura.
 */
export function informativosDoGrupo(
  dados: Dados,
  meuId: string,
  mes: string,
  opts: { pagamentosFatura?: PagamentoFatura[]; cartoesCredito?: string[]; fechamentos?: Fechamentos } = {},
): InformativosGrupo {
  const credito = new Set(opts.cartoesCredito ?? []);
  const pagamentos = opts.pagamentosFatura ?? [];
  const minhas = semDuplicados(((dados as any).contas || []) as Linha[], "contas").filter((i) => String(i.owner_id ?? "") === meuId && !i.repasseSintetico);
  const contasPendentes = arred(minhas.filter((i) => !i.pago && String(i.mes) <= mes).reduce((s, i) => s + num(i.valor), 0));

  const faturas = faturasDoGrupo(dados, meuId, mes, opts);
  const faturasAbertas = arred(faturas.reduce((s, f) => s + f.restante, 0));

  const fixasPagas = minhas.filter((i) => i.pago && !credito.has(formaDe(i)) && mesDoPagamento(i) === mes).reduce((s, i) => s + num(i.valor), 0);
  const faturasPagas = pagamentos.filter((p) => String(p.data).slice(0, 7) === mes).reduce((s, p) => s + num(p.valor), 0);
  return { contasPendentes, faturasEmAberto: faturasAbertas, totalPagoNoMes: arred(fixasPagas + faturasPagas) };
}

/** Uma linha do detalhe de Entradas/Saídas do grupo: com quem lançou e de quem é. */
export type LinhaMovimentoGrupo = {
  id: string;
  origem: "extrato" | "cartao" | "contas";
  descricao: string;
  categoria: string;
  forma: string;
  valor: number;
  data: string | null;
  /** Quem lançou (autor) */
  lancou: string;
  /** De quem é (responsável) */
  responsavel: string;
};
export type MovimentoGrupo = { total: number; itens: LinhaMovimentoGrupo[] };

/**
 * Entradas e saídas do mês de todo o grupo, entre os lançamentos que o usuário enxerga (os dele e os de perfis dele).
 * O total é a soma de `itens`: indicador e detalhe saem da mesma lista. Repasse e pagamento de fatura nunca entram.
 * Saídas = despesas realizadas (conta fixa pendente fica no informativo). Cada lançamento conta uma vez (semDuplicados).
 */
export function movimentosDoGrupo(dados: Dados, meuId: string, mes: string): { entradas: MovimentoGrupo; saidas: MovimentoGrupo } {
  const entradas: LinhaMovimentoGrupo[] = [];
  const saidas: LinhaMovimentoGrupo[] = [];
  for (const origem of ["extrato", "cartao", "contas"] as const) {
    for (const i of semDuplicados((dados as unknown as Record<string, Linha[] | undefined>)[origem] || [], origem)) {
      if (String(i.mes) !== mes || i.repasseSintetico) continue;
      const ehEntrada = i.tipo === "entrada";
      if (!ehEntrada && origem === "contas" && !i.pago) continue;
      const linha: LinhaMovimentoGrupo = {
        id: `${origem}-${i.id}`,
        origem,
        descricao: String((origem === "contas" ? i.nome : i.descricao ?? i.nome) || "Sem descrição"),
        categoria: String(i.categoria || ""),
        forma: String(i.pagamento || i.forma_pagamento || i.formaPagamento || i.cartao || ""),
        valor: num(i.valor),
        data: dataDoItem(i) ?? null,
        lancou: String(i.autorNome || (String(i.owner_id ?? "") === meuId ? "Eu" : "Membro")),
        responsavel: String(i.responsavel || (String(i.responsavel_id ?? "") === meuId ? "Eu" : "Membro")),
      };
      (ehEntrada ? entradas : saidas).push(linha);
    }
  }
  const ordenar = (l: LinhaMovimentoGrupo[]) => l.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || a.descricao.localeCompare(b.descricao, "pt-BR"));
  const montar = (l: LinhaMovimentoGrupo[]): MovimentoGrupo => ({ total: arred(l.reduce((s, x) => s + x.valor, 0)), itens: ordenar(l) });
  return { entradas: montar(entradas), saidas: montar(saidas) };
}

export function financeiroDoGrupo(painel: Painel, dados: Dados, meuId: string, info?: { pagamentosFatura?: PagamentoFatura[]; cartoesCredito?: string[]; fechamentos?: Fechamentos }): FinanceiroGrupo {
  const mes = painel.mes;
  const mesConfirmado = (l: LancGrupo) => l.mesRecebimento;
  // Só o que eu criei para outro responsável, até o mês visto (parcelas e contas de meses futuros ainda não contam)
  const meus = lancamentosDoGrupo(dados, mes).filter((l) => l.autorId === meuId && l.respId !== meuId && l.mes <= mes);

  const porMembro = new Map<string, MembroRepasse>();
  for (const l of meus) {
    let m = porMembro.get(l.respId);
    if (!m) {
      m = { id: l.respId, nome: l.respNome, avatar: l.respAvatar, cor: l.respCor, utilizado: 0, recebido: 0, pendente: 0, aguardando: 0, utilizadoNoMes: 0, recebidoNoMes: 0 };
      porMembro.set(l.respId, m);
    }
    m.utilizado = arred(m.utilizado + l.valor);
    if (l.mes === mes) m.utilizadoNoMes = arred(m.utilizadoNoMes + l.valor);
    const confirmado = l.repassePago && mesConfirmado(l) <= mes;
    if (confirmado) {
      m.recebido = arred(m.recebido + l.valor);
      if (mesConfirmado(l) === mes) m.recebidoNoMes = arred(m.recebidoNoMes + l.valor);
    } else if (l.situacaoRepasse === "aguardando") {
      m.aguardando = arred(m.aguardando + l.valor);
    }
  }
  for (const m of porMembro.values()) m.pendente = arred(m.utilizado - m.recebido);
  const membros = [...porMembro.values()].sort((a, b) => b.pendente - a.pendente || b.utilizado - a.utilizado);
  const soma = (f: (m: MembroRepasse) => number) => arred(membros.reduce((s, m) => s + f(m), 0));

  const movimentos = movimentosDoGrupo(dados, meuId, mes);
  const utilizado = soma((m) => m.utilizado);
  const recebido = soma((m) => m.recebido);
  const caixa = caixaDoGrupo(dados, meus, meuId, mes, info);
  return {
    mes,
    regraCaixa: caixa.regraCaixa,
    utilizadoPago: caixa.utilizadoPago,
    naoDescontado: caixa.naoDescontado,
    meuDisponivel: painel.totalDisponivel,
    utilizado,
    recebido,
    pendente: arred(utilizado - recebido),
    aguardando: soma((m) => m.aguardando),
    utilizadoNoMes: soma((m) => m.utilizadoNoMes),
    recebidoNoMes: soma((m) => m.recebidoNoMes),
    // Regra de caixa: só o utilizado já pago desconta, e o que o Meu financeiro separou (pendente/fatura aberta) volta
    disponivelGrupo: arred(painel.totalDisponivel + caixa.naoDescontado + recebido - caixa.utilizadoPago),
    membros,
    entradasGrupo: movimentos.entradas,
    saidasGrupo: movimentos.saidas,
    ...informativosDoGrupo(dados, meuId, mes, info),
  };
}
