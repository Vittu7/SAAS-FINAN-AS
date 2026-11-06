"use client";

import type { PontoSerie } from "@/lib/admin";

interface Props {
  titulo: string;
  serie: PontoSerie[];
}

const L = 300;
const A = 90;
const BASE = 74;

function rotuloDia(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** Barras em SVG próprio, uma série só (cor de destaque do tema). Acessível por <title> e resumo textual. */
export default function GraficoBarrasSvg({ titulo, serie }: Props) {
  const max = Math.max(1, ...serie.map((p) => p.total));
  const total = serie.reduce((s, p) => s + p.total, 0);
  const n = Math.max(1, serie.length);
  const largura = L / n;
  const resumo = `${titulo}: ${total} no período de ${serie.length} dias.`;

  return (
    <figure className="card-flat flex min-w-0 flex-col gap-2 p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{titulo}</span>
        <span className="text-xs tabular-nums text-muted">{total} no período</span>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={resumo} className="h-28 w-full" preserveAspectRatio="none">
        <line x1="0" y1={BASE} x2={L} y2={BASE} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {serie.map((p, i) => {
          const h = (p.total / max) * (BASE - 6);
          return (
            <rect
              key={p.dia}
              x={i * largura + largura * 0.15}
              y={BASE - h}
              width={largura * 0.7}
              height={Math.max(h, p.total > 0 ? 1 : 0)}
              rx="1"
              fill="var(--accent)"
            >
              <title>{`${rotuloDia(p.dia)}: ${p.total}`}</title>
            </rect>
          );
        })}
      </svg>
      {serie.length > 1 && (
        <div className="flex justify-between text-[11px] tabular-nums text-muted" aria-hidden>
          <span>{rotuloDia(serie[0].dia)}</span>
          <span>{rotuloDia(serie[serie.length - 1].dia)}</span>
        </div>
      )}
    </figure>
  );
}
