"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Ico } from "@/components/icons";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { brl } from "@/lib/finance";
import { comSinal, tomDoValor } from "./valores";

type Tipo = "entradas" | "gastos";

/**
 * Cartão "Entrou e saiu no mês": entrou, saiu e resultado, com barras proporcionais.
 * Usado no Meu financeiro (valores meus) e no Financeiro do grupo (valores de todos os integrantes).
 * Só apresenta os números recebidos: quem chama decide o que entra em cada um.
 */
export default function EntrouESaiuCard({
  mes,
  entrou,
  saiu,
  saiuPagas,
  saiuAPagar = 0,
  descricao = "Entradas e saídas do mês, pagas e a pagar",
  onAbrirExtrato,
}: {
  /** Nome do mês em minúsculas (ex.: "outubro") */
  mes: string;
  entrou: number;
  /** Todas as saídas do mês: pagas + a pagar */
  saiu: number;
  /** Parte já paga das saídas (com `saiuAPagar`, detalha o total) */
  saiuPagas?: number;
  saiuAPagar?: number;
  descricao?: string;
  onAbrirExtrato?: (tipo: Tipo) => void;
}) {
  const resultado = Math.round((entrou - saiu) * 100) / 100;
  const maior = Math.max(entrou, saiu, 1);
  const pctSobrou = entrou > 0 ? Math.round((resultado / entrou) * 100) : 0;

  const linha = (tipo: Tipo, rotulo: string, valor: number) => {
    const entrada = tipo === "entradas";
    return (
      <button
        type="button"
        onClick={() => onAbrirExtrato?.(tipo)}
        aria-label={`Ver ${entrada ? "entradas" : "saídas"}: ${brl(valor)}`}
        className="-mx-2 grid gap-2 rounded-xl p-2 text-left transition hover:bg-background"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <span className={`hc-glow-pt grid size-8 place-items-center rounded-full ${entrada ? "bg-pos-bg text-pos [--glow-c:var(--pos)]" : "bg-neg-bg text-neg [--glow-c:var(--neg)]"}`}>
              <Ico icon={entrada ? ArrowDownLeft : ArrowUpRight} size={16} />
            </span>
            {rotulo}
          </span>
          <span className={`text-lg font-semibold tabular-nums ${entrada ? "text-pos" : "text-neg"}`}>{brl(valor)}</span>
        </span>
        {!entrada && saiuPagas !== undefined && saiuAPagar > 0.004 && (
          <span className="text-xs tabular-nums text-muted">Pagas {brl(saiuPagas)} · A pagar {brl(saiuAPagar)}</span>
        )}
        <span className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
          <span className={`hc-glow-pt block h-full rounded-full ${entrada ? "bg-serie-in [--glow-c:var(--serie-in)]" : "bg-serie-out [--glow-c:var(--serie-out)]"}`} style={{ width: `${(valor / maior) * 100}%` }} />
        </span>
      </button>
    );
  };

  return (
    <CartaoSecao titulo="Movimentações" descricao={descricao}>
      <div className="grid gap-3">
        {linha("entradas", "Entradas", entrou)}
        {linha("gastos", "Saídas", saiu)}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="grid min-w-0">
          <span className="text-sm font-medium">Resultado das movimentações</span>
          <span className="text-xs text-muted">{resultado > 0 ? `Sobrou ${pctSobrou}% do que entrou` : resultado < 0 ? "Saiu mais do que entrou" : "Entrou e saiu o mesmo valor"}</span>
        </span>
        <span data-sinal className={`shrink-0 text-xl font-semibold tabular-nums ${tomDoValor(resultado)}`}>{comSinal(resultado)}</span>
      </div>
    </CartaoSecao>
  );
}
