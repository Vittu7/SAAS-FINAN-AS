"use client";

import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from "lucide-react";
import { Ico } from "@/components/icons";
import SeletorModoSaldo from "@/components/SeletorModoSaldo";
import { addMeses, brl, rotuloMes, type Resumo } from "@/lib/finance";
import type { ModoSaldo, Painel } from "@/lib/painel";
import type { TipoResumo } from "@/components/mobile/MobileShell";

/**
 * Quatro informações, sem misturar:
 * Saldo disponível (acumulado até o mês anterior) · Entradas do mês (só dinheiro externo) · Saídas do mês ·
 * Saldo restante (resultado do mês OU total disponível, conforme o seletor). Repasse é transferência interna.
 */
export default function SummaryCards({
  resumo,
  painel,
  modo,
  onModo,
  onAbrirExtrato,
}: {
  resumo: Resumo;
  painel: Painel;
  modo: ModoSaldo;
  onModo: (m: ModoSaldo) => void;
  onAbrirExtrato?: (tipo: TipoResumo) => void;
}) {
  const total = modo === "total";
  const valor = total ? painel.totalDisponivel : painel.resultadoMes;
  const negativo = valor < 0;
  const base = "card-glass p-5 text-left transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent md:p-6";
  const titulo = total ? (negativo ? "Total disponível negativo" : "Total disponível") : negativo ? "Déficit do mês" : "Sobra do mês";

  const partes = [
    painel.saldoAnterior !== 0 && `anterior ${brl(painel.saldoAnterior)}`,
    `entradas ${brl(painel.entradas)}`,
    painel.repassesRecebidos > 0 && `+ repasses ${brl(painel.repassesRecebidos)}`,
    `− saídas ${brl(painel.saidas)}`,
    painel.adiantado > 0 && `− adiantado ${brl(painel.adiantado)}`,
    painel.repassesEnviados > 0 && `− repasses enviados ${brl(painel.repassesEnviados)}`,
  ].filter(Boolean);

  return (
    <section aria-label="Resumo do mês" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{rotuloMes(painel.mes)} · repasse é transferência interna, não é receita nem despesa</p>
        <SeletorModoSaldo modo={modo} onModo={onModo} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => onAbrirExtrato?.("disponivel")} className={base} aria-label="Ver saldo disponível">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <span className="grid size-7 place-items-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400"><Ico icon={Wallet} size={16} /></span>Saldo disponível
          </p>
          <p className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${painel.saldoAnterior < 0 ? "text-rose-700 dark:text-rose-400" : ""}`}>{brl(painel.saldoAnterior)}</p>
          <p className="mt-2 text-xs text-muted">Acumulado até {rotuloMes(addMeses(painel.mes, -1))}: saldo inicial das contas + meses anteriores.</p>
          {(painel.aReceber > 0 || painel.aRepassar > 0) && (
            <p className="mt-1 text-xs text-muted">
              {painel.aReceber > 0 && <>A receber de repasses {brl(painel.aReceber)}</>}
              {painel.aReceber > 0 && painel.aRepassar > 0 && " · "}
              {painel.aRepassar > 0 && <>A repassar {brl(painel.aRepassar)}</>}
            </p>
          )}
        </button>

        <button type="button" onClick={() => onAbrirExtrato?.("entradas")} className={base} aria-label="Ver entradas do mês">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <span className="grid size-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"><Ico icon={ArrowDownLeft} size={16} /></span>Entradas do mês
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">{brl(painel.entradas)}</p>
          <p className="mt-2 text-xs text-muted">
            {painel.entradasPorOrigem.length > 0
              ? painel.entradasPorOrigem.slice(0, 3).map((o) => `${o.rotulo} ${brl(o.valor)}`).join(" · ") + (painel.entradasPorOrigem.length > 3 ? ` · +${painel.entradasPorOrigem.length - 3}` : "")
              : "Nenhuma entrada lançada no mês"}
          </p>
          {painel.usandoSalarioConfigurado && <p className="mt-1 text-xs text-muted">Usando o salário configurado. Lance uma entrada para substituir.</p>}
          {painel.repassesRecebidos > 0 && (
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">Repasses recebidos {brl(painel.repassesRecebidos)} (transferência, fora das entradas)</p>
          )}
        </button>

        <button type="button" onClick={() => onAbrirExtrato?.("gastos")} className={base} aria-label="Ver saídas do mês">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <span className="grid size-7 place-items-center rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400"><Ico icon={ArrowUpRight} size={16} /></span>Saídas do mês
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-rose-700 dark:text-rose-400">{brl(painel.saidas)}</p>
          <p className="mt-2 text-xs text-muted">
            À vista {brl(resumo.porOrigem.extrato)} · Parcelas {brl(resumo.porOrigem.cartao)} · Fixas {brl(resumo.porOrigem.contas)}
            {resumo.faltaPagar > 0 && <> · Falta pagar {brl(resumo.faltaPagar)}</>}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onAbrirExtrato?.("disponivel")}
          aria-label={`Ver detalhes: ${titulo}`}
          aria-live="polite"
          className={`relative overflow-hidden rounded-[1.25rem] p-5 text-left shadow-xl transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white md:p-6 ${negativo ? "bg-rose-700 text-white" : "bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent),black_28%)] text-on-accent shadow-accent/25"}`}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
          <p className="relative flex items-center gap-2 text-sm font-medium opacity-90"><Ico icon={Scale} size={18} />Saldo restante · {titulo}</p>
          <p className="relative mt-3 text-3xl font-semibold tracking-tight tabular-nums">{negativo ? "− " : ""}{brl(Math.abs(valor))}</p>
          <p className="relative mt-2 text-xs opacity-80">
            {total ? partes.join(" ") : `Entradas ${brl(painel.entradas)} − saídas ${brl(painel.saidas)} (só este mês)`}
          </p>
          {!total && painel.totalDisponivel !== painel.resultadoMes && (
            <p className="relative mt-1 text-xs opacity-80">Total disponível: {brl(painel.totalDisponivel)}</p>
          )}
        </button>
      </div>
    </section>
  );
}
