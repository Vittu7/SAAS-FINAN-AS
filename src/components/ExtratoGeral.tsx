"use client";

import { useMemo, useState } from "react";
import EditarLancamentoModal from "@/components/EditarLancamentoModal";
import ExtratoLista from "@/components/ExtratoLista";
import { brl } from "@/lib/finance";
import { montarLinhas, ordenarPorValor, totalGastos, type LinhaExtrato, type Ordem, type OrigemLinha } from "@/lib/extrato";

type Props = {
  mes: string;
  extrato: any[];
  cartao: any[];
  contas: any[];
  /** Ordenação por valor escolhida nos filtros ("" = padrão). */
  ordem?: Ordem;
  membros?: string[];
  onEdit?: (origem: OrigemLinha, id: string, patch: Record<string, any>) => Promise<boolean | void>;
  onRemove?: (origem: OrigemLinha, id: string) => void;
};

export default function ExtratoGeral({ mes, extrato, cartao, contas, ordem = "", membros = [], onEdit, onRemove }: Props) {
  const [editando, setEditando] = useState<{ origem: OrigemLinha; item: any } | null>(null);
  const fontes: Record<OrigemLinha, any[]> = { extrato, cartao, contas };
  const rawId = (l: LinhaExtrato) => l.id.slice(l.origem.length + 1);
  const abrirEdicao = (l: LinhaExtrato) => {
    const item = fontes[l.origem].find((i) => String(i.id) === rawId(l));
    if (item) setEditando({ origem: l.origem, item });
  };
  const remover = (l: LinhaExtrato) => {
    if (window.confirm(`Remover "${l.descricao}"? Essa ação não pode ser desfeita.`)) onRemove?.(l.origem, rawId(l));
  };
  const linhas = useMemo(
    () => ordenarPorValor(montarLinhas(extrato, cartao, contas, mes), ordem),
    [extrato, cartao, contas, mes, ordem],
  );
  const total = totalGastos(linhas);

  return (
    <section className="space-y-4 md:rounded-2xl md:border md:border-line md:bg-surface md:p-6 md:shadow-lg">
      <header className="flex items-end justify-between gap-3 rounded-2xl bg-background px-4 py-3 md:bg-transparent md:px-0 md:py-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Extrato do mês</h2>
          <p className="text-sm text-muted">Lançamentos do mês, parcelas e contas fixas.</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-xs text-muted">
            {linhas.length} {linhas.length === 1 ? "movimentação" : "movimentações"}
          </span>
          <span className="text-xl font-semibold tabular-nums">{brl(total)}</span>
        </p>
      </header>

      <ExtratoLista linhas={linhas} ordem={ordem} vazio="Não há movimentações neste mês." onEditar={onEdit ? abrirEdicao : undefined} onRemover={onRemove ? remover : undefined} />

      {editando && onEdit && (
        <EditarLancamentoModal
          tipo={editando.origem}
          item={editando.item}
          membros={membros}
          onSalvar={(patch) => onEdit(editando.origem, String(editando.item.id), patch)}
          onClose={() => setEditando(null)}
        />
      )}
    </section>
  );
}
