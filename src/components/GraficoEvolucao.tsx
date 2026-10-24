"use client";

import { useMemo, useState } from "react";
import { addMeses, brl } from "@/lib/finance";
import { calcularMes } from "@/lib/calculos";

const curto = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

/** Entradas (verde) x saídas (vermelho) mês a mês, terminando no mês selecionado. */
export default function GraficoEvolucao({ estado, mes }: { estado: { extrato: any[]; cartao: any[]; contas: any[]; config: { salario?: number } }; mes: string }) {
  const [n, setN] = useState(6);
  const dados = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => addMeses(mes, i - (n - 1))).map((m) => ({
        mes: m,
        ...calcularMes(estado, { mes: m, salarioConfig: estado.config?.salario ?? 0 }),
      })),
    [estado, mes, n],
  );
  const max = Math.max(1, ...dados.flatMap((d) => [d.entradas, d.saidas]));
  const h = (v: number) => `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%`;

  return (
    <section className="card-glass space-y-4 p-5 md:p-6" aria-label="Evolução mensal">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Evolução mensal</h3>
          <p className="text-sm text-muted">Entradas e saídas mês a mês.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-background p-1 ring-1 ring-line" role="group" aria-label="Quantidade de meses">
          {[6, 12].map((q) => (
            <button key={q} type="button" aria-pressed={n === q} onClick={() => setN(q)} className={`h-8 rounded-full px-4 text-xs font-medium transition ${n === q ? "bg-accent text-on-accent" : "text-muted"}`}>{q} meses</button>
          ))}
        </div>
      </div>

      <div className="flex h-48 items-end gap-1.5 sm:gap-3" role="img" aria-label={dados.map((d) => `${curto(d.mes)}: entradas ${brl(d.entradas)}, saídas ${brl(d.saidas)}`).join("; ")}>
        {dados.map((d) => (
          <div key={d.mes} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={`${curto(d.mes)} · entradas ${brl(d.entradas)} · saídas ${brl(d.saidas)}`}>
            <div className="flex h-full items-end justify-center gap-0.5">
              <div className="w-1/2 max-w-5 rounded-t bg-emerald-600 dark:bg-emerald-500" style={{ height: h(d.entradas) }} />
              <div className="w-1/2 max-w-5 rounded-t bg-rose-600 dark:bg-rose-500" style={{ height: h(d.saidas) }} />
            </div>
            <span className={`truncate text-center text-[11px] capitalize ${d.mes === mes ? "font-bold text-accent" : "text-muted"}`}>{curto(d.mes)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-600" />Entradas</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-600" />Saídas</span>
      </div>
    </section>
  );
}
