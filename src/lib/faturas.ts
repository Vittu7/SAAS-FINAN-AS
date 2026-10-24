import type { Estado } from './types';

/** Fatura de um cartão em um mês: soma tudo o que o grupo lançou nele (que o usuário pode ver). */
export function calcularFatura(estado: Estado, nome: string, mes: string, limite: number) {
  const parcelas = estado.cartao.filter(i => i.cartao === nome && i.mes === mes).map(i => ({ id: `cartao:${i.id}`, descricao: i.descricao || i.nome, categoria: i.categoria, responsavel: i.responsavel, responsavelAvatar: (i as any).responsavelAvatar, responsavelCor: (i as any).responsavelCor, valor: Number(i.valor) || 0, detalhe: `${i.parcelaAtual}/${i.parcelaTotal}` }));
  const compras = estado.extrato.filter(i => i.pagamento === nome && i.mes === mes).map(i => ({ id: `extrato:${i.id}`, descricao: i.descricao, categoria: i.categoria, responsavel: i.responsavel, responsavelAvatar: (i as any).responsavelAvatar, responsavelCor: (i as any).responsavelCor, valor: Number(i.valor) || 0, detalhe: 'Compra' }));
  const contas = estado.contas.filter(i => (i.formaPagamento || (i as typeof i & { forma_pagamento?: string }).forma_pagamento) === nome && i.mes === mes).map(i => ({ id: `contas:${i.id}`, descricao: i.nome, categoria: i.categoria || '', responsavel: i.responsavel, responsavelAvatar: (i as any).responsavelAvatar, responsavelCor: (i as any).responsavelCor, valor: Number(i.valor) || 0, detalhe: 'Conta fixa' }));
  const itens = [...parcelas, ...compras, ...contas];
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return { itens, total, disponivel: Math.max(0, limite - total), excedido: Math.max(0, total - limite) };
}
