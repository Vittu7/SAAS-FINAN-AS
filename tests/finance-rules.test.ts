import {describe, it, expect} from 'vitest';
import {calcularFatura} from '../src/lib/faturas';
import {normalizarPreferencias} from '../src/lib/dashboardPreferences';
import type {Estado} from '../src/lib/types';
const estado: Estado = {config:{salario:0,investido:0,reservaAtual:0,reservaMeta:0},cartao:[{id:'1',mes:'2026-10',nome:'Compra',cartao:'Nubank',parcelaAtual:1,parcelaTotal:3,categoria:'Casa',valor:200,responsavel:'EU'},{id:'2',mes:'2026-10',nome:'Outro cartão',cartao:'Inter',parcelaAtual:1,parcelaTotal:1,categoria:'Casa',valor:900,responsavel:'EU'},{id:'3',mes:'2026-11',nome:'Outra parcela',cartao:'Nubank',parcelaAtual:2,parcelaTotal:3,categoria:'Casa',valor:200,responsavel:'EU'}],extrato:[{id:'1',mes:'2026-10',pagamento:'Nubank',categoria:'Mercado',valor:50,descricao:'Mercado',responsavel:'EU'}],contas:[{id:'1',mes:'2026-10',nome:'Internet',pago:false,valor:80,responsavel:'EU',formaPagamento:'Nubank'}]};
describe('Fatura específica',()=>{
 it('inclui apenas lançamentos do cartão selecionado',()=>{const f=calcularFatura(estado,'Nubank','2026-10',1000);expect(f.total).toBe(330);expect(f.itens.map(i=>i.descricao)).toEqual(['Compra','Mercado','Internet']);});
 it('alterna o período sem somar parcelas futuras na fatura atual',()=>{expect(calcularFatura(estado,'Nubank','2026-11',1000).total).toBe(200);});
 it('calcula o limite disponível do período',()=>{expect(calcularFatura(estado,'Nubank','2026-10',1000).disponivel).toBe(670);});
});
describe('Preferências da Tela Inicial',()=>{
 it('oculta Resumo do Mês independentemente de Gráficos',()=>{const p=normalizarPreferencias({resumo:false,graficos:true});expect(p.resumo).toBe(false);expect(p.graficos).toBe(true);});
 it('permite ocultar Gráficos',()=>{expect(normalizarPreferencias({graficos:false}).graficos).toBe(false);});
 it('permite ocultar faturas',()=>{expect(normalizarPreferencias({faturas:false}).faturas).toBe(false);});
});
