"use client";

import { Eye, EyeOff, Users } from "lucide-react";
import { Ico } from "@/components/icons";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { rotuloMes, useValoresOcultos } from "@/lib/finance";
import type { FinanceiroGrupo } from "@/lib/financeiroGrupo";
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

/** Linha de indicador: descrição à esquerda (com apoio opcional) e valor alinhado à direita. */
function Linha({ rotulo, valor, tom = false, dica, forte = false }: { rotulo: string; valor: string; tom?: number | false; dica?: string; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${forte ? "font-semibold" : ""}`}>
      <span className="min-w-0 text-sm">
        <span className={forte ? "" : "text-muted"}>{rotulo}</span>
        {dica && <span className="mt-0.5 block text-xs font-normal leading-snug text-muted">{dica}</span>}
      </span>
      <span data-sinal className={`shrink-0 text-right tabular-nums ${forte ? "text-base" : "text-sm font-medium"} ${tom === false ? "" : tomDoValor(tom)}`}>{valor}</span>
    </div>
  );
}

/** Bloco de linhas: fundo do tema, borda arredondada e divisórias discretas (mesmo acabamento dos cartões do Resumo). */
function Bloco({ children, rotulo }: { children: React.ReactNode; rotulo: string }) {
  return <div role="group" aria-label={rotulo} className="divide-y divide-line/60 rounded-2xl border border-line bg-background px-4">{children}</div>;
}

export default function FinanceiroGrupoCard({ g, onAbrirRepasses }: { g: FinanceiroGrupo; onAbrirRepasses?: () => void }) {
  const nome = rotuloMes(g.mes).split(" de ")[0].toLowerCase();
  const [oculto, setOculto] = useValoresOcultos();
  const negativo = g.disponivelGrupo < -0.004;
  return (
    <div className="grid gap-5">
      <CartaoSecao titulo="Financeiro do grupo" descricao={`Meu dinheiro, o que os integrantes utilizaram e o que já devolveram, até o fim de ${nome}. Cada despesa e cada devolução contam uma vez.`}>
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
          <p className="max-w-[48ch] text-xs leading-relaxed">Meu dinheiro disponível + repasses recebidos − utilizado pelos integrantes, até o fim de {nome}.</p>
        </div>

        <Bloco rotulo="Composição do disponível do grupo">
          <Linha rotulo="Meu dinheiro disponível" valor={saldo(g.meuDisponivel)} tom={g.meuDisponivel} dica="Minhas entradas menos minhas despesas, as mesmas do Meu financeiro" />
          <Linha rotulo="Repasses recebidos" valor={comSinal(g.recebido)} tom={g.recebido} dica="Só o que os integrantes devolveram e eu confirmei; não é entrada nem resultado" />
          <Linha rotulo="Utilizado pelos integrantes" valor={comSinal(-g.utilizado)} tom={-g.utilizado} dica="Despesas que eu lancei e que são de responsabilidade deles, em qualquer forma de pagamento" />
          <Linha rotulo="Disponível do grupo" valor={saldo(g.disponivelGrupo)} tom={g.disponivelGrupo} forte />
        </Bloco>

        <Bloco rotulo={`Acompanhamento de ${nome}`}>
          <Linha rotulo="Ainda falta receber" valor={saldo(g.pendente)} tom={g.pendente} dica={g.aguardando > 0.004 ? `${saldo(g.aguardando)} já marcado como repassado, aguardando a minha confirmação` : undefined} />
          <Linha rotulo={`Utilizado em ${nome}`} valor={saldo(g.utilizadoNoMes)} />
          <Linha rotulo={`Devolvido em ${nome}`} valor={saldo(g.recebidoNoMes)} tom={g.recebidoNoMes} dica="Conta no mês em que eu confirmo o recebimento" />
        </Bloco>
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
    </div>
  );
}
