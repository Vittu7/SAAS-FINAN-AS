"use client";

import { Eye, EyeOff } from "lucide-react";
import { Ico } from "@/components/icons";
import { useValoresOcultos } from "@/lib/finance";

/** Liga/desliga a ocultação de TODOS os valores do sistema (lembra a escolha neste aparelho). */
export default function BotaoOcultarValores({ className = "" }: { className?: string }) {
  const [ocultos, definir] = useValoresOcultos();
  return (
    <button
      type="button"
      onClick={() => definir(!ocultos)}
      aria-pressed={ocultos}
      aria-label={ocultos ? "Mostrar valores" : "Ocultar valores"}
      title={ocultos ? "Mostrar valores" : "Ocultar valores"}
      className={`grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:text-ink active:scale-95 ${className}`}
    >
      <Ico icon={ocultos ? EyeOff : Eye} size={18} />
    </button>
  );
}
