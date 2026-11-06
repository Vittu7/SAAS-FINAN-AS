import { describe, it, expect } from 'vitest';
import { calcularPainel } from '../src/lib/painel';
import { marcarForaDaVisao, aguardandoRepasseDoResponsavel, autorNaVisao } from '../src/lib/grupo';
import { montarLinhas, saidasDoMeuFinanceiro, entradasDoMeuFinanceiro } from '../src/lib/extrato';

type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const EU = 'eu';
const GISA = 'gisa';
const MES = '2026-10';
const escopo = new Set([EU]);

// Mesma passagem que page.tsx faz antes de montar o painel e o detalhe ("Somente eu")
const daVisao = (lista: Item[]) =>
  lista
    .filter((i) => i.responsavel_id === EU || i.owner_id === EU || autorNaVisao(i, escopo))
    .filter((i) => !aguardandoRepasseDoResponsavel(i, EU))
    .map((i) => marcarForaDaVisao(i, escopo));

const base = {
  extrato: [
    { id: 'e1', mes: MES, tipo: 'saida', descricao: 'Mercado', valor: 100, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu' },
    { id: 'e2', mes: MES, tipo: 'saida', descricao: 'Prestação Casa', valor: 300, owner_id: EU, responsavel_id: GISA, responsavel: 'Gisa' },
    { id: 'e3', mes: MES, tipo: 'entrada', descricao: 'Salário', valor: 2000, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu' },
    { id: 'e4', mes: MES, tipo: 'entrada', descricao: 'Extra da Gisa', valor: 50, owner_id: EU, responsavel_id: GISA, responsavel: 'Gisa' },
    { id: 'e5', mes: MES, tipo: 'saida', descricao: 'Farmácia (Gisa lançou para mim)', valor: 40, owner_id: GISA, responsavel_id: EU, responsavel: 'Vitu', repasse_pago: true, lancadoPorOutro: true, autorNome: 'Gisa' },
  ],
  cartao: [{ id: 'c1', mes: MES, nome: 'Grades', cartao: 'Nubank', parcelaAtual: 1, parcelaTotal: 1, valor: 125, owner_id: EU, responsavel_id: GISA, responsavel: 'Gisa' }],
  contas: [
    { id: 'f1', mes: MES, nome: 'Internet', valor: 80, pago: true, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu' },
    { id: 'f2', mes: MES, nome: 'Luz', valor: 60, pago: false, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu' },
  ],
};
const estado = { extrato: daVisao(base.extrato), cartao: daVisao(base.cartao), contas: daVisao(base.contas) };
const linhas = montarLinhas(estado.extrato, estado.cartao, estado.contas, MES);
const painel = calcularPainel(estado, { mes: MES, meuId: EU, dadosRepasses: base, escopo, mesCorteCaixa: '2026-11' });
const soma = (l: { valor: number }[]) => Math.round(l.reduce((s, x) => s + x.valor, 0) * 100) / 100;

describe('Detalhe do Meu financeiro: responsável, não autor', () => {
  it('Saídas lista só despesas em que eu sou o responsável', () => {
    const resp = new Set(saidasDoMeuFinanceiro(linhas).map((l) => l.responsavel));
    expect([...resp]).toEqual(['Vitu']);
    const nomes = saidasDoMeuFinanceiro(linhas).map((l) => l.descricao);
    expect(nomes).not.toContain('Prestação Casa');
    expect(nomes).not.toContain('Grades');
  });

  it('Saídas: a soma das linhas realizadas é igual ao indicador "Saiu"', () => {
    const realizadas = saidasDoMeuFinanceiro(linhas).filter((l) => !l.pendente);
    expect(soma(realizadas)).toBe(painel.saidasRealizadas);
    expect(painel.saidasRealizadas).toBe(220); // 100 + 40 + 80
  });

  it('Saídas: conta fixa pendente continua listada, fora do realizado', () => {
    const pend = saidasDoMeuFinanceiro(linhas).filter((l) => l.pendente);
    expect(soma(pend)).toBe(painel.contasPendentes);
  });

  it('Saída lançada por outro para mim aparece com o autor', () => {
    const l = saidasDoMeuFinanceiro(linhas).find((x) => x.descricao.startsWith('Farmácia'));
    expect(l?.autor).toBe('Gisa');
  });

  it('Entradas lista só as minhas, e a soma é igual ao indicador "Entrou"', () => {
    const e = entradasDoMeuFinanceiro(linhas);
    expect(e.map((l) => l.descricao)).toEqual(['Salário']);
    expect(soma(e)).toBe(painel.entradasRenda);
  });
});
