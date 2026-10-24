import { describe, it, expect } from 'vitest';
import { agruparPorOrigem, montarLinhas, ordenarPorValor, totalGastos } from '../src/lib/extrato';
import { calcularFatura } from '../src/lib/faturas';
import type { Estado } from '../src/lib/types';

const extrato = [
  { id: 'e1', mes: '2026-10', descricao: 'Mercado', categoria: 'Alimentação', pagamento: 'Nubank', valor: 150, responsavel: 'Vittor' },
  { id: 'e2', mes: '2026-10', descricao: 'Café', categoria: 'Alimentação', pagamento: 'Pix', valor: 12.5, responsavel: 'Vittor' },
  { id: 'e3', mes: '2026-09', descricao: 'Mês passado', categoria: '', pagamento: 'Pix', valor: 999, responsavel: 'Vittor' },
];
const cartao = [{ id: 'c1', mes: '2026-10', nome: 'Celular', cartao: 'Nubank', parcelaAtual: 2, parcelaTotal: 10, categoria: 'Compras', valor: 300, responsavel: 'Vittor' }];
const contas = [{ id: 'f1', mes: '2026-10', nome: 'Internet', pago: false, valor: 100, forma_pagamento: 'Nubank', categoria: 'Moradia', responsavel: 'Vittor' }];

describe('Ordenação por valor', () => {
  const linhas = montarLinhas(extrato, cartao, contas, '2026-10');

  it('respeita o mês selecionado', () => {
    expect(linhas.map((l) => l.descricao)).not.toContain('Mês passado');
    expect(linhas).toHaveLength(4);
  });

  it('ordena do maior para o menor', () => {
    expect(ordenarPorValor(linhas, 'maior').map((l) => l.valor)).toEqual([300, 150, 100, 12.5]);
  });

  it('ordena do menor para o maior', () => {
    expect(ordenarPorValor(linhas, 'menor').map((l) => l.valor)).toEqual([12.5, 100, 150, 300]);
  });

  it('sem ordem mantém a sequência e não altera o original', () => {
    expect(ordenarPorValor(linhas, '')).toBe(linhas);
    const antes = linhas.map((l) => l.id);
    ordenarPorValor(linhas, 'maior');
    expect(linhas.map((l) => l.id)).toEqual(antes);
  });

  it('agrupa por origem com subtotal e ignora entradas', () => {
    const comSalario = [{ id: 's', origem: 'extrato' as const, descricao: 'Salário', categoria: '', forma: '', responsavel: '', valor: 5000, entrada: true }, ...linhas];
    const grupos = agruparPorOrigem(comSalario);
    expect(grupos.map((g) => [g.origem, g.total])).toEqual([['extrato', 162.5], ['cartao', 300], ['contas', 0]]); // conta pendente não é gasto pago
    expect(totalGastos(comSalario)).toBe(462.5);
  });
});

describe('Fatura do cartão considera todo o grupo', () => {
  const estado = {
    config: { salario: 0, investido: 0, reservaAtual: 0, reservaMeta: 0 },
    cartao: [],
    contas: [],
    extrato: [
      { id: '1', mes: '2026-10', pagamento: 'Nubank', categoria: '', valor: 80, descricao: 'Minha compra', responsavel: 'Vittor', owner_id: 'eu' },
      { id: '2', mes: '2026-10', pagamento: 'Nubank', categoria: '', valor: 500, descricao: 'Compra de outro membro', responsavel: 'Gisa', owner_id: 'gisa' },
    ],
  } as unknown as Estado;

  it('soma as compras de todos os membros e calcula o limite restante', () => {
    const f = calcularFatura(estado, 'Nubank', '2026-10', 1000);
    expect(f.total).toBe(580);
    expect(f.disponivel).toBe(420);
  });
});
