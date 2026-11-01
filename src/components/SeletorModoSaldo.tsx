"use client";

import type { ModoSaldo } from "@/lib/painel";

const OPCOES: { id: ModoSaldo; rotulo: string }[] = [
  { id: "mes", rotulo: "Resultado do mês" },
  { id: "total", rotulo: "Total disponível" },
];

/** Alterna entre o resultado só do mês e o dinheiro acumulado disponível. */
export default function SeletorModoSaldo({ modo, onModo, className = "" }: { modo: ModoSaldo; onModo: (m: ModoSaldo) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Como mostrar o saldo" className={`inline-flex rounded-full bg-background p-1 text-xs ring-1 ring-line ${className}`}>
      {OPCOES.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={modo === o.id}
          onClick={() => onModo(o.id)}
          className={`rounded-full px-3 py-1.5 font-medium transition ${modo === o.id ? "bg-accent text-on-accent shadow" : "text-muted hover:text-ink"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
