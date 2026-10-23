"use client";

import { Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Ico } from "@/components/icons";
import { useState } from "react";
import { brl } from "@/lib/finance";

export type ItemMobile = {
  id: string;
  titulo: string;
  subtitulo?: string;
  valor: number;
  icone: LucideIcon;
  tags?: string[];
  status?: { texto: string; tom: "ok" | "alerta" | "neutro" };
  progresso?: number; // 0 a 100 (parcelas)
  onEditar?: () => void;
  onRemover?: () => void;
  onAlternar?: () => void;
  rotuloAlternar?: string;
};

const TOM = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  alerta: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  neutro: "bg-accent/10 text-accent",
};

/** Lista em cartões para celular: toque no item para ver as ações. */
export default function MobileLista({
  itens,
  vazio,
  resumo,
}: {
  itens: ItemMobile[];
  vazio: string;
  resumo?: { rotulo: string; valor: number; extra?: string };
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const total = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-end justify-between rounded-2xl bg-background px-4 py-3">
        <div>
          <p className="text-xs text-muted">{resumo?.rotulo ?? "Total do mês"}</p>
          <p className="text-xl font-semibold tabular-nums">{brl(resumo?.valor ?? total)}</p>
        </div>
        <p className="text-xs text-muted">{resumo?.extra ?? `${itens.length} ${itens.length === 1 ? "item" : "itens"}`}</p>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">{vazio}</div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {itens.map((i) => {
            const exp = aberto === i.id;
            const temAcoes = i.onEditar || i.onRemover || i.onAlternar;
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => temAcoes && setAberto(exp ? null : i.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-background"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Ico icon={i.icone} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{i.titulo}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                      {i.subtitulo}
                    </span>
                    {i.progresso != null && (
                      <span className="mt-1.5 block h-1 w-full max-w-32 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, i.progresso)}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{brl(i.valor)}</span>
                    {i.status && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TOM[i.status.tom]}`}>{i.status.texto}</span>
                    )}
                  </span>
                </button>

                {exp && (
                  <div className="space-y-3 bg-background/60 px-4 pb-3 pt-1">
                    {i.tags && i.tags.filter(Boolean).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {i.tags.filter(Boolean).map((t) => (
                          <span key={t} className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted ring-1 ring-line">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {i.onAlternar && (
                        <button type="button" onClick={i.onAlternar} className="h-10 flex-1 rounded-full bg-accent text-sm font-medium text-on-accent active:scale-[0.98]">
                          {i.rotuloAlternar}
                        </button>
                      )}
                      {i.onEditar && (
                        <button type="button" onClick={i.onEditar} className="h-10 flex-1 rounded-full bg-surface text-sm font-medium ring-1 ring-line active:scale-[0.98]">
                          <span className="inline-flex items-center justify-center gap-1.5"><Ico icon={Pencil} size={16} />Editar</span>
                        </button>
                      )}
                      {i.onRemover && (
                        <button type="button" onClick={() => { if (window.confirm("Remover este item?")) i.onRemover?.(); }}
                          className="h-10 flex-1 rounded-full bg-rose-500/10 text-sm font-medium text-rose-500 active:scale-[0.98]">
                          <span className="inline-flex items-center justify-center gap-1.5"><Ico icon={Trash2} size={16} />Remover</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
