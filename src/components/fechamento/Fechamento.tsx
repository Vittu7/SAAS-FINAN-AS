"use client";

import { useState } from "react";
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight, Info, Lock, RotateCcw } from "lucide-react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { Ico } from "@/components/icons";
import { addMeses, brl, rotuloMes } from "@/lib/finance";
import { MOTIVO_MINIMO, ROTULO_STATUS, validarMotivo, type EventoFechamento, type Retrato, type StatusMes } from "@/lib/fechamento";
import { comSinal, saldo, tomDoCartao, tomDoTitulo, tomDoValor } from "@/components/resumo/valores";

const nomeMes = (m: string) => rotuloMes(m).split(" de ")[0].toLowerCase();
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " às");
};

const COR_STATUS: Record<StatusMes, string> = {
  aberto: "bg-accent/12 text-accent",
  fechado: "border border-line bg-background text-ink",
  espera: "bg-warn-bg text-warn-ink",
  previsao: "border border-dashed border-line text-muted",
  historico: "bg-background text-muted",
};

export function SeloMes({ status }: { status: StatusMes }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold leading-5 ${COR_STATUS[status]}`}>
      {status === "fechado" ? <Ico icon={Lock} size={11} /> : <span className="size-1.5 rounded-full bg-current" />}
      {ROTULO_STATUS[status]}
    </span>
  );
}

/** ‹ Novembro 2026 · Em aberto › — setas com 44px de toque; o centro abre a lista de meses. */
export function SeletorMes({ mes, status, onAnterior, onProximo, onAbrirMeses, compacto = false }: { mes: string; status: StatusMes | null; onAnterior: () => void; onProximo: () => void; onAbrirMeses?: () => void; compacto?: boolean }) {
  const rotulo = compacto ? rotuloMes(mes).replace(/ de (\d{4})$/, " $1") : rotuloMes(mes);
  // Em espaço estreito o selo vira um ponto colorido (o nome da situação continua no rótulo acessível e na faixa)
  const PONTO: Record<StatusMes, string> = { aberto: "bg-accent", fechado: "bg-ink", espera: "bg-warn", previsao: "bg-muted", historico: "bg-muted" };
  return (
    <div className="@container flex min-w-0 flex-1 md:w-80 md:flex-none">
      <div className="flex min-h-11 w-full min-w-0 items-stretch rounded-xl border border-line bg-surface md:h-10 md:min-h-0">
        <button type="button" onClick={onAnterior} aria-label="Mês anterior" className="grid min-h-11 w-11 shrink-0 place-items-center rounded-l-xl text-muted transition hover:bg-background hover:text-ink md:min-h-0 md:w-10"><Ico icon={ChevronLeft} size={18} /></button>
        <button type="button" onClick={onAbrirMeses} disabled={!onAbrirMeses} aria-label={`${rotuloMes(mes)}${status ? `, ${ROTULO_STATUS[status]}` : ""}. Escolher mês`} className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 border-x border-line px-2 text-sm font-semibold disabled:cursor-default md:min-h-0 md:min-w-40">
          <span className="truncate" aria-live="polite">{rotulo}</span>
          {status && status !== "historico" && (
            <>
              <span className="hidden @min-[300px]:inline-flex"><SeloMes status={status} /></span>
              <span className={`size-2 shrink-0 rounded-full @min-[300px]:hidden ${PONTO[status]}`} aria-hidden />
            </>
          )}
        </button>
        <button type="button" onClick={onProximo} aria-label="Próximo mês" className="grid min-h-11 w-11 shrink-0 place-items-center rounded-r-xl text-muted transition hover:bg-background hover:text-ink md:min-h-0 md:w-10"><Ico icon={ChevronRight} size={18} /></button>
      </div>
    </div>
  );
}

/** Faixa no topo do Resumo conforme a situação do mês. */
export function FaixaFechamento({
  mes, status, mesTrabalho, terminou, fechadoEm, reabertura, podeReabrir, ultimoFechado, onConferir, onReabrir, onIrTrabalho,
}: {
  mes: string; status: StatusMes; mesTrabalho: string | null; terminou: boolean; fechadoEm: string | null;
  reabertura: EventoFechamento | null; podeReabrir: boolean; ultimoFechado: string | null;
  onConferir: () => void; onReabrir: () => void; onIrTrabalho: () => void;
}) {
  const N = rotuloMes(mes).split(" de ")[0];
  const caixa = "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl px-4 py-3.5";
  const texto = (icone: typeof Lock, titulo: string, corpo: string, tomIcone: string) => (
    <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-surface ${tomIcone}`}><Ico icon={icone} size={17} /></span>
      <span className="grid min-w-0 gap-0.5"><b className="text-sm">{titulo}</b><span className="text-xs leading-relaxed text-muted">{corpo}</span></span>
    </div>
  );
  const botao = "min-h-11 w-full rounded-xl px-4 text-sm font-semibold sm:w-auto md:min-h-10";
  if (status === "fechado") {
    return (
      <div className={`${caixa} card-glass`}>
        {texto(Lock, `${N} está fechado`, `Fechado${fechadoEm ? ` em ${dataHora(fechadoEm)}` : ""}. Os lançamentos deste mês ficam só para consulta.`, "text-ink")}
        {podeReabrir ? (
          <button type="button" onClick={onReabrir} className={`${botao} inline-flex items-center justify-center gap-2 border border-warn-borda text-warn`}><Ico icon={RotateCcw} size={16} />Reabrir {N.toLowerCase()}</button>
        ) : ultimoFechado ? <span className="text-xs text-muted">Para reabrir, reabra antes {nomeMes(ultimoFechado)}.</span> : null}
      </div>
    );
  }
  if ((status === "espera" || status === "previsao") && mesTrabalho) {
    return (
      <div className={`${caixa} bg-warn-bg`}>
        {texto(AlertTriangle, status === "espera" ? `${N} está em espera` : `${N} ainda não abriu`, `${N} fica só para consulta até você fechar ${nomeMes(mesTrabalho)}.`, "text-warn")}
        <button type="button" onClick={onIrTrabalho} className={`${botao} border border-line bg-surface`}>Ir para {nomeMes(mesTrabalho)}</button>
      </div>
    );
  }
  if (status === "aberto" && terminou) {
    const corpo = reabertura
      ? `Reaberto em ${dataHora(reabertura.em)}. Motivo: “${reabertura.motivo ?? ""}”. Corrija o que precisar e feche de novo.`
      : `${N} terminou. Confira os números e feche o mês para começar ${nomeMes(addMeses(mes, 1))}.`;
    return (
      <div className={`${caixa} bg-accent/10`}>
        {texto(CalendarCheck, reabertura ? `${N} reaberto` : `Hora de fechar ${N.toLowerCase()}`, corpo, "text-accent")}
        <button type="button" onClick={onConferir} className={`${botao} bg-accent text-on-accent`}>Conferir e fechar</button>
      </div>
    );
  }
  return null;
}

