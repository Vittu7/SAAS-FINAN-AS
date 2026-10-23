"use client";

import { useRef, useState } from "react";
import { brl, parseValor, type Resumo } from "@/lib/finance";
import { valoresOcultos } from "@/lib/privacidade";

export default function SummaryCards({ resumo, salario, onConfig, onAbrirExtrato, onAbrirResumo }: { resumo: Resumo; salario: number; onConfig: (salario: number) => void; onAbrirExtrato?: (tipo: "gastos" | "disponivel") => void; onAbrirResumo?: (origem: "extrato" | "cartao" | "contas") => void }) {
  const negativo = resumo.sobra < 0;

  return (
    <section aria-label="Resumo do mês" className="grid gap-3 md:grid-cols-3">
      <div className="card-glass p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Salário mensal</p>
        <div className="mt-3">
          <SalarioEditavel valor={salario} onChange={onConfig} />
        </div>
        <p className="mt-2 text-xs text-muted">Clique no valor para editar.</p>
      </div>

      <div
        role={onAbrirExtrato ? "button" : undefined}
        tabIndex={onAbrirExtrato ? 0 : undefined}
        aria-label={onAbrirExtrato ? "Ver extrato dos gastos do mês" : undefined}
        onClick={() => onAbrirExtrato?.("gastos")}
        onKeyDown={(e) => { if (onAbrirExtrato && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrirExtrato("gastos"); } }}
        className={`card-glass p-5 md:p-6 ${onAbrirExtrato ? "cursor-pointer transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent" : ""}`}
      >
        <p className="text-sm font-medium text-muted">Gastos do mês{onAbrirExtrato && <span aria-hidden className="ml-1">›</span>}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{brl(resumo.totalGasto)}</p>
        <p className="mt-2 text-xs text-muted">Lançamentos, parcelas e contas fixas</p>
        <div role="group" aria-label="Gastos por origem" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
          {([["extrato", "Lançamentos do mês", resumo.porOrigem.extrato], ["cartao", "Parcelas", resumo.porOrigem.cartao], ["contas", "Fixas", resumo.porOrigem.contas]] as const).map(([origem, rotulo, valor]) => (
            <div key={origem}>
              {onAbrirResumo ? (
                <button type="button" onClick={(e) => { e.stopPropagation(); onAbrirResumo(origem); }} aria-label={`Abrir ${rotulo}`} className="rounded px-0.5 text-left underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent">
                  <span>{rotulo} </span><span className="font-medium text-ink">{brl(valor)}</span>
                </button>
              ) : (
                <><span>{rotulo} </span><span className="font-medium text-ink">{brl(valor)}</span></>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        role={onAbrirExtrato ? "button" : undefined}
        tabIndex={onAbrirExtrato ? 0 : undefined}
        aria-label={onAbrirExtrato ? "Ver extrato do valor disponível" : undefined}
        onClick={() => onAbrirExtrato?.("disponivel")}
        onKeyDown={(e) => { if (onAbrirExtrato && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onAbrirExtrato("disponivel"); } }}
        className={`relative overflow-hidden rounded-[1.25rem] p-5 shadow-xl md:p-6 ${negativo ? "bg-rose-600 text-white" : "bg-accent text-on-accent shadow-accent/25"} ${onAbrirExtrato ? "cursor-pointer transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white" : ""}`}
        aria-live="polite"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-white/10" />
        <p className="relative text-xs font-semibold uppercase tracking-wider opacity-80">{negativo ? "Acima do salário" : "Disponível após os gastos"}{onAbrirExtrato && <span aria-hidden className="ml-1">›</span>}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">{brl(Math.abs(resumo.sobra))}</p>
        <p className="mt-2 text-xs opacity-80">
          Salário {brl(resumo.salario)} − seus gastos {brl(resumo.meusGastos)}
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
    setTexto(valor && !valoresOcultos() ? String(valor).replace(".", ",") : "");
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
