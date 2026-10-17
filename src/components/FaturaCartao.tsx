'use client';
import {useState} from 'react';
import {useOpcoes} from '@/lib/useOpcoes';
import {calcularFatura} from '@/lib/faturas';
import {addMeses, brl, rotuloMes} from '@/lib/finance';
import type {Estado} from '@/lib/types';
export default function FaturaCartao({estado, mes, setMes}: {estado: Estado; mes: string; setMes: (mes: string) => void}) {
  const {pagamento} = useOpcoes();
  const cartoes = pagamento.filter(i => i.eh_cartao);
  const [id, setId] = useState('');
  const escolhido = cartoes.find(i => i.id === id) || cartoes[0];
  if (!escolhido) return <p className="py-6 text-muted">Nenhum cartão de crédito cadastrado. Acesse Ajustes → Cartões.</p>;
  const fatura = calcularFatura(estado, escolhido.nome, mes, Number(escolhido.limite) || 0);
  return <section className="min-w-0 space-y-5">
    <div className="grid gap-3 sm:grid-cols-2"><label className="min-w-0 text-sm">Cartão de crédito<select className="mt-1 w-full min-w-0 rounded-lg border border-line bg-surface p-3" value={escolhido.id} onChange={e=>setId(e.target.value)}>{cartoes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
    <div className="flex min-w-0 items-center justify-between gap-2 self-end"><button type="button" aria-label="Fatura anterior" onClick={()=>setMes(addMeses(mes,-1))} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line">‹</button><input type="month" aria-label="Período da fatura" value={mes} onChange={e=>{if(e.target.value) setMes(e.target.value);}} className="min-w-0 flex-1 rounded-lg border border-line bg-surface p-2"/><button type="button" aria-label="Próxima fatura" onClick={()=>setMes(addMeses(mes,1))} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line">›</button></div></div>
    <h2 className="break-words text-xl font-semibold">{escolhido.nome} · {rotuloMes(mes)}</h2>
    <div className="grid gap-4 sm:grid-cols-2"><div className="border-b border-line py-4"><p className="text-sm text-muted">Total da fatura</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{brl(fatura.total)}</p></div><div className="border-b border-line py-4"><p className="text-sm text-muted">Limite disponível no período</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{brl(fatura.disponivel)}</p><p className="text-xs text-muted">Limite total: {brl(escolhido.limite)}</p></div></div>
    {fatura.excedido > 0 && <p role="alert">Limite excedido em {brl(fatura.excedido)}</p>}
    <h3 className="font-semibold">Compras e lançamentos ({fatura.itens.length})</h3>
    <ul className="divide-y divide-line">{fatura.itens.map(i=><li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{i.descricao}</p><p className="break-words text-xs text-muted">{i.categoria} · {i.responsavel} · {i.detalhe}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{brl(i.valor)}</span></li>)}</ul>
    {!fatura.itens.length && <p className="text-muted">Nenhum lançamento neste período.</p>}
  </section>;
}
export function FaturasDoMes({estado, mes, onAbrir}: {estado:Estado; mes:string; onAbrir:()=>void}) {
  const {pagamento} = useOpcoes();
  return <section className="space-y-3 border-t border-line pt-5"><h2 className="text-lg font-semibold">Faturas do mês</h2>{pagamento.filter(c=>c.eh_cartao).map(c=><button type="button" key={c.id} onClick={onAbrir} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-line bg-surface p-3 text-left"><span className="min-w-0 break-words">{c.nome}</span><span className="shrink-0 font-semibold">{brl(calcularFatura(estado,c.nome,mes,Number(c.limite)||0).total)}</span></button>)}<p className="text-xs text-muted">Valores registrados no mês; pagamento da fatura não conciliado.</p></section>;
}
