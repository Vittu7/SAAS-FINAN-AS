"use client";

import { Selo } from "@/components/SeletorOpcao";
import { brl } from "@/lib/finance";
import { agruparPorOrigem, ICONE_ORIGEM, type LinhaExtrato, type Ordem } from "@/lib/extrato";
import { COR_PADRAO, useOpcoes } from "@/lib/useOpcoes";

const TOM = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  alerta: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  neutro: "bg-accent/10 text-accent",
};

/**
 * Lista de movimentações no estilo de extrato de banco digital.
 * Sem ordenação por valor: agrupada por origem, com subtotal.
 * Com ordenação por valor: lista única já ordenada (agrupar a embaralharia).
 */
export default function ExtratoLista({
  linhas,
  ordem,
  vazio,
}: {
  linhas: LinhaExtrato[];
  ordem: Ordem;
  vazio: string;
}) {
  const { corCategoria } = useOpcoes();

  if (linhas.length === 0) {
    return <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">{vazio}</div>;
  }

  const entradas = linhas.filter((l) => l.entrada);
  const gastos = linhas.filter((l) => !l.entrada);
  const grupos = ordem ? [] : agruparPorOrigem(gastos);

  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {entradas.length > 0 && (
        <ul className="divide-y divide-line">
          {entradas.map((l) => (
            <Linha key={l.id} linha={l} cor={corCategoria(l.categoria)} />
          ))}
        </ul>
      )}

      {ordem ? (
        <ul className="divide-y divide-line">
          {gastos.map((l) => (
            <Linha key={l.id} linha={l} cor={corCategoria(l.categoria)} />
          ))}
        </ul>
      ) : (
        grupos.map((g) => (
          <section key={g.origem} aria-label={g.rotulo}>
            <header className="flex items-baseline justify-between gap-3 border-y border-line bg-background/60 px-4 py-2 first:border-t-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{g.rotulo}</h3>
              <span className="text-xs font-semibold tabular-nums text-muted">{brl(g.total)}</span>
            </header>
            <ul className="divide-y divide-line">
              {g.linhas.map((l) => (
                <Linha key={l.id} linha={l} cor={corCategoria(l.categoria)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Linha({ linha: l, cor }: { linha: LinhaExtrato; cor: string }) {
  const corIcone = l.entrada ? "#10B981" : cor || COR_PADRAO;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full text-lg"
        style={{ backgroundColor: `${corIcone}26`, color: corIcone }}
      >
        {l.entrada ? "↓" : ICONE_ORIGEM[l.origem]}
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{l.descricao}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {l.categoria && <Selo nome={l.categoria} cor={cor} />}
          <span className="min-w-0 truncate text-xs text-muted">{[l.forma, l.responsavel].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-sm font-semibold tabular-nums ${l.entrada ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
          {l.entrada ? "+ " : ""}
          {brl(l.valor)}
        </span>
        {l.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TOM[l.status.tom]}`}>{l.status.texto}</span>}
      </div>
    </li>
  );
}
