"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { Ico } from "@/components/icons";
import { montarLinhas } from "@/lib/extrato";
import { rotuloData } from "@/lib/datas";
import { brl } from "@/lib/finance";

/**
 * Últimas movimentações lançadas (qualquer tipo), da mais recente para a mais antiga.
 * Mesmos dados do Extrato (lib/extrato.ts), em linhas enxutas: descrição, categoria, data e valor.
 * Entrada em verde, saída em vermelho e conta ainda não paga em âmbar (compromisso, não saída realizada).
 */
export default function MovimentacoesRecentes({
  extrato, cartao, contas, mes, onVerTudo, limite = 6,
}: { extrato: any[]; cartao: any[]; contas: any[]; mes: string; onVerTudo: () => void; limite?: number }) {
  const linhas = useMemo(() => {
    const todos = [
      ...extrato.map((i) => ({ o: "extrato", i })),
      ...cartao.map((i) => ({ o: "cartao", i })),
      ...contas.map((i) => ({ o: "contas", i })),
    ]
      .filter((x) => x.i.mes === mes)
      .sort((a, b) => String(b.i.created_at || "").localeCompare(String(a.i.created_at || "")))
      .slice(0, limite);
    const por = (o: string) => todos.filter((x) => x.o === o).map((x) => x.i);
    const ordem = todos.map((x) => `${x.o}-${x.i.id}`);
    return montarLinhas(por("extrato"), por("cartao"), por("contas"), mes).sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
  }, [extrato, cartao, contas, mes, limite]);

  return (
    <CartaoSecao titulo="Movimentações recentes" acao={{ rotulo: "Ver extrato", onClick: onVerTudo }}>
      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Nenhuma movimentação neste mês. Toque em Nova transação para lançar.</div>
      ) : (
        <ul className="-my-1 divide-y divide-line">
          {linhas.map((l) => {
            const saida = !l.entrada;
            const data = l.data ? `${l.origem === "contas" ? "Vence " : ""}${rotuloData(l.data)}` : "";
            return (
              <li key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
                <span className={`grid size-9 place-items-center rounded-full ${l.entrada ? "bg-pos-bg text-pos" : l.pendente ? "bg-warn-bg text-warn" : "bg-neg-bg text-neg"}`}>
                  <Ico icon={l.entrada ? ArrowDownLeft : ArrowUpRight} size={16} />
                </span>
                <span className="grid min-w-0">
                  <b className="truncate text-sm font-semibold">{l.descricao}</b>
                  <span className="truncate text-xs text-muted">{[l.categoria, data].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="grid justify-items-end">
                  <span className={`text-sm font-semibold tabular-nums ${l.entrada ? "text-pos" : l.pendente ? "text-warn" : "text-neg"}`}>
                    {l.entrada ? "+ " : saida ? "− " : ""}{brl(l.valor)}
                  </span>
                  {l.pendente && <span className="text-xs text-warn">A pagar</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </CartaoSecao>
  );
}
