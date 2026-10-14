"use client";

import { brl, type Resumo } from "@/lib/finance";
import type { Config } from "@/lib/types";
import { ValorEditavel } from "./ui";

type Props = {
  resumo: Resumo;
  config: Config;
  onConfig: (patch: Partial<Config>) => void;
};

export default function SummaryCards({ resumo, config, onConfig }: Props) {
  const negativo = resumo.sobra < 0;
  const pctReserva =
    config.reservaMeta > 0 ? Math.min(100, (config.reservaAtual / config.reservaMeta) * 100) : 0;
  const meusGastos = resumo.porResponsavel.EU;

  return (
    <section aria-label="Resumo do mês" className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_1fr]">
      {/* Salário */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Salário</p>
        <div className="mt-2 -ml-1.5 flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-muted">R$</span>
          <ValorEditavel valor={config.salario} onChange={(n) => onConfig({ salario: n })} rotulo="Salário" />
        </div>
        <p className="mt-3 text-xs text-muted">Clique no valor para editar.</p>
      </div>

      {/* Gasto no mês */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Gasto no mês</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{brl(resumo.totalGasto)}</p>
        <dl className="mt-3 space-y-0.5 text-xs text-muted">
          <div className="flex justify-between">
            <dt>Extrato</dt>
            <dd className="tabular-nums">{brl(resumo.porOrigem.extrato)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cartão</dt>
            <dd className="tabular-nums">{brl(resumo.porOrigem.cartao)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Contas fixas</dt>
            <dd className="tabular-nums">{brl(resumo.porOrigem.contas)}</dd>
          </div>
        </dl>
      </div>

      {/* Sobra — o número principal da tela */}
      <div
        className={`rounded-2xl p-5 ${negativo ? "bg-rose-600 text-white" : "bg-accent text-on-accent"}`}
        aria-live="polite"
      >
        <p className="text-sm opacity-80">{negativo ? "Falta para fechar o mês" : "Sobra para você"}</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">{brl(Math.abs(resumo.sobra))}</p>
        <p className="mt-3 text-xs opacity-80">
          Salário {brl(resumo.salario)} − seus gastos {brl(meusGastos)}
        </p>
      </div>

      {/* Investimentos / Reserva */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Investimentos e reserva</p>
        <div className="mt-2 space-y-1 text-sm">
          <Linha rotulo="Investido">
            <ValorEditavel valor={config.investido} onChange={(n) => onConfig({ investido: n })} rotulo="Total investido" />
          </Linha>
          <Linha rotulo="Reserva atual">
            <ValorEditavel
              valor={config.reservaAtual}
              onChange={(n) => onConfig({ reservaAtual: n })}
              rotulo="Reserva de emergência atual"
            />
          </Linha>
          <Linha rotulo="Meta da reserva">
            <ValorEditavel
              valor={config.reservaMeta}
              onChange={(n) => onConfig({ reservaMeta: n })}
              rotulo="Meta da reserva de emergência"
            />
          </Linha>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Progresso da reserva de emergência"
          aria-valuenow={Math.round(pctReserva)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pctReserva}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {config.reservaMeta > 0 ? `${Math.round(pctReserva)}% da meta` : "Defina uma meta para acompanhar."}
        </p>
      </div>
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{rotulo}</span>
      {children}
    </div>
  );
}
