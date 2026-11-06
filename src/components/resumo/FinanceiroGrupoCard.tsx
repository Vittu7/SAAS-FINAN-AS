"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Users } from "lucide-react";
import { Ico } from "@/components/icons";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import DialogResponsivo from "@/components/DialogResponsivo";
import { brl, rotuloMes, useValoresOcultos } from "@/lib/finance";
import type { FinanceiroGrupo, MovimentoGrupo } from "@/lib/financeiroGrupo";
import { comSinal, saldo, tomDoValor } from "./valores";

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

/** Detalhe de Entradas/Saídas do grupo: a lista é a mesma que gera o indicador, com quem lançou e de quem é. */
function DetalheMovimentoGrupo({ titulo, mes, mov, onFechar }: { titulo: string; mes: string; mov: MovimentoGrupo; onFechar: () => void }) {
  return (
    <DialogResponsivo titulo={titulo} onFechar={onFechar}>
      <div className="space-y-4">
        <div className="rounded-3xl bg-background p-5 ring-1 ring-line">
          <p className="text-xs font-medium text-muted">{rotuloMes(mes)} · Financeiro do grupo</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{brl(mov.total)}</p>
          <p className="mt-1 text-xs text-muted">{mov.itens.length} {mov.itens.length === 1 ? "lançamento" : "lançamentos"} visíveis para você. Repasses e pagamentos de fatura não entram.</p>
        </div>
        {mov.itens.length === 0 ? (
          <p className="text-sm text-muted">Nenhum lançamento neste mês.</p>
        ) : (
          <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-background px-4">
            {mov.itens.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-4 py-3">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">{l.descricao}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[l.data ? l.data.split("-").reverse().join("/") : "", l.categoria, l.forma].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">Lançado por <b className="font-medium text-ink">{l.lancou}</b> · Responsável <b className="font-medium text-ink">{l.responsavel}</b></span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{brl(l.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DialogResponsivo>
  );
}

export default function FinanceiroGrupoCard({ g, onAbrirRepasses }: { g: FinanceiroGrupo; onAbrirRepasses?: () => void }) {
  const nome = rotuloMes(g.mes).split(" de ")[0].toLowerCase();
  const [oculto, setOculto] = useValoresOcultos();
  const [detalhe, setDetalhe] = useState<"entradas" | "saidas" | null>(null);
  const negativo = g.disponivelGrupo < -0.004;
  const resultado = Math.round((g.entradasGrupo.total - g.saidasGrupo.total) * 100) / 100;
  const maior = Math.max(g.entradasGrupo.total, g.saidasGrupo.total, 1);

  // Mesmo desenho das linhas "Entrou" e "Saiu" do Meu financeiro; ao tocar abre o detalhe do grupo
  const linhaMes = (tipo: "entradas" | "saidas", rotulo: string, valor: number) => {
    const entrada = tipo === "entradas";
    return (
      <button
        type="button"
        onClick={() => setDetalhe(tipo)}
        aria-label={`Ver ${entrada ? "entradas" : "saídas"} do grupo: ${brl(valor)}`}
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
        <span className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
          <span className={`hc-glow-pt block h-full rounded-full ${entrada ? "bg-serie-in [--glow-c:var(--serie-in)]" : "bg-serie-out [--glow-c:var(--serie-out)]"}`} style={{ width: `${(valor / maior) * 100}%` }} />
        </span>
      </button>
    );
  };
  return (
    <div className="grid gap-5">
      <CartaoSecao titulo="Financeiro do grupo" descricao={`Meu dinheiro e o que os integrantes utilizaram e devolveram, até o fim de ${nome}.`}>
        {/* Destaque: mesmo card do Total disponível do Meu financeiro (cor de destaque; vermelho quando negativo) */}
        <div className={`hc-hero hc-glow relative isolate grid content-between gap-3 overflow-hidden rounded-3xl p-5 @xl:p-6 ${negativo ? "hc-hero-neg" : ""}`}>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-60 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-12 -z-10 size-52 rounded-full bg-white/[.07]" />
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-current/15"><Ico icon={Users} size={18} /></span>
              <span className="min-w-0">Disponível do grupo</span>
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
          <p className="max-w-[48ch] text-xs leading-relaxed">
            {g.regraCaixa
              ? `Meu dinheiro disponível + contas pendentes e faturas em aberto (ainda não pagas) + repasses recebidos − utilizado pelos integrantes já pago, até o fim de ${nome}.`
              : `Meu dinheiro disponível + repasses recebidos − utilizado pelos integrantes, até o fim de ${nome}.`}
          </p>
        </div>
      </CartaoSecao>

      {/* Entrou e saiu: mesmo desenho do Meu financeiro, mas com todo o grupo (lançamentos visíveis para você) */}
      <CartaoSecao titulo={`Entrou e saiu em ${nome}`} descricao="Todo o grupo, nos lançamentos visíveis para você. Repasse e fatura paga não entram.">
        <div className="grid gap-3">
          {linhaMes("entradas", "Entrou", g.entradasGrupo.total)}
          {linhaMes("saidas", "Saiu", g.saidasGrupo.total)}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm font-medium">Resultado do mês</span>
          <span data-sinal className={`shrink-0 text-xl font-semibold tabular-nums ${tomDoValor(resultado)}`}>{comSinal(resultado)}</span>
        </div>
      </CartaoSecao>

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

      {detalhe && (
        <DetalheMovimentoGrupo
          titulo={detalhe === "entradas" ? "Entradas do grupo" : "Saídas do grupo"}
          mes={g.mes}
          mov={detalhe === "entradas" ? g.entradasGrupo : g.saidasGrupo}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}
