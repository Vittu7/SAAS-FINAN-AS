"use client";

import { useEffect, useRef, useState } from "react";
import { brl, rotuloMes } from "@/lib/finance";
import { comSinal } from "./valores";

type Ponto = { mes: string; entrou: number; saiu: number };

const curto = (mes: string) => rotuloMes(mes).slice(0, 3);

/**
 * Entrou x Saiu dos últimos meses: barras pareadas, um eixo, grade discreta, dica ao passar o mouse ou focar.
 * Cores do par validadas para daltonismo (verde mais claro x vermelho mais escuro) e legenda sempre visível.
 */
export default function GraficoEntradasSaidas({ serie }: { serie: Ponto[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maior = Math.max(1, ...serie.flatMap((p) => [p.entrou, p.saiu]));
  const passo = maior <= 1000 ? 500 : maior <= 4000 ? 1000 : maior <= 10000 ? 2000 : 5000;
  const topo = Math.ceil(maior / passo) * passo;
  const W = largura, H = W < 420 ? 190 : 220, pl = 52, pr = 6, pt = 10, pb = 30;
  const ih = H - pt - pb, gw = serie.length ? (W - pl - pr) / serie.length : 0, bw = Math.max(6, Math.min(22, (gw - 16) / 2));
  const y = (v: number) => pt + ih - (v / topo) * ih;
  const barra = (x: number, v: number) => {
    const yy = y(v), b = pt + ih, r = Math.min(4, (b - yy) / 2);
    if (v <= 0) return "";
    return `M${x},${b} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${b} Z`;
  };
  const marcas = [0, topo / 2, topo];
  const rotuloEixo = (v: number) => (v === 0 ? "R$ 0" : v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")} mil` : String(v));
  const dica = ativo !== null ? serie[ativo] : null;

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-bold">Últimos {serie.length} meses</h3>
        <p className="flex gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-serie-in" />Entrou</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-serie-out" />Saiu</span>
        </p>
      </div>
      <div ref={caixa} className="relative min-w-0">
        {W > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} height={H} className="block w-full overflow-visible" role="img" aria-label="Entradas e saídas dos últimos meses">
            {marcas.map((t) => (
              <g key={t}>
                <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)", strokeWidth: 1 }} />
                <text x={pl - 8} y={y(t) + 4} textAnchor="end" style={{ fill: "var(--muted)", fontSize: 12 }}>{rotuloEixo(t)}</text>
              </g>
            ))}
            {serie.map((p, i) => {
              const cx = pl + gw * i + gw / 2, ultimo = i === serie.length - 1;
              return (
                <g key={p.mes}>
                  <path d={barra(cx - bw - 1, p.entrou)} style={{ fill: "var(--serie-in)" }} />
                  <path d={barra(cx + 1, p.saiu)} style={{ fill: "var(--serie-out)" }} />
                  <text x={cx} y={H - 8} textAnchor="middle" style={{ fill: ultimo ? "var(--ink)" : "var(--muted)", fontSize: 12, fontWeight: ultimo ? 700 : 500 }}>{curto(p.mes)}</text>
                  <rect
                    x={pl + gw * i} y={pt} width={gw} height={ih} tabIndex={0}
                    style={{ fill: "transparent", cursor: "pointer", outline: "none" }}
                    aria-label={`${rotuloMes(p.mes)}: entrou ${brl(p.entrou)}, saiu ${brl(p.saiu)}`}
                    onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {dica && ativo !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs leading-relaxed text-background shadow-lg"
            style={{ left: Math.min(Math.max(pl + gw * ativo + gw / 2, 80), W - 80), top: y(Math.max(dica.entrou, dica.saiu)) - 6 }}
          >
            <b>{rotuloMes(dica.mes)}</b><br />Entrou {brl(dica.entrou)}<br />Saiu {brl(dica.saiu)}<br />Resultado {comSinal(dica.entrou - dica.saiu)}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-accent md:min-h-9">Ver em tabela</summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead><tr className="text-muted"><th className="py-1.5 text-left font-semibold">Mês</th><th className="text-right font-semibold">Entrou</th><th className="text-right font-semibold">Saiu</th><th className="text-right font-semibold">Resultado</th></tr></thead>
            <tbody>
              {serie.map((p) => (
                <tr key={p.mes} className="border-t border-line">
                  <td className="py-1.5">{rotuloMes(p.mes)}</td>
                  <td className="text-right tabular-nums text-pos">{brl(p.entrou)}</td>
                  <td className="text-right tabular-nums text-neg">{brl(p.saiu)}</td>
                  <td className={`text-right tabular-nums ${p.entrou - p.saiu > 0 ? "text-pos" : p.entrou - p.saiu < 0 ? "text-neg" : ""}`}>{comSinal(p.entrou - p.saiu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
