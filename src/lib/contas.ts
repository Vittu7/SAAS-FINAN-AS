/**
 * Contas de débito x cartões de crédito.
 *
 * - CRÉDITO: tem limite e fatura mensal (calcularFatura). Não tem saldo.
 * - DÉBITO: tem saldo = saldo inicial + entradas na conta − saídas à vista na conta − contas fixas pagas na conta.
 * - REPASSES: quando o autor de um lançamento confirma que recebeu o repasse, escolhe em qual conta de débito o
 *   dinheiro entrou (campo repasse_conta). Esse valor entra no saldo dessa conta como "repasses recebidos".
 *   Quem deve escolhe, ao marcar "Repassei", de qual conta saiu (repasse_conta_origem): o valor é descontado
 *   dessa conta quando o autor confirma o recebimento.
 * - CAIXINHAS: aporte feito "usando" uma conta sai do saldo dela; resgate para uma conta volta para o saldo.
 *   Rendimentos não mexem em conta. Nada disso entra em entradas e saídas do mês.
 * - O saldo é um controle À PARTE: nunca entra em calcularMes (entradas, saídas e saldo do mês não mudam).
 * - O saldo considera só o que o usuário lançou (owner_id). Compras de outros membros no mesmo cartão
 *   continuam contando na fatura, como antes.
 */
import { arred, ehEntrada, mesDoRecebimento, semDuplicados } from "./calculos";
import { calcularFatura } from "./pagamentoFatura";
import type { Estado } from "./types";
import type { PagamentoFatura } from "./pagamentoFatura";

/** Aporte/resgate de caixinha ligado a uma conta de débito (só o necessário para o saldo). */
export type MovCaixinhaConta = { tipo: string; valor: number; conta: string; data: string };

export type TipoCartao = "credito" | "debito";

export type ContaOpcao = {
  nome: string;
  tipo_cartao?: string | null;
  eh_cartao?: boolean | null;
  limite?: number | string | null;
  saldo_inicial?: number | string | null;
};

/** null = forma de pagamento sem controle (Pix, dinheiro, boleto...). */
export const tipoDaConta = (o: Pick<ContaOpcao, "tipo_cartao" | "eh_cartao">): TipoCartao | null =>
  o.tipo_cartao === "debito" ? "debito" : o.tipo_cartao === "credito" || o.eh_cartao ? "credito" : null;

const num = (v: unknown) => Number(v) || 0;
const soma = (l: any[]) => arred(l.reduce((s, i) => s + num(i?.valor), 0));
const doUsuario = (i: any, userId?: string | null) => !userId || !i.owner_id || i.owner_id === userId;
const ate = (i: any, mes?: string) => !mes || String(i.mes) <= mes;

/** Mês de competência do recebimento (repasse_mes; registros antigos: data da confirmação; sem data: mês do lançamento). */
const mesDoRepasse = (i: any): string => mesDoRecebimento(i);

