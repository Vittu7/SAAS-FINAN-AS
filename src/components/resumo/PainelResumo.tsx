"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, Wallet } from "lucide-react";
import { Ico } from "@/components/icons";
import CartaoSecao from "@/components/dashboard/CartaoSecao";
import { brl, pct, rotuloMes, useValoresOcultos } from "@/lib/finance";
import type { Painel } from "@/lib/painel";
import type { FaturaAberta } from "@/lib/pagamentoFatura";
import type { TipoResumo } from "@/components/mobile/MobileShell";
import { comSinal, saldo, tomDoValor } from "./valores";

const nomeMes = (m: string) => rotuloMes(m).split(" de ")[0].toLowerCase();
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Topo da tela inicial: o que a pessoa precisa saber em poucos segundos.
 *   1. Quanto tenho (disponível) e quanto sobra depois dos compromissos;
 *   2. quanto entrou e saiu no mês, com o resultado;
 *   3. o que ainda vai sair e os acertos com a família.
 * Cada número tem uma definição só (lib/painel.ts) e nada é contado duas vezes. A análise (evolução dos meses,
 * "como chegamos ao disponível") fica no módulo Gráficos e relatórios.
 * A largura vem do contêiner da Dashboard (container queries), então funciona com a barra lateral aberta ou fechada.
 */
