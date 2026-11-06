"use client";

import { Eye, TriangleAlert, X } from "lucide-react";
import { Ico } from "@/components/icons";
import { brl } from "@/lib/finance";
import { rotuloData } from "@/lib/datas";
import { ROTULO_TABELA, type GrupoBloqueio, type LancamentoBloqueador } from "@/lib/bloqueioExclusao";

/**
 * Mostra por que o grupo (ou o convidado) não pôde ser excluído: quais lançamentos ainda têm o convidado como
 * responsável. Não apaga nem altera nada: o gestor decide o que fazer com cada lançamento e tenta de novo.
 */
export default function BloqueioExclusaoModal({
  acao,
  grupos,
  onVer,
  onClose,
}: {
  acao: "excluir o grupo" | "remover o convidado";
  grupos: GrupoBloqueio[];
  onVer: (l: LancamentoBloqueador) => void;
  onClose: () => void;
}) {
  const total = grupos.reduce((t, g) => t + g.lancamentos.length, 0);

  return (
    <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bloqueio-titulo">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-background shadow-2xl">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 text-muted hover:text-ink">
          <Ico icon={X} />
        </button>

        <div className="flex items-start gap-3 p-6 pb-3 pr-12">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
            <Ico icon={TriangleAlert} size={20} />
          </span>
          <div>
            <h2 id="bloqueio-titulo" className="text-lg font-bold">Não foi possível {acao}</h2>
            <p className="mt-1 text-sm text-muted">
              {total > 0
                ? `Ainda há ${total} lançamento${total > 1 ? "s" : ""} em nome de ${grupos.length > 1 ? "convidados" : "um convidado"} sem conta. Troque o responsável ou exclua cada um deles e tente de novo. Nada foi apagado.`
                : "Há lançamentos em nome de um convidado que não aparecem para você (são de outra pessoa do grupo). Peça a quem os lançou para trocar o responsável ou excluí-los, e tente de novo. Nada foi apagado."}
            </p>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 pb-2">
          {grupos.map((g) => (
            <section key={g.convidado.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {g.convidado.nome}
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                  {g.lancamentos.length} lançamento{g.lancamentos.length > 1 ? "s" : ""}
                </span>
              </h3>
              <ul className="space-y-2">
                {g.lancamentos.map((l) => (
                  <li key={`${l.tabela}-${l.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.descricao}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">{ROTULO_TABELA[l.tabela]}</span>
                        {l.data ? <span>{rotuloData(l.data)} {l.data.slice(0, 4)}</span> : <span>{l.mes}</span>}
                        {l.categoria && <span>· {l.categoria}</span>}
                        <span>· Responsável: {l.responsavel}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-bold">{brl(l.valor)}</span>
                      <button
                        type="button"
                        onClick={() => onVer(l)}
                        className="inline-flex items-center gap-1 rounded-lg border border-accent px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/10"
                      >
                        <Ico icon={Eye} size={13} />Ver lançamento
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="p-6 pt-4">
          <button onClick={onClose} className="w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium transition hover:bg-muted/10">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
