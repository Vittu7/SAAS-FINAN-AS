'use client';
import {useState} from 'react';
import GerenciarOpcoesModal from './GerenciarOpcoesModal';
import type {PreferenciasDashboard} from '@/lib/dashboardPreferences';
type Aba = 'cartoes' | 'pagamentos' | 'categorias' | 'preferencias';
export default function CentralAjustes({preferencias, pronto, salvando, erro, onAlterar}: {preferencias:PreferenciasDashboard; pronto:boolean; salvando:boolean; erro:string; onAlterar:(chave:keyof PreferenciasDashboard, valor:boolean)=>Promise<void>}) {
  const [aba,setAba]=useState<Aba>('cartoes');
  const abas: {id:Aba; nome:string}[]=[{id:'cartoes',nome:'Cartões'},{id:'pagamentos',nome:'Formas de pagamento'},{id:'categorias',nome:'Categorias'},{id:'preferencias',nome:'Preferências da Dashboard'}];
  const itens: {id:keyof PreferenciasDashboard; nome:string}[]=[{id:'resumo',nome:'Resumo do Mês'},{id:'graficos',nome:'Gráficos'},{id:'faturas',nome:'Faturas do mês'},{id:'investimentos',nome:'Investimentos e reserva'}];
  return <section className="min-w-0 space-y-5"><nav aria-label="Seções de ajustes" className="grid grid-cols-2 gap-2 border-b border-line pb-4 lg:grid-cols-4">{abas.map(a=><button key={a.id} type="button" aria-pressed={aba===a.id} onClick={()=>setAba(a.id)} className={`min-w-0 break-words rounded-lg px-3 py-3 text-sm font-medium ${aba===a.id?'bg-accent text-on-accent':'bg-surface text-ink'}`}>{a.nome}</button>)}</nav>
  {aba==='preferencias' ? <div className="max-w-2xl"><h2 className="mb-4 text-lg font-semibold">Tela Inicial</h2>{erro&&<p role="alert" className="mb-3 text-sm">{erro}</p>}{!pronto&&<p>Carregando preferências…</p>}{itens.map(i=><label key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-4"><span className="min-w-0 break-words">{i.nome}</span><input type="checkbox" role="switch" aria-label={i.nome} checked={preferencias[i.id]} disabled={!pronto||salvando} onChange={e=>void onAlterar(i.id,e.target.checked)} className="size-6 shrink-0 accent-[var(--accent)]"/></label>)}{salvando&&<p role="status" className="mt-3 text-sm text-muted">Salvando…</p>}</div> : <GerenciarOpcoesModal key={aba} modo="pagina" abaInicial={aba} tipo={aba==='categorias'?'categoria':'pagamento'} onClose={()=>{}}/>}</section>;
}
