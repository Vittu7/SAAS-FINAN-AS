"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Ico } from "@/components/icons";
import { SENHA_MIN } from "@/lib/auth";

/** Campo de senha com botão de mostrar/ocultar e indicação clara do requisito mínimo. */
export default function CampoSenha({
  id, rotulo, valor, onChange, autoComplete, mostrarRequisito = false, placeholder = "••••••••", invalido = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  mostrarRequisito?: boolean;
  placeholder?: string;
  invalido?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  const ok = valor.length >= SENHA_MIN;
  const erro = invalido && !ok;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted">{rotulo}</label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={erro}
          aria-describedby={mostrarRequisito ? `${id}-req` : undefined}
          className={`h-12 w-full rounded-xl border bg-background pl-4 pr-12 text-base text-ink outline-none transition focus:ring-2 ${erro ? "border-rose-500 focus:ring-rose-500/40" : "border-line focus:ring-accent"}`}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink"
        >
          <Ico icon={visivel ? EyeOff : Eye} size={18} />
        </button>
      </div>
      {mostrarRequisito && (
        <p id={`${id}-req`} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? "text-emerald-600 dark:text-emerald-400" : erro ? "text-rose-600 dark:text-rose-400" : "text-muted"}`} role={erro ? "alert" : undefined}>
          {ok ? <Ico icon={Check} size={13} /> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
          {erro ? `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` : `Mínimo de ${SENHA_MIN} caracteres`}
        </p>
      )}
    </div>
  );
}
