"use client";

import { addMeses, rotuloMes } from "@/lib/finance";
import { composicaoDoDisponivel, type Painel } from "@/lib/painel";
import { comSinal, saldo, tomDoValor } from "./valores";

const nomeMes = (m: string) => rotuloMes(m).split(" de ")[0].toLowerCase();

/**
 * Análise do disponível (módulo Gráficos e relatórios): como chegamos ao total disponível e como ele vira a
 * sobra prevista. Saiu da tela inicial, que mostra só os dois números finais. Cálculos em lib/painel.ts.
 */
export default function DetalheDisponivel({ painel: p, mesCorrente }: { painel: Painel; mesCorrente: string }) {
  const n = nomeMes(p.mes);
  const agora = p.mes === mesCorrente;
  const rotuloDisp = agora ? "Total disponível" : `Total disponível ao fim de ${n}`;
  const comp = composicaoDoDisponivel(p, nomeMes(addMeses(p.mes, -1)));
  const prev = p.previsao;

  const linha = (rotulo: string, valor: number, tom: string) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
      <span className="min-w-0 text-muted">{rotulo}</span>
      <span className={`shrink-0 tabular-nums ${tom}`}>{comSinal(valor)}</span>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card-glass grid content-start gap-2 p-5" aria-label={`Como chegamos ao disponível de ${n}`}>
        <h3 className="text-base font-bold">Como chegamos {agora ? "ao disponível de hoje" : `ao disponível de ${n}`}</h3>
        <div>
          {comp.map((l, i) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
              <span className="min-w-0"><span className="text-muted">{l.rotulo}</span>{l.dica && <span className="block text-xs text-muted">{l.dica}</span>}</span>
              <span className={`shrink-0 tabular-nums ${i === 0 ? "" : tomDoValor(l.valor)}`}>{i === 0 ? saldo(l.valor) : comSinal(l.valor)}</span>
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3 font-bold">
            <span>= {rotuloDisp}</span><span className={`tabular-nums ${tomDoValor(p.totalDisponivel)}`}>{saldo(p.totalDisponivel)}</span>
          </div>
        </div>
      </section>

      <section className="card-glass grid content-start gap-2 p-5" aria-label="Sobra prevista">
        <h3 className="text-base font-bold">Sobra prevista com tudo acertado</h3>
        <div>
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
            <span className="text-muted">{rotuloDisp}</span><span className="tabular-nums">{saldo(p.totalDisponivel)}</span>
          </div>
          {Math.abs(prev.receber) >= 0.005 && linha("Você vai receber de repasses", prev.receber, prev.receber > 0 ? "text-pos" : "text-neg")}
          {Math.abs(prev.repassar) >= 0.005 && linha("Você vai repassar", -prev.repassar, "text-warn")}
          {Math.abs(prev.faturasOutros) >= 0.005 && linha("Faturas de compras para outras pessoas", prev.faturasOutros, "text-warn")}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3 font-bold">
            <span>= Sobra prevista</span><span data-sinal className={`tabular-nums ${tomDoValor(p.sobraPrevista)}`}>{saldo(p.sobraPrevista)}</span>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted">Considera os repasses e as faturas que ainda vão se acertar. Contas pendentes e compras no crédito já estão no disponível.</p>
      </section>
    </div>
  );
}
