"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronRight, HandCoins, PiggyBank, Scale, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Ico } from "@/components/icons";
import RepassesResumo from "@/components/RepassesResumo";
import SeletorModoSaldo from "@/components/SeletorModoSaldo";
import { addMeses, brl, pct as porc, rotuloMes, type Resumo } from "@/lib/finance";
import type { ModoSaldo, Painel } from "@/lib/painel";
import type { TipoResumo } from "@/components/mobile/MobileShell";

/**
 * Resumo financeiro (desktop): destaque do saldo, três indicadores (entradas, saídas, saldo anterior)
 * e a composição do saldo linha a linha, com o bloco de repasses logo abaixo.
 * Entradas = só dinheiro externo lançado; repasse concluído soma no saldo de quem recebeu.
 */
type Linha = { rotulo: string; valor: number; sinal: "+" | "−" | ""; tom: string; icone: LucideIcon; dica?: string };

const TOM = {
  pos: "text-emerald-700 dark:text-emerald-400",
  neg: "text-rose-700 dark:text-rose-400",
  info: "text-sky-700 dark:text-sky-400",
  neutro: "text-ink",
};

export default function SummaryCards({
  resumo,
  painel,
  modo,
  onModo,
  onAbrirExtrato,
  onAbrirRepasses,
}: {
  resumo: Resumo;
  painel: Painel;
  modo: ModoSaldo;
  onModo: (m: ModoSaldo) => void;
  onAbrirExtrato?: (tipo: TipoResumo) => void;
  onAbrirRepasses?: () => void;
}) {
  const total = modo === "total";
  const valor = total ? painel.totalDisponivel : painel.resultadoMes;
  const negativo = valor < 0;
  const titulo = total ? (negativo ? "Total disponível negativo" : "Total disponível") : negativo ? "Déficit do mês" : "Sobra do mês";
  const usado = painel.entradas > 0 ? Math.min(100, (painel.saidas / painel.entradas) * 100) : painel.saidas > 0 ? 100 : 0;
  const card = "card-glass group flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-accent";

  // Composição do saldo, na ordem em que o dinheiro entra e sai
  const linhas: Linha[] = [
    total && { rotulo: "Saldo anterior", valor: painel.saldoAnterior, sinal: "" as const, tom: painel.saldoAnterior < 0 ? TOM.neg : TOM.neutro, icone: CalendarDays, dica: `Até ${rotuloMes(addMeses(painel.mes, -1))}` },
    { rotulo: "Entradas", valor: painel.entradas, sinal: "+" as const, tom: TOM.pos, icone: ArrowDownLeft },
    { rotulo: "Saídas", valor: painel.saidas, sinal: "−" as const, tom: TOM.neg, icone: ArrowUpRight },
    total && painel.adiantado > 0 && { rotulo: "Pago para outra pessoa", valor: painel.adiantado, sinal: "−" as const, tom: TOM.neg, icone: HandCoins, dica: "Volta quando o repasse for concluído" },
    total && painel.faturaEmAberto > 0 && { rotulo: "Fatura ainda não paga", valor: painel.faturaEmAberto, sinal: "+" as const, tom: TOM.info, icone: HandCoins, dica: "Compras no crédito para outros: sai do saldo ao pagar a fatura" },
    total && painel.despesasARepassar > 0 && { rotulo: "Ainda a repassar", valor: painel.despesasARepassar, sinal: "+" as const, tom: TOM.info, icone: HandCoins, dica: "Sai do saldo quando você repassar" },
    total && painel.aportesCaixinha > 0 && { rotulo: "Aportes em caixinhas", valor: painel.aportesCaixinha, sinal: "−" as const, tom: TOM.info, icone: PiggyBank, dica: "Saiu do saldo, não é despesa" },
    total && painel.resgatesCaixinha > 0 && { rotulo: "Resgates de caixinhas", valor: painel.resgatesCaixinha, sinal: "+" as const, tom: TOM.info, icone: PiggyBank },
  ].filter(Boolean) as Linha[];

  const origens = [
    { rotulo: "À vista", valor: resumo.porOrigem.extrato, cor: "bg-rose-500" },
    { rotulo: "Parcelas", valor: resumo.porOrigem.cartao, cor: "bg-amber-500" },
    { rotulo: "Fixas", valor: resumo.porOrigem.contas, cor: "bg-violet-500" },
  ];
  const somaOrigens = origens.reduce((s, o) => s + o.valor, 0);

  return (
    <section aria-label="Resumo do mês" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Resumo</p>
          <h2 className="text-lg font-semibold tracking-tight">{rotuloMes(painel.mes)}</h2>
        </div>
        <SeletorModoSaldo modo={modo} onModo={onModo} />
      </header>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Destaque */}
        <button
          type="button"
          onClick={() => onAbrirExtrato?.("disponivel")}
          aria-label={`Ver detalhes: ${titulo}`}
          aria-live="polite"
          className={`group relative flex flex-col overflow-hidden rounded-[1.5rem] p-6 text-left shadow-xl transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white xl:col-span-5 xl:row-span-2 ${negativo ? "bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow-rose-900/20" : "bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent),black_30%)] text-on-accent shadow-accent/25"}`}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 size-48 rounded-full bg-white/5" />

          <div className="relative flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium opacity-90">
              <span className="grid size-8 place-items-center rounded-full bg-white/15"><Ico icon={total ? Wallet : Scale} size={16} /></span>
              {titulo}
            </p>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium opacity-80 transition group-hover:opacity-100">Detalhes<Ico icon={ChevronRight} size={14} /></span>
          </div>

          <p className="relative mt-5 text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums">{negativo ? "− " : ""}{brl(Math.abs(valor))}</p>
          <p className="relative mt-2 text-sm opacity-80">
            {total ? "Dinheiro acumulado ao fim do mês" : "Entradas − saídas, só deste mês"}
          </p>

          <div className="relative mt-auto pt-8">
            <div className="flex items-baseline justify-between text-xs opacity-85">
              <span>Uso das entradas do mês</span>
              <span className="font-semibold tabular-nums">{porc(usado)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20" role="img" aria-label={`${porc(usado)} das entradas do mês já usado`}>
              <div className="h-full rounded-full bg-white/90 transition-all" style={{ width: `${usado}%` }} />
            </div>
            {!total && painel.totalDisponivel !== painel.resultadoMes && (
              <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs">
                Total disponível: <b className="tabular-nums">{brl(painel.totalDisponivel)}</b>
              </p>
            )}
          </div>
        </button>

        {/* Indicadores */}
        <div className="grid gap-4 sm:grid-cols-3 xl:col-span-7">
          <button type="button" onClick={() => onAbrirExtrato?.("entradas")} className={card} aria-label="Ver entradas do mês">
            <Rotulo icone={ArrowDownLeft} cor="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Entradas</Rotulo>
            <p className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${TOM.pos}`}>{brl(painel.entradas)}</p>
            <p className="mt-auto pt-2 text-xs leading-relaxed text-muted">
              {painel.entradasPorOrigem.length > 0
                ? painel.entradasPorOrigem.slice(0, 2).map((o) => `${o.rotulo} ${brl(o.valor)}`).join(" · ") + (painel.entradasPorOrigem.length > 2 ? ` · +${painel.entradasPorOrigem.length - 2}` : "")
                : "Nenhuma entrada no mês. Lance em Nova transação › Entrada."}
            </p>
          </button>

          <button type="button" onClick={() => onAbrirExtrato?.("gastos")} className={card} aria-label="Ver saídas do mês">
            <Rotulo icone={ArrowUpRight} cor="bg-rose-500/15 text-rose-700 dark:text-rose-400">Saídas</Rotulo>
            <p className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${TOM.neg}`}>{brl(painel.saidas)}</p>
            <div className="mt-auto pt-3">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-line/60" role="img" aria-label={origens.map((o) => `${o.rotulo} ${brl(o.valor)}`).join(", ")}>
                {somaOrigens > 0 && origens.map((o) => <div key={o.rotulo} className={o.cor} style={{ width: `${(o.valor / somaOrigens) * 100}%` }} />)}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
                {origens.map((o) => (
                  <span key={o.rotulo} className="inline-flex items-center gap-1"><span className={`size-1.5 rounded-full ${o.cor}`} />{o.rotulo} {brl(o.valor)}</span>
                ))}
              </p>
              {resumo.faltaPagar > 0 && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">Falta pagar {brl(resumo.faltaPagar)}</p>}
            </div>
          </button>

          <button type="button" onClick={() => onAbrirExtrato?.("disponivel")} className={card} aria-label="Ver saldo anterior">
            <Rotulo icone={CalendarDays} cor="bg-sky-500/15 text-sky-700 dark:text-sky-400">Saldo anterior</Rotulo>
            <p className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${painel.saldoAnterior < 0 ? TOM.neg : ""}`}>{brl(painel.saldoAnterior)}</p>
            <p className="mt-auto pt-2 text-xs leading-relaxed text-muted">Acumulado até {rotuloMes(addMeses(painel.mes, -1))}: saldo inicial das contas + meses anteriores.</p>
          </button>
        </div>

        {/* Composição do saldo */}
        <div className="card-glass p-5 xl:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Como chegamos {total ? "ao total disponível" : "à sobra do mês"}</p>
            <span className="text-xs text-muted">{rotuloMes(painel.mes)}</span>
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {linhas.map((l) => (
              <li key={l.rotulo} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition hover:bg-background/60">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full bg-background ring-1 ring-line ${l.tom}`}><Ico icon={l.icone} size={12} /></span>
                  <span className="min-w-0">
                    <span className="block truncate">{l.rotulo}</span>
                    {l.dica && <span className="block truncate text-[11px] text-muted">{l.dica}</span>}
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${l.tom}`}>{l.sinal && `${l.sinal} `}{brl(l.valor)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold">= {titulo}</span>
            <span className={`text-base font-bold tabular-nums ${negativo ? TOM.neg : ""}`}>{negativo ? "− " : ""}{brl(Math.abs(valor))}</span>
          </div>
        </div>
      </div>

      <RepassesResumo painel={painel} onAbrir={onAbrirRepasses} />
    </section>
  );
}

function Rotulo({ icone, cor, children }: { icone: LucideIcon; cor: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-muted">
      <span className={`grid size-8 place-items-center rounded-full ${cor}`}><Ico icon={icone} size={16} /></span>
      {children}
    </p>
  );
}
