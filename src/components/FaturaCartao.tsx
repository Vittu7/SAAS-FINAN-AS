'use client';
import { ReceiptText, CreditCard } from "lucide-react";
import { useState } from 'react';
import { useOpcoes } from '@/lib/useOpcoes';
import { calcularFatura } from '@/lib/faturas';
import { addMeses, brl, pct as porc, rotuloMes } from '@/lib/finance';
import EstadoVazio from '@/components/EstadoVazio';
import CadastrarCartaoModal from '@/components/CadastrarCartaoModal';
import { ICONE_ABA } from '@/components/icons';
import PessoaIcone from '@/components/PessoaIcone';
import { gradienteCartao } from '@/lib/cartao';
import type { Estado } from '@/lib/types';
import type { Opcao } from '@/lib/useOpcoes';
import { avisos } from '@/lib/avisos';
import { calcularSaldoConta, tipoDaConta } from '@/lib/contas';
import { pagamentosDaFatura, resumoFatura, vencimentoDaFatura, ROTULO_SITUACAO } from '@/lib/pagamentoFatura';
import { usePagamentosFatura } from '@/hooks/usePagamentosFatura';
import { useMovimentosConta } from '@/hooks/useMovimentosConta';
import PagarFaturaModal from '@/components/PagarFaturaModal';

