"use client";

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Ico } from "@/components/icons";
import { avisos, useAvisos } from "@/lib/avisos";
import type { Aviso, TipoAviso } from "@/lib/avisos";

const ESTILO: Record<TipoAviso, { icone: typeof Info; faixa: string; fundo: string }> = {
  sucesso: { icone: CheckCircle2, faixa: "bg-emerald-600", fundo: "bg-emerald-600/12 text-emerald-700 dark:text-emerald-400" },
  erro: { icone: AlertCircle, faixa: "bg-rose-600", fundo: "bg-rose-600/12 text-rose-700 dark:text-rose-400" },
  aviso: { icone: TriangleAlert, faixa: "bg-amber-500", fundo: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  info: { icone: Info, faixa: "bg-accent", fundo: "bg-accent/12 text-accent" },
};

function Cartao({ aviso }: { aviso: Aviso }) {
  const s = ESTILO[aviso.tipo];
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iniciar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => avisos.fechar(aviso.id), aviso.duracao);
  };
  const pausar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };

  useEffect(() => {
    iniciar();
    return pausar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso.id]);

  return (
    <div
      role={aviso.tipo === "erro" ? "alert" : "status"}
      onMouseEnter={pausar}
      onMouseLeave={iniciar}
      onFocus={pausar}
      onBlur={iniciar}
      className="hc-aviso pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface py-3 pl-4 pr-2 shadow-2xl"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${s.faixa}`} />
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${s.fundo}`}>
        <Ico icon={s.icone} size={18} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold leading-snug text-ink">{aviso.titulo}</p>
        {aviso.detalhe && <p className="mt-0.5 text-xs leading-snug text-muted">{aviso.detalhe}</p>}
      </div>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => avisos.fechar(aviso.id)}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-background hover:text-ink"
      >
        <Ico icon={X} size={16} />
      </button>
    </div>
  );
}

/** Pilha de avisos. No celular fica logo acima do menu inferior; no desktop, no canto inferior direito. */
export default function Avisos() {
  const lista = useAvisos();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[10060] flex flex-col gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      {lista.map((a) => <Cartao key={a.id} aviso={a} />)}
    </div>
  );
}
