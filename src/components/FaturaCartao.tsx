'use client';
import { ReceiptText, CreditCard } from "lucide-react";
import { Ico } from "@/components/icons";
import { useState } from 'react';
import { useOpcoes } from '@/lib/useOpcoes';
import { calcularFatura } from '@/lib/faturas';
import { addMeses, brl, pct as porc, rotuloMes } from '@/lib/finance';
import { gradienteCartao } from '@/lib/cartao';
import type { Estado } from '@/lib/types';

/** Mesmo visual da tela de Contas parceladas: carrossel de cartões + lista em painel. */
export default function FaturaCartao({ estado, mes, setMes }: { estado: Estado; mes: string; setMes: (mes: string) => void }) {
  const { pagamento, corPagamento } = useOpcoes();
  // Cartões com a maior fatura do mês aparecem primeiro
  const cartoes = pagamento
    .filter((i) => i.eh_cartao)
    .map((c) => ({ c, total: calcularFatura(estado, c.nome, mes, Number(c.limite) || 0).total }))
    .sort((a, b) => b.total - a.total || a.c.nome.localeCompare(b.c.nome, 'pt-BR'))
    .map((x) => x.c);
  const [id, setId] = useState('');
  const escolhido = cartoes.find((i) => i.id === id) || cartoes[0];
  if (!escolhido) return <p className="py-6 text-muted">Nenhum cartão de crédito cadastrado. Acesse Configurações → Cadastros → Cartões.</p>;
  const fatura = calcularFatura(estado, escolhido.nome, mes, Number(escolhido.limite) || 0);

  return (
    <div className="space-y-6 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6 md:shadow-lg">
      <section aria-label="Escolha o cartão">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cartões</p>
            <h2 className="mt-1 text-base font-semibold text-ink">Faturas e limites</h2>
          </div>
          <div className="flex h-9 items-center rounded-full bg-background px-1 ring-1 ring-line">
            <button type="button" aria-label="Fatura anterior" onClick={() => setMes(addMeses(mes, -1))} className="grid size-7 place-items-center rounded-full text-muted">‹</button>
            <span className="min-w-24 px-1 text-center text-xs font-medium capitalize sm:text-sm">{rotuloMes(mes)}</span>
            <button type="button" aria-label="Próxima fatura" onClick={() => setMes(addMeses(mes, 1))} className="grid size-7 place-items-center rounded-full text-muted">›</button>
          </div>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0 [-webkit-overflow-scrolling:touch]">
          {cartoes.map((c) => {
            const f = calcularFatura(estado, c.nome, mes, Number(c.limite) || 0);
            const limite = Number(c.limite) || 0;
            const pct = limite > 0 ? Math.min(100, (f.total / limite) * 100) : 0;
            const ativo = c.id === escolhido.id;
            const cor = c.cor || corPagamento(c.nome);
            return (
              <button key={c.id} type="button" onClick={() => setId(c.id)} aria-pressed={ativo}
                className={`min-w-[17rem] snap-start overflow-hidden rounded-3xl p-5 text-left text-white shadow-lg transition sm:min-w-[19rem] ${ativo ? 'ring-4 ring-accent ring-offset-2 ring-offset-background' : 'opacity-80 hover:opacity-100'}`}
                style={{ background: gradienteCartao(cor) }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{c.nome}</p>
                    <p className="mt-1 text-xs text-white/70">Cartão de crédito</p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">{porc(pct)} usado</span>
                </div>
                <p className="mt-6 text-xs font-medium text-white/70">Fatura de {rotuloMes(mes)}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{brl(f.total)}</p>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-white/70">Limite total</p><p className="mt-1 text-sm font-semibold">{brl(limite)}</p></div>
                  <div><p className="text-xs text-white/70">Disponível</p><p className="mt-1 text-sm font-semibold">{brl(Math.max(0, f.disponivel))}</p></div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
              </button>
            );
          })}
        </div>
      </section>

      {fatura.excedido > 0 && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-500">Limite excedido em {brl(fatura.excedido)}</p>}

      <section className="rounded-2xl bg-surface ring-1 ring-line md:ring-0">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-line px-4 py-3 md:px-0">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{escolhido.nome}</h3>
            <p className="text-xs text-muted">{fatura.itens.length} compras e lançamentos</p>
          </div>
          <p className="text-right"><span className="block text-xs text-muted">Total</span><span className="text-lg font-semibold tabular-nums">{brl(fatura.total)}</span></p>
        </header>
        <ul className="divide-y divide-line">
          {fatura.itens.map((i) => (
            <li key={i.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:px-0">
              <span aria-hidden className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent"><Ico icon={i.detalhe === 'Compra' ? CreditCard : ReceiptText} size={18} /></span>
              <div className="min-w-0">
                <p className="truncate font-medium">{i.descricao}</p>
                <p className="truncate text-xs text-muted">{i.categoria} · {i.responsavel} · {i.detalhe}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{brl(i.valor)}</span>
            </li>
          ))}
        </ul>
        {!fatura.itens.length && <p className="px-4 py-8 text-center text-sm text-muted">Nenhum lançamento neste período.</p>}
      </section>
    </div>
  );
}