export default function PainelResumo({
  painel: p,
  mesCorrente,
  contasDoMes,
  faturas,
  repasses: r,
  onAbrirExtrato,
  onAbrirRepasses,
  onAbrirContas,
  onAbrirFaturas,
  somenteConsulta = false,
}: {
  painel: Painel;
  /** Mês do calendário (AAAA-MM): define se o rótulo é "agora" ou "ao fim do mês" */
  mesCorrente: string;
  contasDoMes: { id: string | number; nome?: string; valor: number | string; pago?: boolean; foraDoMeuSaldo?: boolean; mes?: string; vencimento?: number | string | null; responsavel?: string }[];
  faturas: FaturaAberta[];
  /** Repasses do mês selecionado (não somam meses anteriores): a receber, parte já marcada como repassada, e a repassar */
  repasses: { receber: number; receberAguardando: number; repassar: number };
  onAbrirExtrato?: (tipo: TipoResumo) => void;
  onAbrirRepasses: () => void;
  onAbrirContas?: () => void;
  onAbrirFaturas?: () => void;
  /** Mês fechado ou em espera: sem ações, só consulta */
  somenteConsulta?: boolean;
}) {
  const n = nomeMes(p.mes);
  const agora = p.mes === mesCorrente && !somenteConsulta;
  const rotuloDisp = agora ? "Total disponível" : `Total disponível ao fim de ${n}`;
  const [oculto, setOculto] = useValoresOcultos();
  // Cartão principal na cor de destaque do tema (Configurações › Aparência); saldo negativo fica vermelho
  const negativo = p.totalDisponivel < -0.004;
  const maior = Math.max(p.entradasRenda, p.saidasRealizadas, 1);
  // Barra do card principal: quanto do que entrou no mês já saiu (só visual; não muda nenhum cálculo)
  const uso = p.entradasRenda > 0 ? Math.min(100, (p.saidasRealizadas / p.entradasRenda) * 100) : p.saidasRealizadas > 0 ? 100 : 0;
  const pctSobrou = p.entradasRenda > 0 ? Math.round((p.resultadoRealizado / p.entradasRenda) * 100) : 0;

  const pendentes = contasDoMes
    .filter((c) => !c.pago && !c.foraDoMeuSaldo && c.mes === p.mes)
    .sort((a, b) => (Number(a.vencimento) || 99) - (Number(b.vencimento) || 99));
  const totalFaturas = faturas.reduce((t, f) => t + f.restante, 0);
  const aindaVaiSair = p.contasPendentes + totalFaturas;
  const proxima = pendentes[0];
  const vouReceber = r.receber;
  const vouRepassar = r.repassar;
  // Ao tocar em "Ainda vai sair": vai para onde o compromisso se resolve (contas fixas ou faturas)
  const abrirCompromisso = pendentes.length > 0 ? onAbrirContas : faturas.length > 0 ? onAbrirFaturas : onAbrirContas;

  const linhaMes = (tipo: "entradas" | "gastos", rotulo: string, valor: number) => {
    const entrada = tipo === "entradas";
    return (
      <button
        type="button"
        onClick={() => onAbrirExtrato?.(tipo)}
        aria-label={`Ver ${entrada ? "entradas" : "saídas"}: ${brl(valor)}`}
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

  const tile = (rotulo: string, valor: number, tom: string, detalhe: string, onClick?: () => void) => {
    const corpo = (
      <>
        <span className="text-xs text-muted">{rotulo}</span>
        <span className={`text-xl font-semibold tabular-nums ${tom}`}>{brl(valor)}</span>
        <span className="text-xs leading-snug text-muted">{detalhe}</span>
      </>
    );
    const classe = "grid min-w-0 content-start gap-1 rounded-xl bg-background p-4 text-left";
    return onClick && !somenteConsulta ? (
      <button type="button" onClick={onClick} className={`${classe} transition hover:ring-1 hover:ring-line`}>{corpo}</button>
    ) : (
      <div className={classe}>{corpo}</div>
    );
  };

  return (
    <section aria-label={`Resumo de ${rotuloMes(p.mes)}`} className="grid gap-5">
      {/* 1 e 2. Quanto tenho · o que entrou e saiu */}
      <div className="grid gap-5 @2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div
          // Cores do card: cor de destaque escolhida pela pessoa (saldo positivo) ou vermelho de alerta (negativo). Ver .hc-hero em globals.css
          className={`hc-hero hc-glow relative isolate grid content-between gap-5 overflow-hidden rounded-3xl p-5 transition-shadow duration-300 @xl:p-6 ${negativo ? "hc-hero-neg" : ""}`}
        >
          {/* Formas translúcidas: só relevo, sem competir com os números */}
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 -z-10 size-60 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-12 -z-10 size-52 rounded-full bg-white/[.07]" />
          <span aria-hidden className="pointer-events-none absolute bottom-10 right-8 -z-10 size-24 rounded-full border border-white/15" />
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-current/15"><Ico icon={Wallet} size={18} /></span>
                <span className="min-w-0">{rotuloDisp}</span>
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
            <p className="text-4xl font-bold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere] @4xl:text-5xl">{saldo(p.totalDisponivel)}</p>
            <p className="max-w-[44ch] text-xs leading-relaxed">Saldo inicial das contas mais tudo o que entrou e saiu até {agora ? "hoje" : `o fim de ${n}`}.</p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3 text-xs font-medium"><span>Usado do que entrou no mês</span><span className="tabular-nums">{pct(uso)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-current/20" role="img" aria-label={`${pct(uso)} do que entrou no mês já saiu`}>
              <div className="hc-glow-pt h-full rounded-full bg-current/85 transition-all [--glow-c:#fff]" style={{ width: `${uso}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-current/25 pt-4">
            <div className="grid gap-0.5">
              <span className="text-xs">Sobra prevista depois de contas, faturas e repasses</span>
              <span data-sinal className="text-lg font-semibold tabular-nums">{saldo(p.sobraPrevista)}</span>
            </div>
            {onAbrirExtrato && (
              <button
                type="button"
                onClick={() => onAbrirExtrato("disponivel")}
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-current/15 px-4 text-sm font-semibold transition hover:bg-current/25 focus-visible:ring-2 focus-visible:ring-current md:min-h-9"
              >
                Ver detalhes<Ico icon={ChevronRight} size={16} />
              </button>
            )}
          </div>
        </div>

        <CartaoSecao titulo={`Entrou e saiu em ${n}`} descricao="Valores realizados no mês">
          <div className="grid gap-3">
            {linhaMes("entradas", "Entrou", p.entradasRenda)}
            {linhaMes("gastos", "Saiu", p.saidasRealizadas)}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="grid min-w-0">
              <span className="text-sm font-medium">Resultado do mês</span>
              <span className="text-xs text-muted">{p.resultadoRealizado > 0 ? `Sobrou ${pctSobrou}% do que entrou` : p.resultadoRealizado < 0 ? "Saiu mais do que entrou" : "Entrou e saiu o mesmo valor"}</span>
            </span>
            <span data-sinal className={`shrink-0 text-xl font-semibold tabular-nums ${tomDoValor(p.resultadoRealizado)}`}>{comSinal(p.resultadoRealizado)}</span>
          </div>
        </CartaoSecao>
      </div>

      {/* 3. Compromissos */}
      <CartaoSecao
        titulo="Compromissos"
        descricao={somenteConsulta ? "O que ficou em aberto neste mês" : "O que ainda vai sair e os acertos com a família"}
        acao={somenteConsulta ? undefined : { rotulo: "Ver repasses", onClick: onAbrirRepasses }}
      >
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 [&>*:first-child]:col-span-2 @xl:[&>*:first-child]:col-span-1">
          {tile(
            somenteConsulta ? "Ficou para pagar" : "Ainda vai sair",
            aindaVaiSair,
            aindaVaiSair > 0 ? "text-warn" : "text-muted",
            aindaVaiSair <= 0
              ? "Nenhuma conta ou fatura em aberto"
              : [pendentes.length ? plural(pendentes.length, "conta fixa", "contas fixas") : "", faturas.length ? plural(faturas.length, "fatura", "faturas") : ""].filter(Boolean).join(" e ") + (proxima ? `. Próxima: ${proxima.nome}${proxima.vencimento ? `, dia ${proxima.vencimento}` : ""}` : ""),
            abrirCompromisso,
          )}
          {tile("Vou receber", vouReceber, vouReceber > 0 ? "text-pos" : "text-muted", vouReceber > 0 ? (r.receberAguardando > 0 ? "Inclui repasse aguardando sua confirmação" : "Despesas que você adiantou") : "Nenhum repasse a receber", onAbrirRepasses)}
          {tile("Vou repassar", vouRepassar, vouRepassar > 0 ? "text-warn" : "text-muted", vouRepassar > 0 ? "Despesas que outras pessoas pagaram por você" : "Nenhum repasse a fazer", onAbrirRepasses)}
        </div>
      </CartaoSecao>
    </section>
  );
}