/** Mesmo visual da tela de Contas parceladas: carrossel de cartões + lista em painel. */
export default function FaturaCartao({ estado, estadoLista, mes, setMes, userId = null }: { estado: Estado; /** Estado já filtrado por responsável: vale para a lista de compras. O limite dos cartões usa sempre o `estado` completo. */ estadoLista?: Estado; mes: string; setMes: (mes: string) => void; userId?: string | null }) {
  const { pagamento, corPagamento, recarregar, atualizarPagamento } = useOpcoes();
  const { pagamentos, disponivel: pagamentosHabilitados, registrar } = usePagamentosFatura();
  const caixinhaMovs = useMovimentosConta();
  const [pagando, setPagando] = useState(false);
  // Cartões com a maior fatura do mês aparecem primeiro
  const cartoes = pagamento
    .filter((i) => i.eh_cartao)
    .map((c) => ({ c, total: calcularFatura(estado, c.nome, mes, Number(c.limite) || 0).total }))
    .sort((a, b) => b.total - a.total || a.c.nome.localeCompare(b.c.nome, 'pt-BR'))
    .map((x) => x.c);
  const [id, setId] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const escolhido = cartoes.find((i) => i.id === id) || cartoes[0];
  if (!escolhido) return (
    <>
      <EstadoVazio icone={ICONE_ABA.fatura} titulo="Nenhum cartão cadastrado" descricao="Aqui você acompanha a fatura e o limite de cada cartão de crédito. Para começar, cadastre o seu primeiro cartão." passos={["Informe o nome do cartão", "Informe o limite total (opcional)", "Escolha uma cor e salve"]} acao={{ rotulo: "Cadastrar primeiro cartão", onClick: () => setCadastrando(true) }} />
      {cadastrando && <CadastrarCartaoModal onFechar={() => setCadastrando(false)} onConcluir={() => recarregar()} />}
    </>
  );
  const fatura = calcularFatura(estadoLista ?? estado, escolhido.nome, mes, Number(escolhido.limite) || 0);
  // Quitação usa a fatura COMPLETA do cartão (o filtro de pessoas só muda a lista de compras)
  const faturaCompleta = calcularFatura(estado, escolhido.nome, mes, Number(escolhido.limite) || 0);
  const historico = pagamentosDaFatura(pagamentos, escolhido.nome, mes);
  const resumo = resumoFatura(faturaCompleta.total, historico);
  const vencimento = vencimentoDaFatura(mes, escolhido.dia_vencimento);
  const contasDebito = pagamento.filter((o) => tipoDaConta(o) === "debito");
  const saldoDaConta = (c: Opcao) => calcularSaldoConta(estado, c, { userId, ateMes: mes, caixinhaMovs, pagamentosFatura: pagamentos }).saldo;
  const definirVencimento = async () => {
    const txt = window.prompt("Dia do vencimento da fatura (1 a 31):", escolhido.dia_vencimento ? String(escolhido.dia_vencimento) : "");
    if (txt === null) return;
    const dia = Math.trunc(Number(txt));
    if (!(dia >= 1 && dia <= 31)) return avisos.erro("Dia inválido", "Informe um número de 1 a 31.");
    try {
      await atualizarPagamento(escolhido.id, { dia_vencimento: dia });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      avisos.erro("Não foi possível salvar o vencimento", /dia_vencimento/.test(msg) ? "Rode o script supabase-08-pagamentos-fatura.sql no Supabase." : msg);
    }
  };
  const corSituacao = { aberta: "bg-amber-500/15 text-amber-700 dark:text-amber-400", parcial: "bg-sky-500/15 text-sky-700 dark:text-sky-400", paga: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }[resumo.situacao];

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

      <section aria-label="Pagamento da fatura" className="space-y-4 rounded-2xl bg-background p-4 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pagamento da fatura</p>
            <p className="mt-0.5 text-sm text-muted">
              {vencimento ? <>Vence em <b className="text-ink">{vencimento.split("-").reverse().join("/")}</b></> : "Sem vencimento definido"}
              {" · "}
              <button type="button" onClick={definirVencimento} className="font-medium text-accent underline-offset-2 hover:underline">{vencimento ? "alterar" : "definir"}</button>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${corSituacao}`}>{ROTULO_SITUACAO[resumo.situacao]}</span>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <div><dt className="text-xs text-muted">Total</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{brl(resumo.total)}</dd></div>
          <div><dt className="text-xs text-muted">Pago</dt><dd className="mt-0.5 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(resumo.pago)}</dd></div>
          <div><dt className="text-xs text-muted">Restante</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{brl(resumo.restante)}</dd></div>
        </dl>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Fatura paga" aria-valuemin={0} aria-valuemax={100} aria-valuenow={resumo.total > 0 ? Math.round(Math.min(100, (resumo.pago / resumo.total) * 100)) : 0}>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${resumo.total > 0 ? Math.min(100, (resumo.pago / resumo.total) * 100) : 0}%` }} />
        </div>

        {pagamentosHabilitados ? (
          <button type="button" onClick={() => setPagando(true)} disabled={resumo.restante <= 0} className="h-12 w-full rounded-xl bg-accent text-sm font-semibold text-on-accent disabled:opacity-50">
            {resumo.total <= 0 ? "Fatura sem lançamentos" : resumo.restante <= 0 ? "Fatura paga" : resumo.pago > 0 ? "Pagar o restante ou parte" : "Pagar fatura"}
          </button>
        ) : (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">O pagamento de fatura ainda não foi habilitado. Rode o script supabase-08-pagamentos-fatura.sql no Supabase.</p>
        )}

        {historico.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Histórico de pagamentos</h4>
            <ul className="mt-2 divide-y divide-line">
              {historico.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block font-medium">{p.data.split("-").reverse().join("/")}</span><span className="block truncate text-xs text-muted">saiu de {p.conta}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">− {brl(p.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {pagando && (
        <PagarFaturaModal cartao={escolhido.nome} mes={mes} total={resumo.total} pago={resumo.pago} restante={resumo.restante} contas={contasDebito} saldoDaConta={saldoDaConta} existentes={pagamentos} onRegistrar={registrar} onFechar={() => setPagando(false)} />
      )}

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
              <PessoaIcone pessoa={{ nome: i.responsavel, avatar: (i as any).responsavelAvatar, cor: (i as any).responsavelCor }} icone={i.detalhe === 'Compra' ? CreditCard : ReceiptText} tamanho={40} />
              <div className="min-w-0">
                <p className="truncate font-medium">{i.descricao}</p>
                <p className="truncate text-xs text-muted"><b className="font-semibold text-ink">{i.responsavel}</b> · {i.categoria} · {i.detalhe}</p>
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
