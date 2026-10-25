"use client";

import { Check, ChevronRight, X } from "lucide-react";
import { Ico } from "@/components/icons";

export type PassoGuia = { id: string; titulo: string; descricao: string; feito: boolean; opcional?: boolean; acao: string; onClick: () => void };

/** Checklist "Primeiros passos" da tela inicial: cada item leva direto à ação. Some quando tudo está feito. */
export default function GuiaInicial({ passos, onOcultar, onAjuda }: { passos: PassoGuia[]; onOcultar: () => void; onAjuda: () => void }) {
  const obrigatorios = passos.filter((p) => !p.opcional);
  const feitos = obrigatorios.filter((p) => p.feito).length;
  const pct = obrigatorios.length ? (feitos / obrigatorios.length) * 100 : 100;
  const proximo = passos.find((p) => !p.feito);

  return (
    <section className="card-glass space-y-4 p-5 md:p-6" aria-label="Primeiros passos">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Primeiros passos</h3>
          <p className="text-sm text-muted">{feitos} de {obrigatorios.length} concluídos. Siga no seu ritmo.</p>
        </div>
        <button type="button" onClick={onOcultar} aria-label="Ocultar guia de primeiros passos" title="Ocultar guia" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-background"><Ico icon={X} size={18} /></button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {passos.map((p) => {
          const destaque = !p.feito && p === proximo;
          return (
            <li key={p.id}>
              <button type="button" onClick={p.onClick} disabled={p.feito} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${p.feito ? "opacity-60" : destaque ? "bg-accent/10 ring-1 ring-accent/30 hover:bg-accent/15" : "hover:bg-background"}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${p.feito ? "bg-emerald-600 text-white" : "bg-background text-muted ring-1 ring-line"}`}>{p.feito ? <Ico icon={Check} size={16} /> : passos.indexOf(p) + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${p.feito ? "line-through" : ""}`}>{p.titulo}{p.opcional && <span className="ml-2 text-[10px] font-medium uppercase text-muted">opcional</span>}</span>
                  <span className="block text-xs text-muted">{p.descricao}</span>
                </span>
                {!p.feito && <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">{p.acao}<Ico icon={ChevronRight} size={14} /></span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onAjuda} className="text-sm font-medium text-accent hover:underline">Precisa de ajuda? Abrir a Central de ajuda</button>
    </section>
  );
}
