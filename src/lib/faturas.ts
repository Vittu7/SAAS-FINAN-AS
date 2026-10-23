import type { Estado } from './types';

/** Fatura de um cartão em um mês: soma tudo o que o grupo lançou nele (que o usuário pode ver). */
export function calcularFatura(estado: Estado, nome: string, mes: string, limite: number) {
  const parcelas = estado.cartao.filter(i => i.cartao === nome && i.mes === mes).map(i => ({ id: `cartao:${i.id}`, descricao: i.descricao || i.nome, categoria: i.categoria, responsavel: i.responsavel, valor: Number(i.valor) || 0, detalhe: `${i.parcelaAtual}/${i.parcelaTotal}` }));
  const compras = estado.extrato.filter(i => i.pagamento === nome && i.mes === mes).map(i => ({ id: `extrato:${i.id}`, descricao: i.descricao, categoria: i.categoria, responsavel: i.responsavel, valor: Number(i.valor) || 0, detalhe: 'Compra' }));
  const contas = estado.contas.filter(i => (i.formaPagamento || (i as typeof i & { forma_pagamento?: string }).forma_pagamento) === nome && i.mes === mes).map(i => ({ id: `contas:${i.id}`, descricao: i.nome, categoria: i.categoria || '', responsavel: i.responsavel, valor: Number(i.valor) || 0, detalhe: 'Conta fixa' }));
  const itens = [...parcelas, ...compras, ...contas];
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return { itens, total, disponivel: Math.max(0, limite - total), excedido: Math.max(0, total - limite) };
}

/**
 * Critério único de ordenação dos cartões em todo o app:
 * maior fatura do período (mês) primeiro; cartões sem fatura ou com fatura zero
 * ficam por último, em ordem alfabética (desempate estável).
 */
export function ordenarCartoesPorFatura<T extends { nome: string; limite?: number | string | null }>(
  cartoes: T[],
  estado: Estado | undefined,
  mes: string,
): T[] {
  const total = (c: T) => (estado ? calcularFatura(estado, c.nome, mes, Number(c.limite) || 0).total : 0);
  return cartoes
    .map((c) => ({ c, total: total(c) }))
    .sort((a, b) => b.total - a.total || a.c.nome.localeCompare(b.c.nome, 'pt-BR'))
    .map((x) => x.c);
}

/** Para seletores de forma de pagamento: cartões primeiro (por maior fatura), demais formas depois na ordem original. */
export function ordenarPagamentosPorFatura<T extends { nome: string; limite?: number | string | null; eh_cartao?: boolean | null }>(
  opcoes: T[],
  estado: Estado | undefined,
  mes: string,
): T[] {
  if (!estado) return opcoes;
  const cartoes = ordenarCartoesPorFatura(opcoes.filter((o) => o.eh_cartao), estado, mes);
  return [...cartoes, ...opcoes.filter((o) => !o.eh_cartao)];
}
