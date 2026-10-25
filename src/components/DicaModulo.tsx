"use client";

import { CircleHelp, X } from "lucide-react";
import { Ico } from "@/components/icons";

/** Dica curta de "como usar" no topo de um módulo. Aparece até a pessoa dispensar; depois fica só na Central de Ajuda. */
export default function DicaModulo({
  titulo, passos, visivel, onDispensar, onVerTutorial,
}: {
  titulo: string;
  passos: string[];
  visivel: boolean;
  onDispensar: () => void;
  onVerTutorial: () => void;
}) {
  if (!visivel) return null;
  return (
    <aside className="anim-fade rounded-2xl border border-accent/25 bg-accent/8 p-4" aria-label={`Dica: ${titulo}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Ico icon={CircleHelp} size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{titulo}</p>
          <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-sm text-muted">
            {passos.map((p) => <li key={p}>{p}</li>)}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onDispensar} className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent">Entendi</button>
            <button type="button" onClick={onVerTutorial} className="h-9 rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent/10">Ver tutorial completo</button>
          </div>
        </div>
        <button type="button" onClick={onDispensar} aria-label="Fechar dica" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-background"><Ico icon={X} size={16} /></button>
      </div>
    </aside>
  );
}