export type AvisoConferencia = { tipo: "atencao" | "info"; titulo: string; texto: string };

/** Conferência antes de fechar. O fechamento não paga contas nem confirma repasses. */
export function ConferenciaFechamento({
  mes, retrato, faturasEmAberto, aguardandoConfirmacao, avisos, onFechar, onConfirmar,
}: {
  mes: string; retrato: Retrato; faturasEmAberto: number; aguardandoConfirmacao: number; avisos: AvisoConferencia[];
  onFechar: () => void; onConfirmar: () => Promise<string | null>;
}) {
  const [conferi, setConferi] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const n = nomeMes(mes);
  const seguinte = nomeMes(addMeses(mes, 1));
  const continua: [string, number, string, string][] = [
    ["Contas pendentes", retrato.contasPendentes, "continuam pendentes", "text-warn"],
    ["Faturas em aberto", faturasEmAberto, "continuam para pagar", "text-warn"],
    ["Você vai receber", retrato.receber, "repasses continuam em aberto", "text-pos"],
    ["Você vai repassar", retrato.repassar, "repasses continuam em aberto", "text-warn"],
  ];
  if (aguardandoConfirmacao > 0) continua.push(["Aguardando sua confirmação", aguardandoConfirmacao, "não será confirmado automaticamente", "text-pos"]);
  const fechar = async () => {
    if (!conferi || enviando) return;
    setEnviando(true);
    setErro("");
    const msg = await onConfirmar();
    setEnviando(false);
    if (msg) setErro(msg);
  };
  const quadro = (rotulo: string, valor: string, tom: string, cartao: string, titulo: string, sinal = false) => (
    <div className={`grid min-w-0 gap-0.5 rounded-2xl border p-3.5 ${cartao}`}>
      <span className={`text-xs font-bold ${titulo}`}>{rotulo}</span>
      <span data-sinal={sinal || undefined} className={`text-xl font-bold tracking-tight tabular-nums ${tom}`}>{valor}</span>
    </div>
  );
  return (
    <DialogResponsivo titulo={`Fechar ${n} de ${mes.slice(0, 4)}`} onFechar={onFechar}>
      <div className="@container grid gap-5">
        <section className="grid gap-3">
          <h3 className="text-sm font-bold">Números de {n}</h3>
          <div className="grid gap-2.5 @md:grid-cols-2">
            {quadro("Entrou", brl(retrato.entrou), "text-pos", "border-pos-borda bg-pos-bg", "text-pos-ink")}
            {quadro("Saiu", brl(retrato.saiu), "text-neg", "border-neg-borda bg-neg-bg", "text-neg-ink")}
            {quadro("Resultado", comSinal(retrato.resultado), tomDoValor(retrato.resultado), tomDoCartao(retrato.resultado), tomDoTitulo(retrato.resultado), true)}
            {quadro(`Disponível ao fim de ${n}`, saldo(retrato.disponivel), tomDoValor(retrato.disponivel), "border-line bg-background", "text-muted", true)}
          </div>
        </section>
        <section className="grid gap-1">
          <h3 className="text-sm font-bold">Continua em aberto depois do fechamento</h3>
          <p className="pb-1 text-xs leading-relaxed text-muted">Fechar não paga contas, não paga faturas e não confirma repasses. Tudo isso segue para {seguinte}.</p>
          {continua.map(([rot, v, sub, tom]) => (
            <div key={rot} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
              <span className="grid min-w-0"><b className="text-sm font-semibold">{rot}</b><span className="text-xs text-muted">{sub}</span></span>
              <b className={`shrink-0 text-sm tabular-nums ${v > 0 ? tom : "text-muted"}`}>{brl(v)}</b>
            </div>
          ))}
        </section>
        {avisos.length > 0 && (
          <section className="grid gap-1">
            <h3 className="text-sm font-bold">Vale revisar</h3>
            {avisos.map((a) => (
              <div key={a.titulo} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className={`grid size-7 place-items-center rounded-full ${a.tipo === "atencao" ? "bg-warn-bg text-warn" : "bg-background text-muted"}`}><Ico icon={a.tipo === "atencao" ? AlertTriangle : Info} size={14} /></span>
                <span className="grid gap-0.5"><b className="text-sm font-semibold">{a.titulo}</b><span className="text-xs leading-relaxed text-muted">{a.texto}</span></span>
              </div>
            ))}
          </section>
        )}
        <section className="grid gap-3">
          <h3 className="text-sm font-bold">O que acontece ao fechar</h3>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm">
            <li>Os lançamentos de {n} ficam só para consulta, inclusive os que outras pessoas lançaram para você.</li>
            <li>{rotuloMes(addMeses(mes, 1)).split(" de ")[0]} passa a ser o mês em aberto.</li>
            <li>Os números acima ficam guardados como o retrato do fechamento.</li>
            <li>Se precisar corrigir algo, você pode reabrir {n} informando o motivo.</li>
          </ul>
          <label htmlFor="conferi-mes" className="flex cursor-pointer items-start gap-3 rounded-2xl bg-background p-3.5 text-sm">
            <input id="conferi-mes" type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
            <span>Conferi os números de {n} e quero fechar o mês.</span>
          </label>
          {erro && <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-neg-ink">{erro}</p>}
          <div className="flex flex-col-reverse gap-2 @md:flex-row @md:justify-end">
            <button type="button" onClick={onFechar} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Voltar</button>
            <button type="button" onClick={fechar} disabled={!conferi || enviando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">
              <Ico icon={Lock} size={15} />{enviando ? "Fechando…" : `Fechar ${n}`}
            </button>
          </div>
        </section>
      </div>
    </DialogResponsivo>
  );
}

/** Reabrir exige motivo e confirmação; meses depois ficam em espera até fechar de novo. */
export function ReabrirMes({ mes, mesesEmEspera, onFechar, onConfirmar }: { mes: string; mesesEmEspera: string[]; onFechar: () => void; onConfirmar: (motivo: string) => Promise<string | null> }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const n = nomeMes(mes);
  const invalido = validarMotivo(motivo);
  const reabrir = async () => {
    if (invalido || enviando) return;
    setEnviando(true);
    setErro("");
    const msg = await onConfirmar(motivo);
    setEnviando(false);
    if (msg) setErro(msg);
  };
  return (
    <DialogResponsivo titulo={`Reabrir ${n}`} onFechar={onFechar}>
      <div className="grid gap-4">
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          <li>{rotuloMes(mes).split(" de ")[0]} volta a aceitar alterações.</li>
          {mesesEmEspera.length > 0 && <li>{mesesEmEspera.map((m) => rotuloMes(m).split(" de ")[0]).join(", ")} fica em espera, só para consulta, até você fechar {n} de novo.</li>}
          <li>O fechamento anterior continua no histórico.</li>
        </ul>
        <label htmlFor="motivo-reabertura" className="grid gap-1.5 text-sm">
          <span className="font-semibold text-muted">Por que você precisa reabrir? (obrigatório)</span>
          <textarea id="motivo-reabertura" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: esqueci de lançar a conta de luz" className="min-h-24 w-full resize-y rounded-xl border border-line bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-accent" />
          <span className="text-xs text-muted">Escreva pelo menos {MOTIVO_MINIMO} letras.</span>
        </label>
        {erro && <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-neg-ink">{erro}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Cancelar</button>
          <button type="button" onClick={reabrir} disabled={Boolean(invalido) || enviando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-warn-borda px-5 text-sm font-semibold text-warn disabled:cursor-not-allowed disabled:opacity-50">
            <Ico icon={RotateCcw} size={15} />{enviando ? "Reabrindo…" : `Reabrir ${n}`}
          </button>
        </div>
      </div>
    </DialogResponsivo>
  );
}

/** Lista de meses com a situação de cada um; também ativa o fechamento mensal na primeira vez. */
export function ListaMeses({
  meses, mesInicial, sugestaoInicio, onEscolher, onConferir, onAtivar, onFechar,
}: {
  meses: { mes: string; status: StatusMes; detalhe: string; podeFechar: boolean }[];
  mesInicial: string | null; sugestaoInicio: string;
  onEscolher: (mes: string) => void; onConferir: () => void; onAtivar: (mes: string) => Promise<string | null>; onFechar: () => void;
}) {
  const [inicio, setInicio] = useState(sugestaoInicio);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const opcoesInicio = Array.from({ length: 6 }, (_, i) => addMeses(sugestaoInicio, -i));
  const ativar = async () => {
    setEnviando(true);
    setErro("");
    const msg = await onAtivar(inicio);
    setEnviando(false);
    if (msg) setErro(msg);
  };
  return (
    <DialogResponsivo titulo="Meses e fechamentos" onFechar={onFechar}>
      <div className="grid gap-4">
        {!mesInicial ? (
          <section className="grid gap-3 rounded-2xl bg-background p-4">
            <b className="text-sm">Ativar o fechamento mensal</b>
            <p className="text-sm text-muted">Você passa a fechar cada mês depois que ele termina. Meses fechados ficam só para consulta. Os meses antes do início continuam como hoje, como histórico. Nenhum mês é fechado automaticamente.</p>
            <label htmlFor="mes-inicial" className="grid gap-1.5 text-sm">
              <span className="font-semibold text-muted">Começar a partir de</span>
              <select id="mes-inicial" value={inicio} onChange={(e) => setInicio(e.target.value)} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">
                {opcoesInicio.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
              </select>
            </label>
            {erro && <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-neg-ink">{erro}</p>}
            <button type="button" onClick={ativar} disabled={enviando} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">{enviando ? "Ativando…" : "Ativar fechamento mensal"}</button>
          </section>
        ) : (
          <p className="text-sm text-muted">Você trabalha no mês em aberto. Para avançar, feche o mês. Meses fechados ficam para consulta.</p>
        )}
        <div className="grid">
          {meses.map((m) => (
            <div key={m.mes} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3 last:border-b-0">
              <span className="grid min-w-0 flex-1 basis-52 gap-1">
                <span className="flex flex-wrap items-center gap-2"><b className="text-sm">{rotuloMes(m.mes)}</b><SeloMes status={m.status} /></span>
                <span className="text-xs text-muted">{m.detalhe}</span>
              </span>
              {m.podeFechar ? (
                <button type="button" onClick={onConferir} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent sm:w-auto md:min-h-10">Conferir e fechar</button>
              ) : m.status !== "previsao" ? (
                <button type="button" onClick={() => onEscolher(m.mes)} className="min-h-11 w-full rounded-xl border border-line px-4 text-sm font-medium sm:w-auto md:min-h-10">{m.status === "aberto" ? "Abrir" : "Consultar"}</button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </DialogResponsivo>
  );
}

/** Navegar para um mês depois do mês em aberto. */
export function AvisoMesNaoAberto({ mes, mesTrabalho, onFechar, onConferir, onVerConsulta, podeConferir }: { mes: string; mesTrabalho: string; onFechar: () => void; onConferir: () => void; onVerConsulta: () => void; podeConferir: boolean }) {
  return (
    <DialogResponsivo titulo={`${rotuloMes(mes).split(" de ")[0]} ainda não abriu`} onFechar={onFechar}>
      <div className="grid gap-4">
        <p className="text-sm">Para trabalhar em {nomeMes(mes)}, feche {nomeMes(mesTrabalho)} primeiro.</p>
        <p className="flex items-start gap-2 rounded-xl bg-background p-3 text-xs leading-relaxed text-muted"><Ico icon={Info} size={14} className="mt-0.5 shrink-0" />Você pode consultar {nomeMes(mes)} para ver parcelas e contas programadas, mas não dá para lançar nele ainda.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onVerConsulta} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Só consultar {nomeMes(mes)}</button>
          {podeConferir && <button type="button" onClick={onConferir} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">Fechar {nomeMes(mesTrabalho)}</button>}
        </div>
      </div>
    </DialogResponsivo>
  );
}

/** Histórico de fechamentos e reaberturas do mês. */
export function HistoricoFechamento({ mes, eventos }: { mes: string; eventos: EventoFechamento[] }) {
  if (eventos.length === 0) return null;
  return (
    <section className="card-glass grid gap-3 p-5" aria-label={`Histórico de ${nomeMes(mes)}`}>
      <h2 className="text-base font-bold">Histórico de {nomeMes(mes)}</h2>
      <ol className="grid">
        {eventos.map((e, i) => (
          <li key={e.em + i} className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-3 pb-3 last:pb-0">
            {i < eventos.length - 1 && <span className="absolute bottom-0 left-[10px] top-6 w-0.5 bg-line" aria-hidden />}
            <span className={`mt-0.5 size-[22px] rounded-full border-2 bg-background ${e.tipo === "fechamento" ? "border-ink" : "border-warn"}`} aria-hidden />
            <span className="grid gap-0.5">
              <b className="text-sm">{e.tipo === "fechamento" ? "Fechado" : "Reaberto"}</b>
              <span className="text-xs text-muted">{dataHora(e.em)}{e.motivo ? ` · “${e.motivo}”` : ""}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
