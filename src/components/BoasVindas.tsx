"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale, Sparkles } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";

const PASSOS = [
  { icone: Sparkles, titulo: "Bem-vindo ao HomeCash!", texto: "Aqui você organiza o dinheiro da casa em um só lugar: o que entra, o que sai e o que sobra. Vamos mostrar o básico em 3 telas rápidas." },
  { icone: Scale, titulo: "Três números importam", texto: "Entradas é o dinheiro que você recebeu. Saídas é o que você gastou. Saldo restante é a diferença: o que sobra no mês." },
  { icone: ArrowUpRight, titulo: "Tudo começa no botão +", texto: "Para registrar qualquer entrada ou saída, use Nova transação. Vamos deixar um guia de primeiros passos na tela inicial para você seguir no seu ritmo." },
] as const;

export default function BoasVindas({ nome, onConcluir }: { nome?: string; onConcluir: () => void }) {
  const [i, setI] = useState(0);
  const p = PASSOS[i];
  return (
    <DialogResponsivo titulo="Boas-vindas" onFechar={onConcluir}>
      <div className="space-y-5 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent/12 text-accent"><Ico icon={p.icone} size={30} /></span>
        <div key={i} className="anim-fade">
          <h3 className="text-xl font-bold">{i === 0 && nome ? `Olá, ${nome}! ` : ""}{p.titulo}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{p.texto}</p>
          {i === 1 && (
            <div className="mx-auto mt-4 grid max-w-sm grid-cols-3 gap-2 text-xs font-semibold">
              <span className="rounded-xl bg-emerald-500/12 p-3 text-emerald-700 dark:text-emerald-400"><Ico icon={ArrowDownLeft} size={16} className="mx-auto mb-1" />Entradas</span>
              <span className="rounded-xl bg-rose-500/12 p-3 text-rose-700 dark:text-rose-400"><Ico icon={ArrowUpRight} size={16} className="mx-auto mb-1" />Saídas</span>
              <span className="rounded-xl bg-accent/12 p-3 text-accent"><Ico icon={Scale} size={16} className="mx-auto mb-1" />Saldo</span>
            </div>
          )}
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden>{PASSOS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-1.5 bg-line"}`} />)}</div>
        <div className="flex gap-2">
          <button type="button" onClick={onConcluir} className="h-12 flex-1 rounded-xl border border-line text-sm font-medium">Pular</button>
          <button type="button" onClick={() => (i < PASSOS.length - 1 ? setI(i + 1) : onConcluir())} className="h-12 flex-[2] rounded-xl bg-accent text-sm font-semibold text-on-accent">{i < PASSOS.length - 1 ? "Próximo" : "Começar"}</button>
        </div>
      </div>
    </DialogResponsivo>
  );
}
