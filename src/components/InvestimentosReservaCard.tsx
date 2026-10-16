"use client";

import { ValorEditavel } from "@/components/ui";
import AportesInvestimento from "@/components/AportesInvestimento";
import type { Config } from "@/lib/types";

export default function InvestimentosReservaCard({ config, onConfig }: { config: Config; onConfig: (patch: Partial<Config>) => void }) {
  const progresso = config.reservaMeta > 0 ? Math.min(100, (config.reservaAtual / config.reservaMeta) * 100) : 0;

  return (
    <section id="investimentos" className="rounded-2xl border border-line bg-surface p-5 md:p-6">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Planejamento</p>
        <h2 className="mt-1 text-lg font-semibold">Investimentos e reserva</h2>
        <p className="mt-1 text-sm text-muted">Acompanhe seus aportes e sua meta de segurança.</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-background p-4">
          <AportesInvestimento saldoAnterior={config.investido} />
        </div>
        <div className="rounded-xl bg-background p-4">
          <p className="text-sm font-medium">Reserva de emergência</p>
          <div className="mt-4 space-y-4">
            <Linha rotulo="Reserva atual" valor={config.reservaAtual} onChange={(valor) => onConfig({ reservaAtual: valor })} />
            <Linha rotulo="Meta da reserva" valor={config.reservaMeta} onChange={(valor) => onConfig({ reservaMeta: valor })} />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Progresso da reserva de emergência" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progresso}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">{config.reservaMeta > 0 ? `${Math.round(progresso)}% da meta` : "Defina uma meta para acompanhar."}</p>
        </div>
      </div>
    </section>
  );
}

function Linha({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange: (valor: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{rotulo}</span>
      <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5">
        <span className="text-xs text-muted">R$</span>
        <ValorEditavel valor={valor} onChange={onChange} rotulo={rotulo} />
      </div>
    </div>
  );
}
