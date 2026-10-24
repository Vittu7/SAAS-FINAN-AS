"use client";

import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { Ico } from "@/components/icons";
import { brl, type Resumo } from "@/lib/finance";
import type { TipoResumo } from "@/components/mobile/MobileShell";

/** Entradas (verde), saídas (vermelho) e saldo restante, em destaque no desktop. */
export default function SummaryCards({ resumo, onAbrirExtrato }: { resumo: Resumo; onAbrirExtrato?: (tipo: TipoResumo) => void }) {
  const negativo = resumo.sobra < 0;
  const base = "card-glass p-5 text-left transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent md:p-6";

  return (
    <section aria-label="Resumo do mês" className="grid gap-4 md:grid-cols-3">
      <button type="button" onClick={() => onAbrirExtrato?.("entradas")} className={base} aria-label="Ver entradas do mês">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <span className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><Ico icon={ArrowDownLeft} size={16} /></span>Entradas
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">{brl(resumo.entradas)}</p>
        <p className="mt-2 text-xs text-muted">{resumo.usandoSalarioConfigurado ? "Usando o salário configurado. Lance uma entrada para substituir." : "Dinheiro recebido no mês"}</p>
      </button>

      <button type="button" onClick={() => onAbrirExtrato?.("gastos")} className={base} aria-label="Ver saídas do mês">
        <p className="flex items-center gap-2 text-sm font-medium text-muted">
          <span className="grid size-7 place-items-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400"><Ico icon={ArrowUpRight} size={16} /></span>Saídas
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-rose-700 dark:text-rose-400">{brl(resumo.totalGasto)}</p>
        <p className="mt-2 text-xs text-muted">
          À vista {brl(resumo.porOrigem.extrato)} · Parcelas {brl(resumo.porOrigem.cartao)} · Fixas {brl(resumo.porOrigem.contas)}
          {resumo.faltaPagar > 0 && <> · Falta pagar {brl(resumo.faltaPagar)}</>}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onAbrirExtrato?.("disponivel")}
        aria-label="Ver detalhes do saldo restante"
        aria-live="polite"
        className={`relative overflow-hidden rounded-[1.25rem] p-5 text-left shadow-xl transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white md:p-6 ${negativo ? "bg-rose-700 text-white" : "bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent),black_28%)] text-on-accent shadow-accent/25"}`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <p className="relative flex items-center gap-2 text-sm font-medium opacity-90"><Ico icon={Scale} size={18} />{negativo ? "Saldo negativo" : "Saldo restante"}</p>
        <p className="relative mt-3 text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">{negativo ? "− " : ""}{brl(Math.abs(resumo.sobra))}</p>
        <p className="relative mt-2 text-xs opacity-80">Entradas {brl(resumo.entradas)} − saídas {brl(resumo.totalGasto)}</p>
      </button>
    </section>
  );
}
