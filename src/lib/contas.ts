/**
 * Contas de débito x cartões de crédito.
 *
 * - CRÉDITO: tem limite e fatura mensal (calcularFatura). Não tem saldo.
 * - DÉBITO: tem saldo = saldo inicial + entradas na conta − saídas à vista na conta − contas fixas pagas na conta.
 * - REPASSES: quando o autor de um lançamento confirma que recebeu o repasse, escolhe em qual conta de débito o
 *   dinheiro entrou (campo repasse_conta). Esse valor entra no saldo dessa conta como "repasses recebidos".
 * - O saldo é um controle À PARTE: nunca entra em calcularMes (entradas, saídas e saldo do mês não mudam).
 * - O saldo considera só o que o usuário lançou (owner_id). Compras de outros membros no mesmo cartão
 *   continuam contando na fatura, como antes.
 */
import { arred, ehEntrada, semDuplicados } from "./calculos";
import { calcularFatura } from "./faturas";
import type { Estado } from "./types";

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

/** Mês (AAAA-MM) em que o repasse foi confirmado; sem data, vale o mês do lançamento. */
const mesDoRepasse = (i: any): string => (i.repasse_pago_em ? String(i.repasse_pago_em).slice(0, 7) : String(i.mes));

/** Saldo de uma conta de débito. Só o que o usuário lançou, até o mês informado. */
export function calcularSaldoConta(
  estado: Pick<Estado, "extrato" | "contas"> & { cartao?: Estado["cartao"] },
  conta: Pick<ContaOpcao, "nome" | "saldo_inicial">,
  opts: { userId?: string | null; ateMes?: string } = {},
) {
  const extrato = semDuplicados(estado.extrato as any[], "extrato").filter(
    (i) => i.pagamento === conta.nome && doUsuario(i, opts.userId) && ate(i, opts.ateMes),
  );
  const fixasPagas = semDuplicados(estado.contas as any[], "contas").filter(
    (i) => (i.formaPagamento || i.forma_pagamento) === conta.nome && i.pago && doUsuario(i, opts.userId) && ate(i, opts.ateMes),
  );
  // Repasses que o usuário (autor) recebeu e mandou para esta conta
  const repassesRecebidos = soma(
    (["extrato", "cartao", "contas"] as const).flatMap((o) =>
      semDuplicados(((estado as any)[o] || []) as any[], o).filter(
        (i) => i.repasse_pago && i.repasse_conta === conta.nome && !ehEntrada(i) && doUsuario(i, opts.userId) && !!i.owner_id && i.owner_id !== i.responsavel_id && (!opts.ateMes || mesDoRepasse(i) <= opts.ateMes),
      ),
    ),
  );
  const inicial = num(conta.saldo_inicial);
  const entradas = soma(extrato.filter(ehEntrada));
  const saidas = soma(extrato.filter((i) => !ehEntrada(i)));
  const fixas = soma(fixasPagas);
  return { inicial, entradas, saidas, fixas, repasses: repassesRecebidos, saldo: arred(inicial + entradas + repassesRecebidos - saidas - fixas) };
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
  opts: { userId?: string | null; mes: string },
): Disponibilidade {
  const tipo = tipoDaConta(conta);
  if (tipo === "debito") {
    const { saldo } = calcularSaldoConta(estado, conta, { userId: opts.userId, ateMes: opts.mes });
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