/** Saldo de uma conta de débito. Só o que o usuário lançou, até o mês informado. */
export function calcularSaldoConta(
  estado: Pick<Estado, "extrato" | "contas"> & { cartao?: Estado["cartao"] },
  conta: Pick<ContaOpcao, "nome" | "saldo_inicial">,
  opts: { userId?: string | null; ateMes?: string; caixinhaMovs?: MovCaixinhaConta[]; pagamentosFatura?: PagamentoFatura[] } = {},
) {
  const extrato = semDuplicados(estado.extrato as any[], "extrato").filter(
    (i) => i.pagamento === conta.nome && doUsuario(i, opts.userId) && ate(i, opts.ateMes),
  );
  // Conta fixa paga sai do saldo no mês em que foi paga (pago_em); sem data (histórico), vale o mês da linha
  const mesDoPagamento = (i: any): string => (i.pago_em || i.pagoEm ? String(i.pago_em || i.pagoEm).slice(0, 7) : String(i.mes));
  const fixasPagas = semDuplicados(estado.contas as any[], "contas").filter(
    (i) => (i.formaPagamento || i.forma_pagamento) === conta.nome && i.pago && doUsuario(i, opts.userId) && (!opts.ateMes || mesDoPagamento(i) <= opts.ateMes),
  );
  // Repasses que o usuário (autor) recebeu e mandou para esta conta
  const repassesRecebidos = soma(
    (["extrato", "cartao", "contas"] as const).flatMap((o) =>
      semDuplicados(((estado as any)[o] || []) as any[], o).filter(
        (i) => i.repasse_pago && i.repasse_conta === conta.nome && !ehEntrada(i) && doUsuario(i, opts.userId) && !!i.owner_id && i.owner_id !== i.responsavel_id && (!opts.ateMes || mesDoRepasse(i) <= opts.ateMes),
      ),
    ),
  );
  // Repasses que o usuário (responsável) pagou saindo desta conta, já confirmados pelo autor
  const repassesPagos = soma(
    (["extrato", "cartao", "contas"] as const).flatMap((o) =>
      semDuplicados(((estado as any)[o] || []) as any[], o).filter(
        (i) => i.repasse_pago && i.repasse_conta_origem === conta.nome && !ehEntrada(i) && !!opts.userId && i.responsavel_id === opts.userId && i.owner_id !== i.responsavel_id && (!opts.ateMes || mesDoRepasse(i) <= opts.ateMes),
      ),
    ),
  );
  // Aportes em caixinhas saem da conta; resgates voltam para ela
  const movsConta = (opts.caixinhaMovs || []).filter((m) => m.conta === conta.nome && (!opts.ateMes || String(m.data).slice(0, 7) <= opts.ateMes));
  const aportesCaixinha = soma(movsConta.filter((m) => m.tipo === "aporte"));
  const resgatesCaixinha = soma(movsConta.filter((m) => m.tipo === "resgate"));
  // Pagamentos de fatura feitos com esta conta: saem do saldo da conta (não são despesa; a compra já contou)
  const faturasPagas = soma((opts.pagamentosFatura || []).filter((p) => p.conta === conta.nome && (!opts.ateMes || String(p.data).slice(0, 7) <= opts.ateMes)));
  const inicial = num(conta.saldo_inicial);
  const entradas = soma(extrato.filter(ehEntrada));
  const saidas = soma(extrato.filter((i) => !ehEntrada(i)));
  const fixas = soma(fixasPagas);
  return { inicial, entradas, saidas, fixas, repasses: repassesRecebidos, repassesPagos, aportesCaixinha, resgatesCaixinha, faturasPagas, saldo: arred(inicial + entradas + repassesRecebidos + resgatesCaixinha - saidas - fixas - repassesPagos - aportesCaixinha - faturasPagas) };
}

export type Disponibilidade = {
  tipo: TipoCartao | null;
  rotulo: "Saldo disponível" | "Limite disponível";
  /** null = sem controle (Pix, dinheiro...) ou cartão sem limite cadastrado */
  disponivel: number | null;
  ok: boolean;
  faltante: number;
};

/** Débito usa saldo; crédito usa limite (limite − fatura do mês). */
export function verificarDisponibilidade(
  estado: Estado,
  conta: ContaOpcao,
  valor: number,
  opts: { userId?: string | null; mes: string; caixinhaMovs?: MovCaixinhaConta[]; pagamentosFatura?: PagamentoFatura[] },
): Disponibilidade {
  const tipo = tipoDaConta(conta);
  if (tipo === "debito") {
    const { saldo } = calcularSaldoConta(estado, conta, { userId: opts.userId, ateMes: opts.mes, caixinhaMovs: opts.caixinhaMovs, pagamentosFatura: opts.pagamentosFatura });
    const faltante = Math.max(0, arred(valor - saldo));
    return { tipo, rotulo: "Saldo disponível", disponivel: saldo, ok: faltante === 0, faltante };
  }
  if (tipo === "credito") {
    const limite = num(conta.limite);
    if (limite <= 0) return { tipo, rotulo: "Limite disponível", disponivel: null, ok: true, faltante: 0 };
    const { disponivel } = calcularFatura(estado, conta.nome, opts.mes, limite);
    const faltante = Math.max(0, arred(valor - disponivel));
    return { tipo, rotulo: "Limite disponível", disponivel, ok: faltante === 0, faltante };
  }
  return { tipo: null, rotulo: "Saldo disponível", disponivel: null, ok: true, faltante: 0 };
}
