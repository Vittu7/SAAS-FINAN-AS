"use client";

import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Ico } from "@/components/icons";

export type PassoGuia = {
  id: string;
  titulo: string;
  descricao: string;
  feito: boolean;
  /** essencial = o básico para usar o sistema; complementar = personalização, pode ficar para depois */
  prioridade: "essencial" | "complementar";
  acao: string;
  onClick: () => void;
};

/**
 * Checklist "Primeiros passos" da tela inicial, em ordem de prioridade: primeiro o essencial (cadastros e primeiros
 * lançamentos), depois o complementar (grupo, aparência, personalização). Qualquer etapa pode ser PULADA sem sair do
 * guia; as puladas ficam guardadas e podem ser retomadas. Some quando tudo está feito ou pulado.
 */
export default function GuiaInicial({
  passos, puladas, onPular, onRetomar, onOcultar, onAjuda,
}: {
  passos: PassoGuia[];
  puladas: string[];
  onPular: (id: string) => void;
  onRetomar: (id: string) => void;
  onOcultar: () => void;
  onAjuda: () => void;
}) {
  const [verPuladas, setVerPuladas] = useState(false);
  const foiPulado = (p: PassoGuia) => !p.feito && puladas.includes(p.id);
  const pendentes = passos.filter((p) => !p.feito && !foiPulado(p));
  const ignorados = passos.filter(foiPulado);
  const essenciais = passos.filter((p) => p.prioridade === "essencial");
  const feitosEssenciais = essenciais.filter((p) => p.feito).length;
  const pct = essenciais.length ? (feitosEssenciais / essenciais.length) * 100 : 100;
  const proximo = pendentes[0];

  const linha = (p: PassoGuia, numero: number) => {
    const destaque = p === proximo;
    return (
      <li key={p.id} className={`flex items-center gap-1 rounded-xl transition ${p.feito ? "opacity-60" : destaque ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-background"}`}>
        <button type="button" onClick={p.onClick} disabled={p.feito} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left">
          <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${p.feito ? "bg-emerald-600 text-white" : "bg-background text-muted ring-1 ring-line"}`}>{p.feito ? <Ico icon={Check} size={16} /> : numero}</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-semibold ${p.feito ? "line-through" : ""}`}>{p.titulo}</span>
            <span className="block text-xs text-muted">{p.descricao}</span>
          </span>
          {!p.feito && <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">{p.acao}<Ico icon={ChevronRight} size={14} /></span>}
        </button>
        {!p.feito && (
          <button type="button" onClick={() => onPular(p.id)} aria-label={`Pular etapa: ${p.titulo}`} className="mr-2 h-9 shrink-0 rounded-lg px-3 text-xs font-medium text-muted hover:bg-background hover:text-ink">Pular</button>
        )}
      </li>
    );
  };

  const secao = (titulo: string, sub: string, itens: PassoGuia[], inicio: number) =>
    itens.length > 0 && (
      <div className="space-y-1.5">
        <div className="px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{titulo}</p>
          <p className="text-[11px] text-muted">{sub}</p>
        </div>
        <ul className="space-y-1.5">{itens.map((p, i) => linha(p, inicio + i + 1))}</ul>
      </div>
    );

  const essenciaisVisiveis = passos.filter((p) => p.prioridade === "essencial" && (p.feito || !foiPulado(p)));
  const complementaresVisiveis = passos.filter((p) => p.prioridade === "complementar" && (p.feito || !foiPulado(p)));

  return (
    <section className="card-glass space-y-4 p-5 md:p-6" aria-label="Primeiros passos">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Primeiros passos</h3>
          <p className="text-sm text-muted">
            {feitosEssenciais} de {essenciais.length} etapas essenciais concluídas{ignorados.length > 0 && ` · ${ignorados.length} ${ignorados.length === 1 ? "pulada" : "puladas"}`}. Siga no seu ritmo: pode pular qualquer etapa.
          </p>
        </div>
        <button type="button" onClick={onOcultar} aria-label="Ocultar guia de primeiros passos" title="Ocultar guia" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-background"><Ico icon={X} size={18} /></button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {secao("Essencial", "Comece por aqui: cadastre antes de lançar.", essenciaisVisiveis, 0)}
      {secao("Para depois", "Complementos e personalização. Sem pressa.", complementaresVisiveis, essenciaisVisiveis.length)}

      {ignorados.length > 0 && (
        <div className="rounded-xl bg-background p-3">
          <button type="button" onClick={() => setVerPuladas((v) => !v)} aria-expanded={verPuladas} className="text-xs font-semibold text-muted hover:text-ink">
            {verPuladas ? "Ocultar" : "Ver"} etapas puladas ({ignorados.length})
          </button>
          {verPuladas && (
            <ul className="mt-2 space-y-1">
              {ignorados.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{p.titulo}</span>
                  <button type="button" onClick={() => onRetomar(p.id)} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent hover:underline"><Ico icon={RotateCcw} size={12} />Retomar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="button" onClick={onAjuda} className="text-sm font-medium text-accent hover:underline">Precisa de ajuda? Abrir a Central de ajuda</button>
    </section>
  );
}
