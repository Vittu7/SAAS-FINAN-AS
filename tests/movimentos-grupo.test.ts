import { describe, it, expect } from 'vitest';
import { movimentosDoGrupo, financeiroDoGrupo } from '../src/lib/financeiroGrupo';
import { calcularPainel } from '../src/lib/painel';

const EU = 'eu';
const GISA = 'gisa';
const MAE = 'mae';
const MES = '2026-10';

const dados = {
  extrato: [
    { id: 'e1', mes: MES, tipo: 'entrada', descricao: 'Salário', valor: 2000, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Vitu' },
    { id: 'e2', mes: MES, tipo: 'entrada', descricao: 'Extra Mãe', valor: 150, owner_id: EU, responsavel_id: MAE, responsavel: 'Mãe', autorNome: 'Vitu' },
    { id: 'e3', mes: MES, tipo: 'saida', descricao: 'Mercado', valor: 100, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Vitu' },
    { id: 'e4', mes: MES, tipo: 'saida', descricao: 'Prestação Casa', valor: 300, owner_id: EU, responsavel_id: GISA, responsavel: 'Gisa', autorNome: 'Vitu', repasse_pago: true },
    { id: 'e5', mes: MES, tipo: 'saida', descricao: 'Farmácia', valor: 40, owner_id: GISA, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Gisa' },
    { id: 'e6', mes: '2026-09', tipo: 'saida', descricao: 'Mês anterior', valor: 999, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Vitu' },
    // linha sintética de repasse: nunca entra
    { id: 'repasse:extrato:e4', mes: MES, tipo: 'entrada', descricao: 'Repasse recebido', valor: 300, owner_id: EU, responsavel_id: EU, repasseSintetico: true },
    // duplicado pelo mesmo id: conta uma vez
    { id: 'e3', mes: MES, tipo: 'saida', descricao: 'Mercado', valor: 100, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Vitu' },
  ],
  cartao: [{ id: 'c1', mes: MES, nome: 'Grades', cartao: 'Nubank', parcelaAtual: 1, parcelaTotal: 1, valor: 125, owner_id: EU, responsavel_id: GISA, responsavel: 'Gisa', autorNome: 'Vitu' }],
  contas: [
    { id: 'f1', mes: MES, nome: 'Internet', valor: 80, pago: true, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Vitu' },
    { id: 'f2', mes: MES, nome: 'Luz', valor: 60, pago: false, owner_id: EU, responsavel_id: EU, responsavel: 'Vitu', autorNome: 'Vitu' },
  ],
};

describe('Entradas e saídas do grupo', () => {
  const m = movimentosDoGrupo(dados, EU, MES);

  it('Entradas: de todos, com autor e responsável, sem repasse', () => {
    expect(m.entradas.itens.map((l) => l.descricao).sort()).toEqual(['Extra Mãe', 'Salário']);
    expect(m.entradas.total).toBe(2150);
    const mae = m.entradas.itens.find((l) => l.descricao === 'Extra Mãe');
    expect(mae).toMatchObject({ lancou: 'Vitu', responsavel: 'Mãe' });
  });

  it('Saídas: de todos, uma vez cada, só do mês e realizadas', () => {
    expect(m.saidas.itens.map((l) => l.descricao).sort()).toEqual(['Farmácia', 'Grades', 'Internet', 'Mercado', 'Prestação Casa']);
    expect(m.saidas.total).toBe(645); // 100 + 300 + 40 + 125 + 80
    const f = m.saidas.itens.find((l) => l.descricao === 'Farmácia');
    expect(f).toMatchObject({ lancou: 'Gisa', responsavel: 'Vitu' });
  });

  it('o total é exatamente a soma do detalhe', () => {
    for (const mov of [m.entradas, m.saidas]) {
      expect(Math.round(mov.itens.reduce((s, l) => s + l.valor, 0) * 100) / 100).toBe(mov.total);
    }
  });

  it('conta fixa pendente não entra (fica no informativo)', () => {
    expect(m.saidas.itens.map((l) => l.descricao)).not.toContain('Luz');
  });

  it('outro mês muda lista e total juntos; mês sem dados fica vazio', () => {
    const set = movimentosDoGrupo(dados, EU, '2026-09');
    expect(set.saidas.total).toBe(999);
    expect(set.entradas.itens).toHaveLength(0);
  });

  it('financeiroDoGrupo expõe os mesmos movimentos e não altera o disponível do grupo', () => {
    const painel = calcularPainel({ extrato: dados.extrato, cartao: dados.cartao, contas: dados.contas }, { mes: MES, meuId: EU, escopo: new Set([EU]), mesCorteCaixa: '2026-11' });
    const g = financeiroDoGrupo(painel, dados, EU);
    expect(g.entradasGrupo.total).toBe(m.entradas.total);
    expect(g.saidasGrupo.total).toBe(m.saidas.total);
    expect(g.disponivelGrupo).toBe(Math.round((g.meuDisponivel + g.naoDescontado + g.recebido - g.utilizadoPago) * 100) / 100); // regra de caixa do grupo
  });
});
