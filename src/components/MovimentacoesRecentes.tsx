"use client";

import { useMemo } from "react";
import { montarLinhas } from "@/lib/extrato";
import ExtratoLista from "@/components/ExtratoLista";

/** Últimas movimentações lançadas (qualquer tipo), no mesmo formato do Extrato. */
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
    <section className="card-glass space-y-3 p-5 md:p-6" aria-label="Movimentações recentes">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Movimentações recentes</h3>
        <button type="button" onClick={onVerTudo} className="text-sm font-medium text-accent hover:underline">Ver tudo</button>
      </div>
      <ExtratoLista linhas={linhas} ordem="maior" vazio="Nenhuma movimentação neste mês. Toque em + para lançar." />
    </section>
  );
}
