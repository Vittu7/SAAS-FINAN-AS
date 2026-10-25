"use client";

import type { LucideIcon } from "lucide-react";
import { Ico } from "@/components/icons";

type Acao = { rotulo: string; onClick: () => void };

/**
 * Tela vazia que ensina: diz o que é o módulo, o que fazer e dá um botão que resolve.
 * `compacto` é para quando só o mês está vazio (a pessoa já usa o módulo).
 */
export default function EstadoVazio({
  icone, titulo, descricao, passos, acao, acaoSecundaria, compacto = false,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  passos?: string[];
  acao?: Acao;
  acaoSecundaria?: Acao;
  compacto?: boolean;
}) {
  return (
    <section className={`card-glass anim-fade text-center ${compacto ? "p-6" : "p-6 md:p-10"}`} aria-label={titulo}>
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent/12 text-accent"><Ico icon={icone} size={26} /></span>
      <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{descricao}</p>
      {passos && passos.length > 0 && !compacto && (
        <ol className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm">
          {passos.map((p, i) => (
            <li key={p} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      )}
      {(acao || acaoSecundaria) && (
        <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {acao && <button type="button" onClick={acao.onClick} className="h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-on-accent shadow-lg shadow-accent/20 transition active:scale-[0.98]">{acao.rotulo}</button>}
          {acaoSecundaria && <button type="button" onClick={acaoSecundaria.onClick} className="h-11 rounded-xl border border-line bg-surface px-5 text-sm font-medium transition hover:bg-background active:scale-[0.98]">{acaoSecundaria.rotulo}</button>}
        </div>
      )}
    </section>
  );
}
