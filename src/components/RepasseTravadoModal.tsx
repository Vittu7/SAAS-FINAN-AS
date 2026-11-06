"use client";

import { ArrowRight, Lock } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";
import { brl, rotuloMes } from "@/lib/finance";
import type { LancGrupo } from "@/lib/grupo";
import { fecharOrientacaoRepasse, useOrientacaoRepasse } from "@/lib/repasseTravado";

/**
 * Orientação para lançamento com repasse confirmado: explica o que fazer e leva até Grupo → Repasses.
 * Não estorna, não edita e não exclui nada: quem estorna é quem recebeu, na tela de Repasses (com confirmação).
 */
export default function RepasseTravadoModal({ meuId, onIrParaRepasses }: { meuId: string; onIrParaRepasses: (l: LancGrupo | null) => void }) {
  const o = useOrientacaoRepasse();
  if (!o) return null;

  const r = o.repasses[0] ?? null;
  // Só quem recebeu o repasse (quem lançou a despesa) pode estornar. Sem dados para saber, não afirmamos nada.
  const euRecebi = r ? r.autorId === meuId : null;
  const verbo = o.acao === "excluir" ? "excluir" : "editar";

  const passos = [
    <>Acesse a seção <b>Grupo</b>.</>,
    <>Abra a aba <b>Repasses</b>{r ? <> (mês de {rotuloMes(r.mes)})</> : null}.</>,
    <>Em <b>Concluídos</b>, localize o repasse deste lançamento.</>,
    <>Use o botão <b>Estornar</b> (reabre o repasse).</>,
    <>Confirme a operação no aviso que abrir.</>,
    <>Volte ao lançamento e tente {verbo} de novo.</>,
  ];

  return (
    <DialogResponsivo titulo="Este lançamento possui um repasse confirmado" onFechar={fecharOrientacaoRepasse}>
      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-bg text-warn-ink"><Ico icon={Lock} size={20} /></span>
          <p className="text-sm text-muted">
            Este lançamento está vinculado a um repasse que já foi confirmado. Para {verbo} o lançamento, primeiro é necessário reabrir o repasse.
          </p>
        </div>

        {r && (
          <dl className="grid gap-2 rounded-xl border border-line bg-background p-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs text-muted">Lançamento</dt><dd className="font-semibold">{r.descricao}{r.parcela ? ` · ${r.parcela}` : ""}</dd></div>
            <div><dt className="text-xs text-muted">Valor</dt><dd className="font-semibold tabular-nums">{brl(r.valor)}</dd></div>
            <div><dt className="text-xs text-muted">Mês</dt><dd className="font-semibold">{rotuloMes(r.mes)}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Repasse</dt>
              <dd className="flex flex-wrap items-center gap-1.5 font-semibold">{r.respNome}<Ico icon={ArrowRight} size={13} />{r.autorNome}<span className="text-xs font-normal text-muted">(quem repassou → quem recebeu)</span></dd>
            </div>
            {r.repassePagoEm && (
              <div className="sm:col-span-2"><dt className="text-xs text-muted">Confirmado em</dt><dd className="font-semibold">{new Date(r.repassePagoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</dd></div>
            )}
          </dl>
        )}

        {o.outrosDaSerie > 0 && (
          <p className="rounded-xl bg-warn-bg p-3 text-xs leading-relaxed text-warn-ink">
            Esta compra ou conta fixa tem mais {o.outrosDaSerie} {o.outrosDaSerie === 1 ? "lançamento" : "lançamentos"} com repasse confirmado. Todos precisam ser reabertos.
          </p>
        )}

        {euRecebi === false && r && (
          <p className="rounded-xl bg-warn-bg p-3 text-sm leading-relaxed text-warn-ink">
            Só <b>{r.autorNome}</b>, que recebeu o repasse, pode reabri-lo. Peça a essa pessoa para estornar o repasse e depois tente {verbo} de novo.
          </p>
        )}
        {euRecebi === null && (
          <p className="rounded-xl bg-background p-3 text-sm leading-relaxed text-muted">
            Quem pode reabrir o repasse é quem o recebeu (quem lançou a despesa). Se não for você, peça a essa pessoa.
          </p>
        )}

        {euRecebi !== false && (
          <ol className="grid gap-2" aria-label="Passo a passo">
            {passos.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
        )}
        {euRecebi !== false && <p className="text-xs text-muted">Se o mês estiver fechado, o estorno só é possível depois de reabrir o mês.</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={fecharOrientacaoRepasse} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-background">Entendi</button>
          {euRecebi !== false && (
            <button
              type="button"
              onClick={() => { fecharOrientacaoRepasse(); onIrParaRepasses(r); }}
              className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent"
            >
              Ir para Repasses
            </button>
          )}
        </div>
      </div>
    </DialogResponsivo>
  );
}
