"use client";

import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Users } from "lucide-react";
import { Ico } from "@/components/icons";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { brl, rotuloMes, useValoresOcultos } from "@/lib/finance";
import type { FinanceiroGrupo } from "@/lib/financeiroGrupo";
import MovimentacoesRecentes from "@/components/MovimentacoesRecentes";
import { saldo } from "./valores";

export type VisaoFinanceira = "pessoal" | "grupo";

/** Duas visões fixas (sem filtro por pessoa): o meu financeiro e o financeiro do grupo (o que criei para outros integrantes). */
export function SeletorVisaoFinanceira({ visao, onVisao }: { visao: VisaoFinanceira; onVisao: (v: VisaoFinanceira) => void }) {
  const opcoes: { id: VisaoFinanceira; rotulo: string }[] = [
    { id: "pessoal", rotulo: "Meu financeiro" },
    { id: "grupo", rotulo: "Financeiro do grupo" },
  ];
  return (
    <div role="radiogroup" aria-label="Visão financeira" className="inline-flex max-w-full rounded-full bg-background p-1 text-xs ring-1 ring-line">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={visao === o.id}
          onClick={() => onVisao(o.id)}
          className={`min-h-9 rounded-full px-4 py-1.5 font-medium transition ${visao === o.id ? "bg-accent text-on-accent shadow" : "text-muted hover:text-ink"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Indicador do grupo: entradas (verde) ou saídas (vermelho), com a composição em linhas curtas. */
function Indicador({ entrada, valor, itens }: { entrada: boolean; valor: number; itens: { rotulo: string; valor: number }[] }) {
  const rotulo = entrada ? "Entradas do grupo" : "Saídas do grupo";
  return (
    <section aria-label={rotulo} className={`grid min-w-0 content-start gap-3 rounded-2xl border p-4 @xl:p-5 ${entrada ? "border-pos-borda bg-pos-bg" : "border-neg-borda bg-neg-bg"}`}>
      <p className={`flex items-center gap-2 text-sm font-medium ${entrada ? "text-pos-ink" : "text-neg-ink"}`}>
        <span className={`grid size-8 shrink-0 place-items-center rounded-full ${entrada ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg"}`}><Ico icon={entrada ? ArrowDownLeft : ArrowUpRight} size={16} /></span>
        {rotulo}
      </p>
      <p data-sinal className={`text-2xl font-semibold leading-none tabular-nums [overflow-wrap:anywhere] ${entrada ? "text-pos" : "text-neg"}`}>{brl(valor)}</p>
      {itens.length > 0 && (
        <ul className="grid gap-1 border-t border-current/10 pt-2 text-xs text-muted">
          {itens.map((i) => (
            <li key={i.rotulo} className="flex items-baseline justify-between gap-3"><span>{i.rotulo}</span><span data-sinal className="tabular-nums">{brl(i.valor)}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function FinanceiroGrupoCard({
  g,
  extrato,
  cartao,
  contas,
  onVerExtrato,
  onAbrirRepasses,
}: {
  g: FinanceiroGrupo;
  /** Lançamentos de todos os integrantes (sem o filtro de pessoas), para as movimentações */
  extrato: any[];
  cartao: any[];
  contas: any[];
  onVerExtrato: () => void;
  onAbrirRepasses?: () => void;
}) {
  const nome = rotuloMes(g.mes).split(" de ")[0].toLowerCase();
  const [oculto, setOculto] = useValoresOcultos();
  const negativo = g.disponivelGrupo < -0.004;
  const meuPositivo = Math.max(g.meuDisponivel, 0);
  const meuNegativo = Math.max(-g.meuDisponivel, 0);
  const aReceber = g.pendente > 0.004;
  return (
    <div className="grid gap-5">
      {/* Saldo do grupo: destaque principal (mesmo card do Total disponível; vermelho quando negativo) */}
      <div className={`hc-hero hc-glow relative isolate grid content-between gap-3 overflow-hidden rounded-3xl p-5 @xl:p-6 ${negativo ? "hc-hero-neg" : ""}`}>
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-60 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-12 -z-10 size-52 rounded-full bg-white/[.07]" />
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-current/15"><Ico icon={Users} size={18} /></span>
            <span className="min-w-0">Saldo do grupo</span>
          </p>
          <button
            type="button"
            onClick={() => setOculto(!oculto)}
            aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
            aria-pressed={oculto}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-current/15 transition hover:bg-current/25 focus-visible:ring-2 focus-visible:ring-current md:size-10"
          >
            <Ico icon={oculto ? Eye : EyeOff} size={18} />
          </button>
        </div>
        <p data-sinal className="text-4xl font-bold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere] @4xl:text-5xl">{saldo(g.disponivelGrupo)}</p>
        <p className="text-xs leading-relaxed">
          Entradas − saídas, até o fim de {nome}.
          {aReceber && <> Ainda falta receber <b data-sinal className="font-semibold tabular-nums">{brl(g.pendente)}</b>{g.aguardando > 0.004 && <> ({brl(g.aguardando)} aguardando a minha confirmação)</>}.</>}
        </p>
      </div>

      {/* Entradas e saídas lado a lado (empilham em tela estreita) */}
      <div className="grid gap-3 @md:grid-cols-2">
        <Indicador
          entrada
          valor={g.entradasGrupo}
          itens={[...(meuPositivo > 0.004 ? [{ rotulo: "Meu dinheiro", valor: meuPositivo }] : []), ...(g.recebido > 0.004 ? [{ rotulo: "Repasses recebidos", valor: g.recebido }] : [])]}
        />
        <Indicador
          entrada={false}
          valor={g.saidasGrupo}
          itens={[...(g.utilizado > 0.004 ? [{ rotulo: "Utilizado pelos integrantes", valor: g.utilizado }] : []), ...(meuNegativo > 0.004 ? [{ rotulo: "Meu saldo negativo", valor: meuNegativo }] : [])]}
        />
      </div>

      <MovimentacoesRecentes extrato={extrato} cartao={cartao} contas={contas} mes={g.mes} onVerTudo={onVerExtrato} />

      <CartaoSecao titulo="Repasses por integrante" descricao={`Quanto cada integrante utilizou, devolveu e ainda falta, até o fim de ${nome}.`} acao={onAbrirRepasses ? { rotulo: "Ver repasses", onClick: onAbrirRepasses } : undefined}>
        {g.membros.length === 0 ? (
          <p className="text-sm text-muted">Nenhum repasse com outros integrantes neste período.</p>
        ) : (
          <ul className="grid gap-3">
            {g.membros.map((m) => (
              <li key={m.id} className="rounded-xl border border-line bg-background p-3">
                <p className="text-sm font-semibold">{m.nome}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted">Utilizou</dt><dd className="mt-0.5 text-sm tabular-nums">{saldo(m.utilizado)}</dd></div>
                  <div><dt className="text-muted">Devolveu</dt><dd className="mt-0.5 text-sm tabular-nums">{saldo(m.recebido)}</dd></div>
                  <div><dt className="text-muted">Falta receber</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums">{saldo(m.pendente)}{m.aguardando > 0.004 && <span className="block text-[11px] font-normal text-muted">{saldo(m.aguardando)} aguardando confirmação</span>}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </CartaoSecao>
    </div>
  );
}
