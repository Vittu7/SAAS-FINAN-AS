"use client";

import { brl, pct } from "@/lib/finance";

/** Peças visuais dos relatórios. Só usam as cores do tema (accent, line, muted), então seguem claro/escuro. */

export const curto = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

/** Variação em relação ao período anterior. `subirEBom`: entradas sobem = bom; gastos sobem = ruim. */
export function Variacao({ atual, anterior, subirEBom = false }: { atual: number; anterior: number; subirEBom?: boolean }) {
  if (!(anterior > 0)) return <span className="text-[11px] text-muted">sem período anterior</span>;
  const d = ((atual - anterior) / anterior) * 100;
  if (Math.abs(d) < 0.05) return <span className="text-[11px] text-muted">igual ao período anterior</span>;
  const bom = subirEBom ? d > 0 : d < 0;
  return (
    <span className={`text-[11px] font-medium ${bom ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
      {d > 0 ? "▲" : "▼"} {pct(Math.abs(d), 0)} <span className="font-normal text-muted">vs. período anterior ({brl(anterior)})</span>
    </span>
  );
}

export function Kpi({ rotulo, valor, tom, children }: { rotulo: string; valor: string; tom?: "bom" | "ruim"; children?: React.ReactNode }) {
  const cor = tom === "bom" ? "text-emerald-700 dark:text-emerald-400" : tom === "ruim" ? "text-rose-700 dark:text-rose-400" : "";
  return (
    <div className="card-glass min-w-0 p-4">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl ${cor}`}>{valor}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function Bloco({ titulo, descricao, children, acao }: { titulo: string; descricao?: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="card-glass space-y-4 p-5 md:p-6" aria-label={titulo}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{titulo}</h3>
          {descricao && <p className="text-xs text-muted">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function SemDados({ texto = "Sem dados neste período." }: { texto?: string }) {
  return <p className="py-8 text-center text-sm text-muted">{texto}</p>;
}

/** Ranking em barras horizontais (maior primeiro). */
export function Ranking({ itens, max = 8 }: { itens: { nome: string; valor: number; pct: number; sub?: string }[]; max?: number }) {
  if (!itens.length) return <SemDados />;
  const topo = itens.slice(0, max);
  const resto = itens.slice(max);
  const lista = resto.length ? [...topo, { nome: `Outras (${resto.length})`, valor: resto.reduce((t, x) => t + x.valor, 0), pct: resto.reduce((t, x) => t + x.pct, 0), sub: undefined }] : topo;
  const maior = Math.max(...lista.map((x) => x.valor), 1);
  return (
    <ul className="space-y-3">
      {lista.map((g) => (
        <li key={g.nome}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{g.nome}</span>
            <span className="shrink-0 tabular-nums font-semibold">{brl(g.valor)} <span className="text-xs font-normal text-muted">{pct(g.pct, 0)}</span></span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-background"><div className="anim-grow h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (g.valor / maior) * 100)}%` }} /></div>
          {g.sub && <p className="mt-0.5 text-[11px] text-muted">{g.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Colunas mês a mês: uma série (accent) ou duas (entradas x saídas). */
export function Colunas({ dados, duas = false }: { dados: { mes: string; a: number; b?: number }[]; duas?: boolean }) {
  const max = Math.max(1, ...dados.flatMap((d) => [d.a, d.b ?? 0]));
  const h = (v: number) => `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%`;
  const descr = dados.map((d) => `${curto(d.mes)}: ${brl(d.a)}${duas ? `, saídas ${brl(d.b ?? 0)}` : ""}`).join("; ");
  return (
    <div>
      <div className="flex h-48 items-end gap-1.5 sm:gap-3" role="img" aria-label={descr}>
        {dados.map((d) => (
          <div key={d.mes} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={descr.split("; ")[dados.indexOf(d)]}>
            <div className="flex h-full items-end justify-center gap-0.5">
              <div className={`anim-grow w-1/2 ${duas ? "max-w-5" : "max-w-8"} rounded-t ${duas ? "bg-emerald-600 dark:bg-emerald-500" : "bg-accent"}`} style={{ height: h(d.a) }} />
              {duas && <div className="anim-grow w-1/2 max-w-5 rounded-t bg-rose-600 dark:bg-rose-500" style={{ height: h(d.b ?? 0), animationDelay: "60ms" }} />}
            </div>
            <span className="truncate text-center text-[11px] capitalize text-muted">{curto(d.mes)}</span>
          </div>
        ))}
      </div>
      {duas && (
        <div className="mt-3 flex gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-600" />Entradas</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-600" />Saídas</span>
        </div>
      )}
    </div>
  );
}

/** Linha com área (evolução). Os rótulos dos meses ficam em HTML para não distorcer o texto. */
export function Linha({ dados }: { dados: { mes: string; valor: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  const W = 100, H = 40;
  const x = (i: number) => (dados.length === 1 ? W / 2 : (i / (dados.length - 1)) * W);
  const y = (v: number) => H - 3 - (v / max) * (H - 8);
  const pts = dados.map((d, i) => `${x(i)},${y(d.valor)}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;
  return (
    <div>
      <div className="relative h-44 text-accent" role="img" aria-label={dados.map((d) => `${curto(d.mes)}: ${brl(d.valor)}`).join("; ")}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible">
          <polygon points={area} fill="currentColor" opacity="0.12" />
          <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {dados.map((d, i) => (
          <span key={d.mes} className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface" style={{ left: `${x(i)}%`, top: `${(y(d.valor) / H) * 100}%` }} title={`${curto(d.mes)} · ${brl(d.valor)}`} />
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-1 text-[11px] capitalize text-muted">
        {dados.map((d) => <span key={d.mes} className="min-w-0 flex-1 truncate text-center">{curto(d.mes)}</span>)}
      </div>
    </div>
  );
}

export function Tabela({ cab, linhas, alinharDireita = [] }: { cab: string[]; linhas: React.ReactNode[][]; alinharDireita?: number[] }) {
  if (!linhas.length) return <SemDados />;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {cab.map((c, i) => <th key={c} scope="col" className={`py-2 pr-3 font-medium ${alinharDireita.includes(i) ? "text-right" : ""}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {linhas.map((l, r) => (
            <tr key={r}>{l.map((c, i) => <td key={i} className={`py-2 pr-3 ${alinharDireita.includes(i) ? "text-right tabular-nums" : ""} ${i === 0 ? "font-medium" : ""}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
