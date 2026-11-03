"use client";

import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Clock, HandCoins } from "lucide-react";
import { Ico } from "@/components/icons";
import { brl } from "@/lib/finance";
import type { Painel } from "@/lib/painel";

/**
 * Onde está cada valor de repasse, em qualquer visão (Todos, Somente eu, pessoas):
 *  A receber → A repassar → Repassado (aguardando confirmação) → Concluído.
 * "Repassado" nunca some: fica em "aguardando" até quem lançou confirmar o recebimento.
 * Repasse é transferência interna entre membros: não é receita nem despesa.
 */
const TONS = {
  emerald: { icone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", valor: "text-emerald-700 dark:text-emerald-400" },
  amber: { icone: "bg-amber-500/15 text-amber-700 dark:text-amber-400", valor: "text-amber-700 dark:text-amber-400" },
  sky: { icone: "bg-sky-500/15 text-sky-700 dark:text-sky-400", valor: "text-sky-700 dark:text-sky-400" },
} as const;

export default function RepassesResumo({ painel, onAbrir, className = "" }: { painel: Painel; onAbrir?: () => void; className?: string }) {
  const r = painel.repasses;
  if (!r.temMovimento) return null;

  const aguardando = r.aReceberAguardando + r.aRepassarAguardando;
  const concluidos = r.recebidosNoMes + r.enviadosNoMes;

  const itens = [
    { id: "receber", rotulo: "A receber", valor: r.aReceber, dica: "Ainda não repassado a você", icone: ArrowDownLeft, tom: "emerald" as const },
    { id: "repassar", rotulo: "A repassar", valor: r.aRepassar, dica: "Você ainda deve", icone: ArrowUpRight, tom: "amber" as const },
    {
      id: "aguardando",
      rotulo: "Repassado · aguardando",
      valor: aguardando,
      dica:
        r.aReceberAguardando > 0 && r.aRepassarAguardando > 0
          ? `Confirmar recebimento ${brl(r.aReceberAguardando)} · aguardando ${brl(r.aRepassarAguardando)}`
          : r.aReceberAguardando > 0
            ? "Já repassaram: confirme o recebimento"
            : r.aRepassarAguardando > 0
              ? "Você repassou: aguardando quem lançou confirmar"
              : "Nada aguardando confirmação",
      icone: Clock,
      tom: "sky" as const,
    },
    {
      id: "concluido",
      rotulo: "Concluídos no mês",
      valor: concluidos,
      dica: r.recebidosNoMes > 0 && r.enviadosNoMes > 0 ? `Recebidos ${brl(r.recebidosNoMes)} · enviados ${brl(r.enviadosNoMes)}` : r.recebidosNoMes > 0 ? "Recebidos e confirmados" : r.enviadosNoMes > 0 ? "Enviados e confirmados" : "Nenhum confirmado ainda",
      icone: Check,
      tom: "emerald" as const,
    },
  ];

  return (
    <section aria-label="Repasses" className={`card-glass p-4 md:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold">
            <span className="grid size-7 place-items-center rounded-full bg-accent/12 text-accent"><Ico icon={HandCoins} size={16} /></span>
            Repasses
          </p>
          <p className="mt-1 text-xs text-muted">Transferência entre membros: não é receita nem despesa.</p>
        </div>
        {onAbrir && (
          <button type="button" onClick={onAbrir} className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-accent ring-1 ring-line transition hover:bg-accent/8" aria-label="Ver repasses no grupo familiar">
            Ver detalhes<Ico icon={ChevronRight} size={14} />
          </button>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {itens.map((i) => {
          const vazio = i.valor <= 0;
          const destaque = i.id === "aguardando" && !vazio;
          return (
            <div key={i.id} className={`rounded-2xl p-3 ring-1 ${destaque ? "bg-sky-500/8 ring-sky-500/40" : "bg-background ring-line"} ${vazio ? "opacity-60" : ""}`}>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full ${TONS[i.tom].icone}`}><Ico icon={i.icone} size={12} /></span>
                <span className="truncate">{i.rotulo}</span>
              </dt>
              <dd className={`mt-1.5 text-lg font-semibold tabular-nums tracking-tight ${vazio ? "" : TONS[i.tom].valor}`}>{brl(i.valor)}</dd>
              <dd className="mt-0.5 text-[11px] leading-snug text-muted">{i.dica}</dd>
            </div>
          );
        })}
      </dl>

      {aguardando > 0 && (
        <p className="mt-3 rounded-xl bg-sky-500/8 px-3 py-2 text-xs text-muted">
          O valor <b className="text-ink">repassado</b> continua aqui até quem lançou confirmar o recebimento. Só então ele entra (ou sai) do saldo da conta.
        </p>
      )}
    </section>
  );
}
