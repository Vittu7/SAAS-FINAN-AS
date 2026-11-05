"use client";

import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, Info, Wallet } from "lucide-react";
import { Ico } from "@/components/icons";
import { addMeses, brl, pct, rotuloMes, useValoresOcultos } from "@/lib/finance";
import { composicaoDoDisponivel, type Painel } from "@/lib/painel";
import type { FaturaAberta } from "@/lib/pagamentoFatura";
import type { TipoResumo } from "@/components/mobile/MobileShell";
import GraficoEntradasSaidas from "./GraficoEntradasSaidas";
import { comSinal, saldo, tomDoCartao, tomDoTitulo, tomDoValor } from "./valores";

export type AcaoRepasseResumo = { id: string; titulo: string; detalhe: string; tipo: "confirmar" | "informar" };

const nomeMes = (m: string) => rotuloMes(m).split(" de ")[0].toLowerCase();
const semCentavos = (v: number) => brl(v).replace(/,00$/, "");

/**
 * Resumo do mês, na ordem em que a pessoa pensa:
 *   1. quanto tenho (disponível) e quanto sobra depois dos compromissos;
 *   2. quanto entrou e quanto saiu no mês, com o resultado;
 *   3. o que ainda vai sair e os acertos com a família;
 *   4. como chegamos ao disponível.
 * Cada número tem uma definição só (lib/painel.ts) e nada é contado duas vezes.
 * O layout responde à largura do próprio conteúdo (container queries), então funciona com a barra lateral aberta ou fechada.
 */
