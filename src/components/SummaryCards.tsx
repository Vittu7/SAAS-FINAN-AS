"use client";

import { useRef, useState } from "react";
import { brl, parseValor, type Resumo } from "@/lib/finance";
import type { Config } from "@/lib/types";
import { ValorEditavel } from "./ui";
import AportesInvestimento from "@/components/AportesInvestimento";

type Props = {
  resumo: Resumo;
  config: Config;
  onConfig: (patch: Partial<Config>) => void;
};

export default function SummaryCards({ resumo, config, onConfig }: Props) {
  const negativo = resumo.sobra < 0;
  const pctReserva =
    config.reservaMeta > 0 ? Math.min(100, (config.reservaAtual / config.reservaMeta) * 100) : 0;

  return (
    <section aria-label="Resumo do mês" className="grid grid-cols-1 items-start gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1.3fr_1fr]">
      {/* Salário (em destaque) */}
      <div className="order-2 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <p className="text-base font-semibold uppercase tracking-wide text-muted">Salário</p>
        <div className="mt-3">
          <SalarioEditavel valor={config.salario} onChange={(n) => onConfig({ salario: n })} />
        </div>
        <p className="mt-4 text-xs text-muted">Clique no valor para editar.</p>
      </div>

      {/* Gasto no mês */}
      <div className="order-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
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
        className={`order-1 rounded-2xl p-5 shadow-sm sm:p-6 ${negativo ? "bg-rose-600 text-white" : "bg-accent text-on-accent"}`}
        aria-live="polite"
      >
        <p className="text-sm opacity-80">{negativo ? "Falta para fechar o mês" : "Sobra para você"}</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">{brl(Math.abs(resumo.sobra))}</p>
        <p className="mt-3 text-xs opacity-80">
          Salário {brl(resumo.salario)} − seus gastos {brl(resumo.meusGastos)}
        </p>
      </div>

      {/* Investimentos / Reserva */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="mb-3 text-sm text-muted">Investimentos e reserva</p>

        <AportesInvestimento saldoAnterior={config.investido} />

        <div className="mt-4 space-y-1 text-sm">
          <Linha rotulo="Reserva atual">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">R$</span>
              <ValorEditavel
                valor={config.reservaAtual}
                onChange={(n) => onConfig({ reservaAtual: n })}
                rotulo="Reserva de emergência atual"
              />
            </div>
          </Linha>
          <Linha rotulo="Meta da reserva">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">R$</span>
              <ValorEditavel
                valor={config.reservaMeta}
                onChange={(n) => onConfig({ reservaMeta: n })}
                rotulo="Meta da reserva de emergência"
              />
            </div>
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
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${pctReserva}%` }}
          />
        </div>

        <p className="mt-1.5 text-xs text-muted">
          {config.reservaMeta > 0
            ? `${Math.round(pctReserva)}% da meta`
            : "Defina uma meta para acompanhar."}
        </p>
      </div>
    </section>
  );
}

// Valor do salário grande, formatado em reais; ao clicar vira um campo para digitar
function SalarioEditavel({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const cancelou = useRef(false);

  const iniciar = () => {
    cancelou.current = false;
    setTexto(valor ? String(valor).replace(".", ",") : "");
    setEditando(true);
  };

  const finalizar = () => {
    if (!cancelou.current) {
      const n = parseValor(texto);
      if (n > 0 || texto.trim() === "0") onChange(n);
    }
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-muted">R$</span>
        <input
          autoFocus
          inputMode="decimal"
          aria-label="Salário"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={finalizar}
          onKeyDown={(e) => {
            if (e.key === "Enter") finalizar();
            if (e.key === "Escape") {
              cancelou.current = true;
              setEditando(false);
            }
          }}
          className="w-full min-w-0 border-b-2 border-accent bg-transparent text-4xl font-semibold tabular-nums text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={iniciar}
      aria-label="Editar salário"
      title="Clique para editar"
      className="text-left text-4xl font-semibold tabular-nums text-ink transition hover:text-accent"
    >
      {brl(valor)}
    </button>
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