export default function PainelResumo({
  painel: p,
  mesCorrente,
  contasDoMes,
  faturas,
  serie,
  acoes,
  onAbrirExtrato,
  onAbrirRepasses,
  faixa,
  somenteConsulta = false,
  extra,
}: {
  painel: Painel;
  /** Mês do calendário (AAAA-MM): define se o rótulo é "agora" ou "ao fim do mês" */
  mesCorrente: string;
  contasDoMes: { id: string | number; nome?: string; valor: number | string; pago?: boolean; foraDoMeuSaldo?: boolean; mes?: string; vencimento?: number | string | null; responsavel?: string }[];
  faturas: FaturaAberta[];
  serie: { mes: string; entrou: number; saiu: number }[];
  acoes: AcaoRepasseResumo[];
  onAbrirExtrato?: (tipo: TipoResumo) => void;
  onAbrirRepasses: () => void;
  /** Faixa do fechamento mensal (hora de fechar, mês fechado, em espera) */
  faixa?: ReactNode;
  /** Mês fechado ou em espera: sem ações, só consulta */
  somenteConsulta?: boolean;
  /** Conteúdo extra no fim (histórico do fechamento) */
  extra?: ReactNode;
}) {
  const n = nomeMes(p.mes);
  const agora = p.mes === mesCorrente && !somenteConsulta;
  const rotuloDisp = agora ? "Total disponível" : `Total disponível ao fim de ${n}`;
  const [oculto, setOculto] = useValoresOcultos();
  // Cartão principal na cor de destaque do tema escolhido (Configurações › Aparência); saldo negativo fica vermelho
  const negativo = p.totalDisponivel < -0.004;
  // Barra: quanto do que entrou no mês já saiu (só visual; não muda nenhum cálculo)
  const uso = p.entradasRenda > 0 ? Math.min(100, (p.saidasRealizadas / p.entradasRenda) * 100) : p.saidasRealizadas > 0 ? 100 : 0;
  const maior = Math.max(p.entradasRenda, p.saidasRealizadas, 1);
  const pendentes = contasDoMes
    .filter((c) => !c.pago && !c.foraDoMeuSaldo && c.mes === p.mes)
    .sort((a, b) => (Number(a.vencimento) || 99) - (Number(b.vencimento) || 99));
  const totalFaturas = faturas.reduce((t, f) => t + f.restante, 0);
  const aindaVaiSair = p.contasPendentes + totalFaturas;
  const r = p.repasses;
  const vouReceber = r.aReceber + r.aReceberAguardando;
  const vouRepassar = r.aRepassar + r.aRepassarAguardando;
  const comp = composicaoDoDisponivel(p, nomeMes(addMeses(p.mes, -1)));
  const pctSobrou = p.entradasRenda > 0 ? Math.round((p.resultadoRealizado / p.entradasRenda) * 100) : 0;
  const prev = p.previsao;

  const linhaPrev = (rotulo: string, valor: number, tom: string) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="min-w-0 text-muted">{rotulo}</span>
      <span className={`shrink-0 tabular-nums ${tom}`}>{comSinal(valor)}</span>
    </div>
  );

  return (
    <section aria-label={`Resumo de ${rotuloMes(p.mes)}`} className="@container grid gap-5">
      {faixa}

      {/* 1. Quanto tenho e quanto sobra */}
      <div className="grid gap-5 @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div
          className="relative isolate grid content-start gap-4 overflow-hidden rounded-[1.5rem] p-5 shadow-[var(--shadow-card)] @xl:p-6"
          style={negativo
            ? { background: "linear-gradient(140deg, var(--hero-neg-a), var(--hero-neg-b))", color: "var(--on-hero)" }
            : { background: "linear-gradient(140deg, var(--accent), var(--accent-fim))", color: "var(--on-accent)" }}
        >
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-60 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-12 -z-10 size-52 rounded-full bg-white/[.07]" />
          <span aria-hidden className="pointer-events-none absolute bottom-8 right-8 -z-10 size-24 rounded-full border border-white/15" />
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-current/15"><Ico icon={Wallet} size={16} /></span>
              <span className="min-w-0">{rotuloDisp}</span>
            </p>
            <button type="button" onClick={() => setOculto(!oculto)} aria-label={oculto ? "Mostrar valores" : "Ocultar valores"} aria-pressed={oculto} className="grid size-11 shrink-0 place-items-center rounded-full bg-current/15 transition hover:bg-current/25 focus-visible:ring-2 focus-visible:ring-current md:size-10">
              <Ico icon={oculto ? Eye : EyeOff} size={18} />
            </button>
          </div>
          <p className="text-[clamp(2.3rem,9cqi,3.25rem)] font-bold leading-none tracking-tight tabular-nums">{saldo(p.totalDisponivel)}</p>
          <p className="max-w-[46ch] text-xs leading-relaxed">Saldo inicial das contas mais tudo o que entrou e saiu até {agora ? "hoje" : `o fim de ${n}`}. Contas fixas do mês e compras no crédito já estão descontadas.</p>
          <div className="grid gap-2 pt-1">
            <div className="flex items-baseline justify-between gap-3 text-xs font-medium"><span>Usado do que entrou no mês</span><span className="tabular-nums">{pct(uso)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-current/20" role="img" aria-label={`${pct(uso)} do que entrou no mês já saiu`}>
              <div className="h-full rounded-full bg-current/85 transition-all" style={{ width: `${uso}%` }} />
            </div>
          </div>
          {onAbrirExtrato && (
            <button type="button" onClick={() => onAbrirExtrato("disponivel")} className="inline-flex min-h-11 w-fit items-center gap-1 rounded-full bg-current/15 px-4 text-sm font-semibold transition hover:bg-current/25 focus-visible:ring-2 focus-visible:ring-current md:min-h-9">
              Ver detalhes<Ico icon={ChevronRight} size={16} />
            </button>
          )}
        </div>
        <div className="card-glass grid content-start gap-3 p-5 @xl:p-6">
          <p className="text-sm font-medium text-muted">Sobra prevista com tudo acertado</p>
          <p data-sinal className={`text-[clamp(1.6rem,5cqi,2rem)] font-bold leading-none tracking-tight tabular-nums ${tomDoValor(p.sobraPrevista)}`}>{saldo(p.sobraPrevista)}</p>
          <div>
            <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-sm">
              <span className="text-muted">{rotuloDisp}</span><span className="tabular-nums">{saldo(p.totalDisponivel)}</span>
            </div>
            {Math.abs(prev.receber) >= 0.005 && linhaPrev("Você vai receber de repasses", prev.receber, prev.receber > 0 ? "text-pos" : "text-neg")}
            {Math.abs(prev.repassar) >= 0.005 && linhaPrev("Você vai repassar", -prev.repassar, "text-warn")}
            {Math.abs(prev.faturasOutros) >= 0.005 && linhaPrev("Faturas de compras para outras pessoas", prev.faturasOutros, "text-warn")}
          </div>
          <p className="text-xs leading-relaxed text-muted">Considera os repasses e as faturas que ainda vão se acertar. Contas pendentes e compras no crédito já estão no disponível.</p>
        </div>
      </div>

      {/* 2. Entrou x saiu */}
      <div className="card-glass grid gap-6 p-5 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @4xl:gap-8 @4xl:p-6">
        <div className="grid min-w-0 content-start gap-4">
          <h2 className="text-base font-bold">{rotuloMes(p.mes)}: entrou e saiu</h2>
          <div className="@container">
            <div className="grid gap-3 @min-[330px]:grid-cols-2">
              <button type="button" onClick={() => onAbrirExtrato?.("entradas")} aria-label={`Ver entradas: ${brl(p.entradasRenda)}`} className="grid min-w-0 content-start gap-1.5 rounded-2xl border border-pos-borda bg-pos-bg p-4 text-left transition hover:brightness-[.98]">
                <span className="flex items-center gap-2 text-sm font-bold text-pos-ink">
                  <span className="grid size-7 place-items-center rounded-full bg-pos/15"><Ico icon={ArrowDownLeft} size={15} /></span>Entrou
                </span>
                <span className="text-[clamp(1.4rem,4.6cqi,1.9rem)] font-bold tracking-tight tabular-nums text-pos">{brl(p.entradasRenda)}</span>
                <span className="text-xs leading-relaxed text-muted">
                  {p.rendaPorOrigem.length ? p.rendaPorOrigem.slice(0, 3).map((o) => `${o.rotulo} ${semCentavos(o.valor)}`).join(" · ") : "Nenhuma entrada lançada"}
                </span>
              </button>
              <button type="button" onClick={() => onAbrirExtrato?.("gastos")} aria-label={`Ver saídas: ${brl(p.saidasRealizadas)}`} className="grid min-w-0 content-start gap-1.5 rounded-2xl border border-neg-borda bg-neg-bg p-4 text-left transition hover:brightness-[.98]">
                <span className="flex items-center gap-2 text-sm font-bold text-neg-ink">
                  <span className="grid size-7 place-items-center rounded-full bg-neg/15"><Ico icon={ArrowUpRight} size={15} /></span>Saiu
                </span>
                <span className="text-[clamp(1.4rem,4.6cqi,1.9rem)] font-bold tracking-tight tabular-nums text-neg">{brl(p.saidasRealizadas)}</span>
                <span className="text-xs leading-relaxed text-muted">
                  À vista {semCentavos(p.saidasPorOrigem.avista)} · Parcelas {semCentavos(p.saidasPorOrigem.parcelas)} · Contas pagas {semCentavos(p.saidasPorOrigem.contasPagas)}
                </span>
                {p.contasPendentes > 0 && (
                  <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-xl border border-warn-borda bg-warn-bg px-3 py-2 text-xs font-semibold text-warn-ink">
                    <span>Contas pendentes (fora do Saiu)</span>
                    <span className="tabular-nums">{brl(p.contasPendentes)}</span>
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="grid gap-2" role="img" aria-label={`Entrou ${brl(p.entradasRenda)}, saiu ${brl(p.saidasRealizadas)}`}>
            <div className="h-3 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-serie-in" style={{ width: `${(p.entradasRenda / maior) * 100}%` }} /></div>
            <div className="h-3 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-serie-out" style={{ width: `${(p.saidasRealizadas / maior) * 100}%` }} /></div>
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border px-4 py-3 ${tomDoCartao(p.resultadoRealizado)}`}>
            <span className="grid">
              <span className={`text-sm font-bold ${tomDoTitulo(p.resultadoRealizado)}`}>Resultado do mês</span>
              <span className="text-xs text-muted">{p.resultadoRealizado > 0 ? `Sobrou ${pctSobrou}% do que entrou` : p.resultadoRealizado < 0 ? "Saiu mais do que entrou" : "Entrou e saiu o mesmo valor"}</span>
            </span>
            <span data-sinal className={`text-xl font-bold tracking-tight tabular-nums ${tomDoValor(p.resultadoRealizado)}`}>{comSinal(p.resultadoRealizado)}</span>
          </div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted"><Ico icon={Info} size={14} className="mt-0.5 shrink-0" />Saiu = despesas realizadas, inclusive no crédito. Contas pendentes, faturas e repasses não entram aqui.</p>
        </div>
        <div className="min-w-0 @4xl:border-l @4xl:border-line @4xl:pl-8">
          <GraficoEntradasSaidas serie={serie} />
        </div>
      </div>

      {/* 3. Ainda vai sair · Entre membros */}
      <div className="grid gap-5 @xl:grid-cols-2">
        <div className="card-glass grid content-start gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">{somenteConsulta ? "Ficou para pagar" : "Ainda vai sair"}</h2>
            <span className={`text-lg font-bold tabular-nums ${aindaVaiSair > 0 ? "text-warn" : "text-muted"}`}>{brl(aindaVaiSair)}</span>
          </div>
          <div>
            <p className="flex justify-between gap-2 pb-1 pt-1 text-xs font-bold text-muted"><span>Contas pendentes</span><span className="tabular-nums">{brl(p.contasPendentes)}</span></p>
            {pendentes.length === 0 ? (
              <p className="border-b border-line py-3 text-sm text-muted">Nenhuma conta fixa pendente em {n}.</p>
            ) : (
              pendentes.slice(0, 5).map((c) => (
                <div key={c.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2">
                  <span className="grid min-w-0"><b className="truncate text-sm font-semibold">{c.nome}</b><span className="text-xs text-muted">{c.vencimento ? `vence dia ${c.vencimento}` : "sem vencimento"}{c.responsavel ? ` · ${c.responsavel}` : ""}</span></span>
                  <b className="shrink-0 text-sm tabular-nums text-warn">{brl(Number(c.valor) || 0)}</b>
                </div>
              ))
            )}
            {pendentes.length > 5 && <p className="py-2 text-xs text-muted">e mais {pendentes.length - 5} contas</p>}
            <p className="flex justify-between gap-2 pb-1 pt-3 text-xs font-bold text-muted"><span>Faturas em aberto</span><span className="tabular-nums">{brl(totalFaturas)}</span></p>
            {faturas.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nenhuma fatura em aberto.</p>
            ) : (
              faturas.map((f) => (
                <div key={f.cartao + f.mes} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                  <span className="grid min-w-0"><b className="truncate text-sm font-semibold">Fatura {f.cartao} de {nomeMes(f.mes)}</b><span className="text-xs text-muted">{f.pago > 0 ? `já pago ${brl(f.pago)} de ${brl(f.total)}` : `total ${brl(f.total)}`}</span></span>
                  <b className="shrink-0 text-sm tabular-nums text-warn">{brl(f.restante)}</b>
                </div>
              ))
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted">O que ainda vai sair da sua conta. A sobra prevista já considera tudo isso.</p>
        </div>

        <div className="card-glass grid content-start gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">Entre membros</h2>
            {!somenteConsulta && <button type="button" onClick={onAbrirRepasses} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent md:min-h-9">Ver repasses</button>}
          </div>
          <p className="text-xs text-muted">Acertos com a família. Não são renda nem despesa nova.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className={`grid min-w-0 gap-0.5 rounded-2xl border p-3.5 ${vouReceber > 0 ? "border-pos-borda bg-pos-bg" : "border-line bg-background"}`}>
              <span className={`text-xs font-bold ${vouReceber > 0 ? "text-pos-ink" : "text-muted"}`}>Vou receber</span>
              <span className={`text-lg font-bold tabular-nums ${vouReceber > 0 ? "text-pos" : "text-ink"}`}>{brl(vouReceber)}</span>
            </div>
            <div className={`grid min-w-0 gap-0.5 rounded-2xl border p-3.5 ${vouRepassar > 0 ? "border-warn-borda bg-warn-bg" : "border-line bg-background"}`}>
              <span className={`text-xs font-bold ${vouRepassar > 0 ? "text-warn-ink" : "text-muted"}`}>Vou repassar</span>
              <span className={`text-lg font-bold tabular-nums ${vouRepassar > 0 ? "text-warn" : "text-ink"}`}>{brl(vouRepassar)}</span>
            </div>
          </div>
          {r.recebidosNoMes > 0 && <p className="text-xs text-muted">Recebido e confirmado em {n}: <b className="text-pos">{brl(r.recebidosNoMes)}</b></p>}
          {!somenteConsulta && acoes.slice(0, 3).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-line p-3">
              <span className="grid min-w-0 flex-1 basis-48"><b className="text-sm font-semibold">{a.titulo}</b><span className="text-xs text-muted">{a.detalhe}</span></span>
              <button type="button" onClick={onAbrirRepasses} className={`min-h-11 w-full rounded-xl px-4 text-sm font-semibold @md:w-auto md:min-h-10 ${a.tipo === "confirmar" ? "bg-accent text-on-accent" : "border border-line"}`}>
                {a.tipo === "confirmar" ? "Confirmar" : "Informar repasse"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Como chegamos ao disponível */}
      <details className="card-glass group px-5" open={somenteConsulta}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
          <span>Como chegamos {agora ? "ao disponível de hoje" : `ao disponível de ${n}`}</span>
          <Ico icon={ChevronRight} size={18} className="text-muted transition group-open:rotate-90" />
        </summary>
        <div className="pb-5">
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
      </details>

      {extra}
    </section>
  );
}
