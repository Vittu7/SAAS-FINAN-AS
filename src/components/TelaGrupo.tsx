"use client";

import { avisos } from "@/lib/avisos";
import { useMemo, useState } from "react";
import DialogResponsivo from "@/components/DialogResponsivo";
import { useOpcoes } from "@/lib/useOpcoes";
import { useMovimentosConta } from "@/hooks/useMovimentosConta";
import { usePagamentosFatura } from "@/hooks/usePagamentosFatura";
import { calcularSaldoConta, tipoDaConta } from "@/lib/contas";
import { ArrowRight, Check, HandCoins, Lock, Settings2, Undo2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Avatar, { AvatarPilha } from "@/components/Avatar";
import AutorTag from "@/components/AutorTag";
import EstadoVazio from "@/components/EstadoVazio";
import PessoaIcone from "@/components/PessoaIcone";
import { Ico, ICONE_ABA, ICONES } from "@/components/icons";
import { brl, rotuloMes } from "@/lib/finance";
import { avisarPerfilAtualizado } from "@/lib/perfil";
import { arred } from "@/lib/calculos";
import { FILTRO_GRUPO_INICIAL, filtrarGrupo, filtrarGrupoPorPessoas, lancamentosDoGrupo, repasseValidoParaAcao, repassesDoMes, resumoPorMembro, type FiltroGrupo, type LancGrupo } from "@/lib/grupo";
import type { Membro } from "@/hooks/useFinanceStore";

type Sub = "resumo" | "lancamentos" | "repasses";
type Dados = { extrato: any[]; cartao: any[]; contas: any[] };
type AcaoRepasse = "informar" | "desinformar" | "concluir" | "reabrir" | "recusar";
type Repasse = (itens: { origem: "extrato" | "cartao" | "contas"; id: string }[], acao: AcaoRepasse, conta?: string | null) => Promise<boolean>;

/* ---------- Escolha da conta que recebe o repasse ---------- */
function EscolherContaRepasse({ modo, lista, dados, userId, mes, onConfirmar, onFechar }: { modo: "receber" | "repassar"; lista: LancGrupo[]; dados: Dados; userId: string; mes: string; onConfirmar: (conta: string | null) => void; onFechar: () => void }) {
  const { pagamento } = useOpcoes();
  const caixinhaMovs = useMovimentosConta();
  const { pagamentos: pagamentosFatura } = usePagamentosFatura();
  const contas = useMemo(() => pagamento.filter((o) => tipoDaConta(o) === "debito"), [pagamento]);
  const [escolhida, setEscolhida] = useState<string>("");
  const total = lista.reduce((t, l) => t + l.valor, 0);
  const sel = escolhida || contas[0]?.nome || "";
  return (
    <DialogResponsivo titulo={lista.length > 1 ? (modo === "receber" ? `Marcar ${lista.length} repasses como recebidos` : `Devolver ${lista.length} repasses`) : modo === "receber" ? "Em qual conta o valor entrou?" : "De qual conta saiu o valor?"} onFechar={onFechar}>
      <div className="space-y-4">
        {lista.length > 1 && (
          <div className="rounded-xl bg-background p-3 text-sm ring-1 ring-line">
            <p><b>{lista.length} repasses</b> · total <b className="tabular-nums">{brl(total)}</b></p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-muted">{lista.map((l) => <li key={l.chave} className="flex justify-between gap-3"><span className="truncate">{modo === "receber" ? l.respNome : l.autorNome} · {l.descricao}{l.parcela ? ` · ${l.parcela}` : ""}</span><span className="tabular-nums">{brl(l.valor)}</span></li>)}</ul>
            <p className="mt-2 text-xs text-muted">Repasses já concluídos não entram. Se algum não puder ser atualizado, você é avisado e a tela é recarregada com o que ficou gravado.</p>
          </div>
        )}
        <p className="text-sm text-muted">{modo === "receber" ? "Confirmar recebimento de" : "Marcar como repassado"} <b className="text-ink">{brl(total)}</b>{lista.length > 1 ? ` (${lista.length} lançamentos)` : ""}. {modo === "receber" ? "O valor soma no saldo da conta escolhida e entra como entrada no seu mês." : "O valor é descontado do saldo da conta escolhida quando quem lançou confirmar o recebimento."}</p>
        {contas.length === 0 ? (
          <p className="rounded-xl bg-background p-3 text-sm text-muted">Você ainda não tem conta de débito cadastrada. Você pode continuar mesmo assim, sem registrar em nenhuma conta.</p>
        ) : (
          <div role="radiogroup" aria-label="Conta de destino" className="space-y-2">
            {contas.map((c) => {
              const saldo = calcularSaldoConta(dados as any, c, { userId, ateMes: mes, caixinhaMovs, pagamentosFatura }).saldo;
              return (
                <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${sel === c.nome ? "border-accent bg-accent/10" : "border-line"}`}>
                  <input type="radio" name="conta-repasse" checked={sel === c.nome} onChange={() => setEscolhida(c.nome)} className="accent-[var(--accent)]" />
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
                  <span className="shrink-0 text-xs text-muted">saldo {brl(saldo)}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onConfirmar(null)} className="h-11 rounded-xl border border-line px-4 text-sm font-medium hover:bg-background">Continuar sem registrar em conta</button>
          {contas.length > 0 && <button type="button" onClick={() => onConfirmar(sel)} className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">{modo === "receber" ? "Confirmar recebimento" : "Marcar como repassado"}</button>}
        </div>
      </div>
    </DialogResponsivo>
  );
}

const ICONE_TIPO = { avista: ICONE_ABA.lancamentos, parcelada: ICONE_ABA.cartao, fixa: ICONE_ABA.contas } as const;
const sel = "h-11 w-full rounded-xl border border-line bg-background px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent";

/* ---------- Uma linha de lançamento do grupo ---------- */
const ROTULO_SITUACAO = { pendente: "Pendente", aguardando: "Informado · aguardando confirmação", concluido: "Confirmado" } as const;
const COR_SITUACAO = {
  pendente: "bg-warn-bg text-warn-ink",
  aguardando: "bg-accent/12 text-accent",
  concluido: "bg-pos-bg text-pos-ink",
} as const;

/** Botão de ação conforme o papel da pessoa e a etapa do repasse. */
function AcaoRepasseLinha({ l, meuId, onAcao }: { l: LancGrupo; meuId: string; onAcao: (l: LancGrupo, acao: AcaoRepasse) => void }) {
  const base = "inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold transition active:scale-95 md:min-h-9";
  const sec = `${base} text-muted ring-1 ring-line hover:bg-background`;
  const prim = `${base} bg-accent text-on-accent`;

  if (l.respId === meuId) {
    // Quem DEVE: informa o repasse (não muda saldo); a confirmação é de quem recebeu
    if (l.situacaoRepasse === "pendente") return <button type="button" onClick={() => onAcao(l, "informar")} className={prim}><Ico icon={HandCoins} size={13} />Informar repasse</button>;
    if (l.situacaoRepasse === "aguardando") return <><span className="text-[11px] text-muted">Aguardando {l.autorNome}</span><button type="button" onClick={() => onAcao(l, "desinformar")} className={sec}><Ico icon={Undo2} size={13} />Cancelar aviso</button></>;
    return null;
  }
  if (l.autorId === meuId) {
    // Quem RECEBEU: confirma o recebimento (única forma de concluir) e é quem pode estornar
    if (l.situacaoRepasse === "concluido") return <button type="button" onClick={() => onAcao(l, "reabrir")} className={sec}><Ico icon={Undo2} size={13} />Estornar</button>;
    return <button type="button" onClick={() => onAcao(l, "concluir")} className={l.situacaoRepasse === "aguardando" ? prim : sec}><Ico icon={Check} size={13} />Confirmar recebimento</button>;
  }
  return null;
}

function LinhaGrupo({ l, meuId, onAcao }: { l: LancGrupo; meuId: string; onAcao?: (l: LancGrupo, acao: AcaoRepasse) => void }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <PessoaIcone pessoa={{ nome: l.respNome, avatar: l.respAvatar, cor: l.respCor }} icone={ICONE_TIPO[l.tipo]} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{l.descricao}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted">
          <b className="font-semibold text-ink">{l.respNome}</b>
          <Ico icon={ArrowRight} size={11} />
          <span>{l.autorNome}</span>
          <span aria-hidden>·</span>
          <span>{l.tipoRotulo}{l.parcela ? ` ${l.parcela}` : ""}</span>
          <span aria-hidden>·</span>
          <span>{rotuloMes(l.mes)}</span>
          {l.vencimento ? <><span aria-hidden>·</span><span>vence dia {l.vencimento}</span></> : null}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <AutorTag nome={l.autorNome} avatar={l.autorAvatar} cor={l.autorCor} />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR_SITUACAO[l.situacaoRepasse]}`}>{l.situacaoRepasse === "pendente" && !l.vencido ? "A vencer" : ROTULO_SITUACAO[l.situacaoRepasse]}</span>
          {l.contaPaga !== null && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.contaPaga ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-background text-muted ring-1 ring-line"}`}>{l.contaPaga ? "Conta paga" : "Conta a pagar"}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold tabular-nums">{brl(l.valor)}</p>
        {onAcao && <AcaoRepasseLinha l={l} meuId={meuId} onAcao={onAcao} />}
      </div>
    </li>
  );
}

/* ---------- Repasses ---------- */
const VALOR_TOM = { receber: "text-pos", pagar: "text-warn" } as const;

function Situacao({ l, lado }: { l: LancGrupo; lado: "receber" | "pagar" }) {
  const outro = lado === "receber" ? l.respNome : l.autorNome;
  if (l.situacaoRepasse === "concluido") return <span className="rounded-full bg-pos-bg px-2 py-0.5 text-[11px] font-bold text-pos-ink">Confirmado</span>;
  if (l.situacaoRepasse === "aguardando") return <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-bold text-accent">{lado === "receber" ? `${outro} informou · confirme` : `Aguardando ${outro} confirmar`}</span>;
  if (!l.vencido) return <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-muted ring-1 ring-line">A vencer</span>;
  return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-bold text-warn-ink">{lado === "receber" ? `${outro} ainda não repassou` : "Você ainda não repassou"}</span>;
}

type Selecao = { marcado: boolean; onChange: () => void; desabilitado: boolean };

function ItemRepasse({ l, lado, acoes, selecao }: { l: LancGrupo; lado: "receber" | "pagar"; acoes?: React.ReactNode; selecao?: Selecao }) {
  const quemPagou = lado === "receber" ? "Você pagou" : `${l.autorNome} pagou`;
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2 py-3 ${selecao?.marcado ? "bg-accent/8" : ""}`}>
      {selecao && <input type="checkbox" checked={selecao.marcado} disabled={selecao.desabilitado} onChange={selecao.onChange} aria-label={`Selecionar ${l.descricao}`} className="size-5 shrink-0 accent-[var(--accent)]" />}
      <div className="grid min-w-0 flex-1 basis-48 gap-1">
        <b className="text-sm font-semibold">{l.descricao}{l.parcela ? ` · ${l.parcela}` : ""}</b>
        <span className="text-xs text-muted">{quemPagou} · {l.tipoRotulo}{l.forma ? ` · ${l.forma}` : ""} · {rotuloMes(l.mes)}</span>
        <span><Situacao l={l} lado={lado} /></span>
      </div>
      <b className={`shrink-0 text-base tabular-nums ${l.repassePago ? "text-ink" : VALOR_TOM[lado]}`}>{brl(l.valor)}</b>
      {acoes && <div className="flex w-full flex-wrap gap-2 @md:w-auto">{acoes}</div>}
    </li>
  );
}

type GrupoPessoa = { id: string; nome: string; avatar: any; cor: any; itens: LancGrupo[] };

/** Um lado dos repasses (receber ou pagar): cartões por pessoa, seleção e ações individuais, por pessoa e em lote (a barra fica na aba). */
function SecaoRepasse({ lado, grupos, total, meuId, convidado, ocupado, selecionadas, onAlternar, onTodos, onAcao }: {
  lado: "receber" | "pagar"; grupos: GrupoPessoa[]; total: number; meuId: string; convidado: (id: string) => boolean; ocupado: boolean;
  selecionadas: Set<string>; onAlternar: (chave: string) => void; onTodos: (marcar: boolean) => void;
  onAcao: (ls: LancGrupo[], acao: AcaoRepasse) => void;
}) {
  const receber = lado === "receber";
  const todos = grupos.flatMap((g) => g.itens);
  const marcados = todos.filter((l) => selecionadas.has(l.chave));
  const todosMarcados = todos.length > 0 && marcados.length === todos.length;
  const aguardando = todos.filter((l) => l.situacaoRepasse === "aguardando");
  const validos = (ls: LancGrupo[], a: AcaoRepasse) => ls.filter((l) => repasseValidoParaAcao(l, a, meuId));
  const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 md:min-h-10";
  const btnItem = `${btn} border border-line bg-surface`;
  const btnPrim = `${btn} bg-accent text-on-accent`;
  const btnPerigo = `${btn} border border-warn-borda text-warn`;
  const tom = receber ? "text-pos" : "text-warn";
  return (
    <section className="card-glass grid content-start gap-3 p-4 @md:p-5" aria-label={receber ? "Tenho que receber" : "Tenho que pagar"}>
      <header className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 className="flex items-center gap-2 text-base font-bold"><span className={`grid size-7 place-items-center rounded-full ${receber ? "bg-pos-bg text-pos-ink" : "bg-warn-bg text-warn-ink"}`}><Ico icon={receber ? Check : HandCoins} size={15} /></span>{receber ? "Tenho que receber" : "Tenho que pagar"}</h3>
          <span className="text-xs text-muted">{todos.length} {todos.length === 1 ? "repasse" : "repasses"} em aberto{aguardando.length > 0 ? ` · ${brl(arred(aguardando.reduce((t, l) => t + l.valor, 0)))} aguardando confirmação` : ""}</span>
        </div>
        <b className={`text-xl tabular-nums ${total > 0 ? tom : "text-muted"}`}>{brl(total)}</b>
      </header>

      {todos.length === 0 ? <p className="rounded-xl bg-background p-3 text-sm text-muted">{receber ? "Ninguém te deve agora." : "Você não deve nada agora."}</p> : (
        <>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl bg-background px-3 text-sm font-medium ring-1 ring-line">
            <input type="checkbox" checked={todosMarcados} disabled={ocupado} onChange={() => onTodos(!todosMarcados)} className="size-5 accent-[var(--accent)]" />
            Selecionar todos <span className="text-xs text-muted">({todos.length})</span>
          </label>
          {grupos.map((p) => {
            const aguardandoP = p.itens.filter((l) => l.situacaoRepasse === "aguardando");
            const marcadosP = p.itens.filter((l) => selecionadas.has(l.chave));
            const nome1 = p.nome.split(" ")[0];
            const nConcluir = validos(p.itens, "concluir").length, nRecusar = validos(p.itens, "recusar").length;
            const nInformar = validos(p.itens, "informar").length, nCancelar = validos(p.itens, "desinformar").length;
            return (
              <div key={p.id} className="grid gap-1 rounded-2xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <input type="checkbox" aria-label={`Selecionar tudo de ${p.nome}`} checked={marcadosP.length === p.itens.length} ref={(el) => { if (el) el.indeterminate = marcadosP.length > 0 && marcadosP.length < p.itens.length; }} disabled={ocupado} onChange={() => { const marcar = marcadosP.length < p.itens.length; p.itens.forEach((l) => { if (selecionadas.has(l.chave) !== marcar) onAlternar(l.chave); }); }} className="size-5 shrink-0 accent-[var(--accent)]" />
                    <Avatar src={p.avatar} nome={p.nome} cor={p.cor} tamanho="sm" />
                    <b className="truncate text-sm">{p.nome}{receber && convidado(p.id) && <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line">convidado</span>}</b>
                  </span>
                  <span className="text-xs text-muted">{receber ? "falta receber" : "falta pagar"} <b className={`text-sm ${tom}`}>{brl(arred(p.itens.reduce((t, l) => t + l.valor, 0)))}</b>{marcadosP.length > 0 && <span className="ml-1.5 font-semibold text-accent">· {marcadosP.length} selecionado{marcadosP.length > 1 ? "s" : ""}</span>}</span>
                </div>
                <div className="flex flex-wrap gap-2 py-1">
                  {receber ? (
                    <>
                      {nConcluir > 0 && <button type="button" disabled={ocupado} onClick={() => onAcao(p.itens, "concluir")} className={btnPrim}><Ico icon={Check} size={15} />{aguardandoP.length > 0 ? `Confirmar tudo de ${nome1} (${nConcluir})` : `Marcar tudo de ${nome1} como recebido`}</button>}
                      {nRecusar > 0 && <button type="button" disabled={ocupado} onClick={() => onAcao(p.itens, "recusar")} className={btnPerigo}><Ico icon={X} size={15} />Recusar informados ({nRecusar})</button>}
                    </>
                  ) : (
                    <>
                      {nInformar > 0 && <button type="button" disabled={ocupado} onClick={() => onAcao(p.itens, "informar")} className={btnPrim}><Ico icon={HandCoins} size={15} />Informar devolução a {nome1} ({nInformar})</button>}
                      {nCancelar > 0 && <button type="button" disabled={ocupado} onClick={() => onAcao(p.itens, "desinformar")} className={btnItem}><Ico icon={Undo2} size={15} />Cancelar avisos ({nCancelar})</button>}
                    </>
                  )}
                </div>
                <ul className="divide-y divide-line">
                  {p.itens.map((l) => (
                    <ItemRepasse key={l.chave} l={l} lado={lado}
                      selecao={{ marcado: selecionadas.has(l.chave), onChange: () => onAlternar(l.chave), desabilitado: ocupado }}
                      acoes={receber
                        ? <>
                            <button type="button" disabled={ocupado} onClick={() => onAcao([l], "concluir")} className={`${l.situacaoRepasse === "aguardando" ? btnPrim : btnItem} flex-1 @md:flex-none`}><Ico icon={Check} size={15} />{l.situacaoRepasse === "aguardando" ? "Confirmar recebimento" : convidado(l.respId) ? "Registrar recebimento" : "Já recebi"}</button>
                            {l.situacaoRepasse === "aguardando" && <button type="button" disabled={ocupado} onClick={() => onAcao([l], "recusar")} className={`${btnPerigo} flex-1 @md:flex-none`}><Ico icon={X} size={15} />Recusar</button>}
                          </>
                        : l.situacaoRepasse === "pendente"
                          ? <button type="button" disabled={ocupado} onClick={() => onAcao([l], "informar")} className={`${btnItem} flex-1 @md:flex-none`}><Ico icon={HandCoins} size={15} />Informar repasse</button>
                          : <>
                              <button type="button" disabled={ocupado} onClick={() => onAcao([l], "desinformar")} className={`${btnItem} flex-1 @md:flex-none`}><Ico icon={Undo2} size={15} />Cancelar aviso</button>
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Ico icon={Lock} size={13} />Só {l.autorNome.split(" ")[0]} pode confirmar</span>
                            </>} />
                  ))}
                </ul>
                {receber && convidado(p.id) && <p className="text-xs text-muted">Convidados não usam o app: quando receber, registre você mesmo. Nada é descontado de conta do convidado.</p>}
              </div>
            );
          })}
        </>
      )}
      {!receber && <p className="text-xs text-muted">Informar não muda nenhum saldo. O dinheiro só sai da sua conta quando a outra pessoa confirmar.</p>}
    </section>
  );
}

/** Barra fixa com a seleção atual: aparece quando há itens marcados. */
function BarraLote({ lado, itens, meuId, ocupado, onAcao, onLimpar }: { lado: "receber" | "pagar"; itens: LancGrupo[]; meuId: string; ocupado: boolean; onAcao: (ls: LancGrupo[], a: AcaoRepasse) => void; onLimpar: () => void }) {
  if (itens.length === 0) return null;
  const n = (a: AcaoRepasse) => itens.filter((l) => repasseValidoParaAcao(l, a, meuId)).length;
  const total = arred(itens.reduce((t, l) => t + l.valor, 0));
  const pessoas = new Set(itens.map((l) => (lado === "receber" ? l.respId : l.autorId))).size;
  const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50";
  return (
    <div role="region" aria-label="Ações para os repasses selecionados" className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[min(46rem,calc(100vw-3rem))] md:-translate-x-1/2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#0d1b24] p-3 text-[#eaf2f6] shadow-2xl ring-1 ring-white/15">
        <div className="min-w-0 flex-1 basis-40">
          <b className="block text-xl tabular-nums leading-tight">{brl(total)}</b>
          <span className="text-xs opacity-75">{itens.length} {itens.length === 1 ? "selecionado" : "selecionados"} · {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}</span>
        </div>
        <button type="button" onClick={onLimpar} className={`${btn} text-[#eaf2f6]/80`}>Limpar</button>
        {lado === "receber" ? (
          <>
            <button type="button" disabled={ocupado || n("recusar") === 0} onClick={() => onAcao(itens, "recusar")} className={`${btn} border border-[#ffb4ad]/50 text-[#ffb4ad]`}><Ico icon={X} size={15} />Recusar{n("recusar") > 0 ? ` (${n("recusar")})` : ""}</button>
            <button type="button" disabled={ocupado || n("concluir") === 0} onClick={() => onAcao(itens, "concluir")} className={`${btn} min-w-[12rem] flex-1 bg-accent text-on-accent`}><Ico icon={Check} size={15} />{itens.some((l) => l.situacaoRepasse === "aguardando") ? "Confirmar recebimento" : "Marcar como recebido"} ({n("concluir")})</button>
          </>
        ) : (
          <>
            {n("desinformar") > 0 && <button type="button" disabled={ocupado} onClick={() => onAcao(itens, "desinformar")} className={`${btn} border border-white/35`}><Ico icon={Undo2} size={15} />Cancelar aviso ({n("desinformar")})</button>}
            {n("informar") > 0 && <button type="button" disabled={ocupado} onClick={() => onAcao(itens, "informar")} className={`${btn} min-w-[12rem] flex-1 bg-accent text-on-accent`}><Ico icon={HandCoins} size={15} />Informar devolução ({n("informar")})</button>}
          </>
        )}
      </div>
    </div>
  );
}

function AbaRepasses({ lista, mes, outrosMeses, meuId, membros, ocupado, onRepasse, onEstornar, onNova }: { lista: LancGrupo[]; mes: string; outrosMeses: { total: number; abertos: number }; meuId: string; membros: Membro[]; ocupado: boolean; onRepasse: Repasse; onEstornar: (ls: LancGrupo[]) => void; onNova: () => void }) {
  const [verFuturos, setVerFuturos] = useState(false);
  // A seleção guarda "chave|situação": quando um repasse muda de situação (informado, confirmado, recusado) ele sai sozinho da seleção.
  const [selR, setSelR] = useState<Set<string>>(new Set());
  const [selP, setSelP] = useState<Set<string>>(new Set());
  const marca = (l: LancGrupo) => `${l.chave}|${l.situacaoRepasse}`;
  const marcaDe = (chave: string) => { const l = lista.find((x) => x.chave === chave); return l ? marca(l) : chave; };
  const alternar = (set: React.Dispatch<React.SetStateAction<Set<string>>>, outro: React.Dispatch<React.SetStateAction<Set<string>>>, chave: string) => {
    outro(new Set()); // seleção de um lado de cada vez: a barra de ações vale para um só
    set((x) => { const n = new Set(x); const m = marcaDe(chave); if (n.has(m)) n.delete(m); else n.add(m); return n; });
  };
  const convidado = (id: string) => membros.find((m) => m.id === id)?.convidado ?? false;
  const abertos = lista.filter((l) => !l.repassePago);
  const vencidos = abertos.filter((l) => l.vencido);
  const futuros = abertos.filter((l) => !l.vencido);
  const receber = vencidos.filter((l) => l.autorId === meuId);
  const pagar = vencidos.filter((l) => l.respId === meuId);
  const concluidos = lista.filter((l) => l.repassePago && (l.autorId === meuId || l.respId === meuId)).sort((a, b) => String(b.repassePagoEm || "").localeCompare(String(a.repassePagoEm || "")));
  const soma = (ls: LancGrupo[]) => arred(ls.reduce((t, l) => t + l.valor, 0));
  const porPessoa = (ls: LancGrupo[], chave: "respId" | "autorId") => {
    const mapa = new Map<string, LancGrupo[]>();
    for (const l of ls) mapa.set(l[chave], [...(mapa.get(l[chave]) || []), l]);
    return [...mapa.entries()].map(([id, itens]) => ({ id, nome: chave === "respId" ? itens[0].respNome : itens[0].autorNome, avatar: chave === "respId" ? itens[0].respAvatar : itens[0].autorAvatar, cor: chave === "respId" ? itens[0].respCor : itens[0].autorCor, itens })).sort((a, b) => soma(b.itens) - soma(a.itens));
  };
  const paraConfirmar = porPessoa(receber.filter((l) => l.situacaoRepasse === "aguardando"), "respId");
  const paraInformar = porPessoa(pagar.filter((l) => l.situacaoRepasse === "pendente"), "autorId");
  // Só segue o que ainda vale para esta ação e para este usuário (nunca concluídos, nunca o próprio pagamento)
  const acao = (ls: LancGrupo[], a: AcaoRepasse) => {
    if (ocupado) return;
    const validos = ls.filter((l) => repasseValidoParaAcao(l, a, meuId));
    if (validos.length === 0) return;
    void onRepasse(validos.map((l) => ({ origem: l.origem, id: l.id })), a);
  };
  const chavesSel = (ls: LancGrupo[], sel: Set<string>) => new Set(ls.filter((l) => sel.has(marca(l))).map((l) => l.chave));
  const selRChaves = chavesSel(receber, selR), selPChaves = chavesSel(pagar, selP);
  const ladoBarra: "receber" | "pagar" = selRChaves.size > 0 ? "receber" : "pagar";
  const itensBarra = ladoBarra === "receber" ? receber.filter((l) => selRChaves.has(l.chave)) : pagar.filter((l) => selPChaves.has(l.chave));
  const btn = "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 @md:flex-none md:min-h-10";

  if (lista.length === 0 && outrosMeses.total > 0) {
    return (
      <div className="card-glass grid gap-1 p-5" role="status">
        <h3 className="text-base font-bold">Nenhum repasse em {rotuloMes(mes)}</h3>
        <p className="text-sm text-muted">{outrosMeses.abertos > 0 ? `Há ${outrosMeses.abertos} ${outrosMeses.abertos === 1 ? "repasse em aberto" : "repasses em aberto"} em outros meses. ` : ""}Troque o mês no topo da tela para consultar os repasses de outros períodos.</p>
      </div>
    );
  }
  if (lista.length === 0) {
    return <EstadoVazio icone={HandCoins} titulo="Nenhum repasse ainda" descricao="Quando você lança uma despesa e escolhe outra pessoa do grupo como responsável, o valor aparece aqui. Quem deve informa o repasse e quem recebeu confirma." passos={["Toque em Nova transação e escolha Saída", "Em Mais opções, marque a pessoa responsável pelo gasto", "Quem deve informa o repasse; quem recebeu confirma"]} acao={{ rotulo: "Nova transação", onClick: onNova }} />;
  }

  return (
    <div className="@container grid gap-5">
      <p className="px-1 text-sm text-muted">Repasses de {rotuloMes(mes)}.{outrosMeses.abertos > 0 ? ` Há ${outrosMeses.abertos} ${outrosMeses.abertos === 1 ? "repasse em aberto" : "repasses em aberto"} em outros meses: troque o mês no topo para ver.` : ""}</p>
      <section className="card-glass grid grid-cols-2 overflow-hidden @2xl:grid-cols-3" aria-label="Situação dos repasses">
        <div className="grid gap-0.5 p-4"><span className="text-xs font-medium text-muted">Tenho que receber</span><span className={`text-xl font-bold tabular-nums ${soma(receber) > 0 ? "text-pos" : ""}`}>{brl(soma(receber))}</span><span className="text-xs text-muted">{porPessoa(receber, "respId").map((p) => p.nome).join(", ") || "nada em aberto"}</span></div>
        <div className="grid gap-0.5 border-l border-line p-4"><span className="text-xs font-medium text-muted">Tenho que pagar</span><span className={`text-xl font-bold tabular-nums ${soma(pagar) > 0 ? "text-warn" : ""}`}>{brl(soma(pagar))}</span><span className="text-xs text-muted">{porPessoa(pagar, "autorId").map((p) => p.nome).join(", ") || "nada em aberto"}</span></div>
        <div className="col-span-2 grid gap-0.5 border-t border-line p-4 @2xl:col-span-1 @2xl:border-l @2xl:border-t-0"><span className="text-xs font-medium text-muted">Aguardando minha ação</span><span className="text-xl font-bold tabular-nums">{paraConfirmar.length + paraInformar.length}</span><span className="text-xs text-muted">{paraConfirmar.length} para confirmar · {paraInformar.length} para informar</span></div>
      </section>

      <div className="grid gap-5 @4xl:grid-cols-2">
        <SecaoRepasse lado="receber" grupos={porPessoa(receber, "respId")} total={soma(receber)} meuId={meuId} convidado={convidado} ocupado={ocupado}
          selecionadas={selRChaves} onAlternar={(c) => alternar(setSelR, setSelP, c)} onTodos={(m) => { setSelP(new Set()); setSelR(m ? new Set(receber.map(marca)) : new Set()); }} onAcao={acao} />
        <SecaoRepasse lado="pagar" grupos={porPessoa(pagar, "autorId")} total={soma(pagar)} meuId={meuId} convidado={convidado} ocupado={ocupado}
          selecionadas={selPChaves} onAlternar={(c) => alternar(setSelP, setSelR, c)} onTodos={(m) => { setSelR(new Set()); setSelP(m ? new Set(pagar.map(marca)) : new Set()); }} onAcao={acao} />
      </div>

      <BarraLote lado={ladoBarra} itens={itensBarra} meuId={meuId} ocupado={ocupado} onAcao={acao} onLimpar={() => { setSelR(new Set()); setSelP(new Set()); }} />

      {futuros.length > 0 && (
        <section className="card-glass grid gap-2 p-5">
          <button type="button" onClick={() => setVerFuturos((v) => !v)} className="flex min-h-11 items-center justify-between gap-3 text-left">
            <span className="grid"><b className="text-sm">Próximos meses</b><span className="text-xs text-muted">{futuros.length} parcelas ou contas a vencer · {brl(soma(futuros))}</span></span>
            <span className="text-sm font-semibold text-accent">{verFuturos ? "Ocultar" : "Ver"}</span>
          </button>
          {verFuturos && <ul>{futuros.map((l) => <ItemRepasse key={l.chave} l={l} lado={l.autorId === meuId ? "receber" : "pagar"} />)}</ul>}
        </section>
      )}

      <section className="card-glass grid gap-2 p-5" aria-label="Concluídos">
        <h3 className="text-base font-bold">Concluídos</h3>
        {concluidos.length === 0 ? <p className="py-2 text-sm text-muted">Nenhum repasse confirmado ainda.</p> : (
          <ul>
            {concluidos.slice(0, 20).map((l) => {
              const recebi = l.autorId === meuId;
              return (
                <li key={l.chave} data-lanc-id={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0">
                  <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                    <b className="text-sm">{recebi ? `${l.respNome} → você` : `Você → ${l.autorNome}`}</b>
                    <span className="text-xs text-muted">{l.descricao}{l.parcela ? ` · ${l.parcela}` : ""} · confirmado em {l.repassePagoEm ? new Date(l.repassePagoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</span>
                  </div>
                  <b className="shrink-0 text-sm tabular-nums">{brl(l.valor)}</b>
                  {recebi && <div className="flex w-full @md:w-auto"><button type="button" disabled={ocupado} onClick={() => onEstornar([l])} className={`${btn} border border-warn-borda text-warn`}><Ico icon={Undo2} size={15} />Estornar</button></div>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Só quem recebeu confirma e estorna. Despesa com repasse confirmado não pode ser editada nem excluída antes do estorno.</p>
      </section>
    </div>
  );
}

/** Cancelar aviso e recusar recebimento: desfazem o "informado" e o repasse volta a pendente. Pedem confirmação, com quantidade e valor. */
function ConfirmarSimples({ acao, itens, onFechar, onConfirmar }: { acao: "desinformar" | "recusar"; itens: LancGrupo[]; onFechar: () => void; onConfirmar: () => void }) {
  const total = arred(itens.reduce((t, l) => t + l.valor, 0));
  const recusar = acao === "recusar";
  const nomes = [...new Set(itens.map((l) => (recusar ? l.respNome : l.autorNome).split(" ")[0]))].join(", ");
  const n = itens.length;
  return (
    <DialogResponsivo titulo={recusar ? (n > 1 ? `Recusar ${n} recebimentos` : "Recusar recebimento") : (n > 1 ? `Cancelar ${n} avisos` : "Cancelar aviso")} onFechar={onFechar}>
      <div className="grid gap-4">
        <p className="text-sm">{recusar ? `${nomes} informou que repassou, mas o valor não bateu? ` : "Você avisou que já repassou. "}{recusar ? "O repasse volta a ficar pendente e quem deve precisa informar de novo." : `O repasse volta a ficar pendente e ${nomes} deixa de ver o aviso.`}</p>
        <div className="rounded-xl bg-background p-3 text-sm ring-1 ring-line">
          <p><b>{n} {n === 1 ? "repasse" : "repasses"}</b> · total <b className="tabular-nums">{brl(total)}</b></p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-muted">{itens.map((l) => <li key={l.chave} className="flex justify-between gap-3"><span className="truncate">{(recusar ? l.respNome : l.autorNome)} · {l.descricao}{l.parcela ? ` · ${l.parcela}` : ""}</span><span className="tabular-nums">{brl(l.valor)}</span></li>)}</ul>
        </div>
        <p className="text-xs text-muted">Nenhum saldo muda com esta ação. Repasses já concluídos não entram.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Voltar</button>
          <button type="button" onClick={onConfirmar} className={`min-h-11 rounded-xl px-5 text-sm font-semibold ${recusar ? "border border-warn-borda text-warn" : "bg-accent text-on-accent"}`}>{recusar ? `Recusar ${brl(total)}` : `Cancelar ${n > 1 ? "avisos" : "aviso"}`}</button>
        </div>
      </div>
    </DialogResponsivo>
  );
}

/** Estorno: hoje reabre o repasse; o histórico completo do estorno depende da migração de repasses (Fase B). */
function ConfirmarEstorno({ itens, onFechar, onConfirmar }: { itens: LancGrupo[]; onFechar: () => void; onConfirmar: () => void }) {
  const total = itens.reduce((t, l) => t + l.valor, 0);
  return (
    <DialogResponsivo titulo="Estornar repasse" onFechar={onFechar}>
      <div className="grid gap-4">
        <p className="text-sm">Estornar <b className="tabular-nums">{brl(total)}</b> ({itens.map((l) => l.descricao).join(", ")})?</p>
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          <li>Os dois saldos voltam ao que eram antes da confirmação.</li>
          <li>O repasse volta a ficar pendente e a despesa pode ser editada de novo.</li>
          <li>Não é possível estornar um repasse confirmado em mês fechado.</li>
        </ul>
        <p className="rounded-xl bg-warn-bg p-3 text-xs leading-relaxed text-warn-ink">Por enquanto o banco não guarda um registro separado do estorno. O histórico completo (repasse original + estorno) depende da migração de repasses, ainda não aplicada.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium">Cancelar</button>
          <button type="button" onClick={onConfirmar} className="min-h-11 rounded-xl border border-warn-borda px-5 text-sm font-semibold text-warn">Estornar {brl(total)}</button>
        </div>
      </div>
    </DialogResponsivo>
  );
}

/* ---------- Lançamentos do grupo ---------- */
function AbaLancamentos({ lista, membros, meuId, mes, onRepasse }: { lista: LancGrupo[]; membros: Membro[]; meuId: string; mes: string; onRepasse: Repasse }) {
  const [f, setF] = useState<FiltroGrupo>(FILTRO_GRUPO_INICIAL);
  const filtrada = useMemo(() => filtrarGrupo(lista, f), [lista, f]);
  const total = filtrada.reduce((t, l) => t + l.valor, 0);
  const ativos = JSON.stringify(f) !== JSON.stringify(FILTRO_GRUPO_INICIAL);
  const acao = (l: LancGrupo, a: AcaoRepasse) => void onRepasse([{ origem: l.origem, id: l.id }], a);

  return (
    <div className="space-y-4">
      <section className="card-glass space-y-3 p-4 md:p-5" aria-label="Filtros dos lançamentos do grupo">
        <div className="flex items-center justify-between">
          <div><h3 className="text-base font-bold">Lançamentos do grupo</h3><p className="text-xs text-muted">O que uma pessoa lançou para outra ser a responsável em {rotuloMes(mes)}.</p></div>
          {ativos && <button type="button" onClick={() => setF(FILTRO_GRUPO_INICIAL)} className="text-xs font-medium text-accent hover:underline">Limpar filtros</button>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select aria-label="Tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as FiltroGrupo["tipo"] })} className={sel}>
            <option value="todos">Todos os tipos</option><option value="avista">Despesas à vista</option><option value="parcelada">Compras parceladas</option><option value="fixa">Contas fixas</option>
          </select>
          <select aria-label="Responsável" value={f.responsavelId} onChange={(e) => setF({ ...f, responsavelId: e.target.value })} className={sel}>
            <option value="">Qualquer responsável</option>{membros.map((m) => <option key={m.id} value={m.id}>Responsável: {m.nome}</option>)}
          </select>
          <select aria-label="Quem lançou" value={f.autorId} onChange={(e) => setF({ ...f, autorId: e.target.value })} className={sel}>
            <option value="">Qualquer autor</option>{membros.map((m) => <option key={m.id} value={m.id}>Lançado por {m.nome}</option>)}
          </select>
          <select aria-label="Situação" value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value as FiltroGrupo["situacao"] })} className={sel}>
            <option value="todas">Todas as situações</option><option value="repasse-pendente">Repasse pendente</option><option value="repasse-aguardando">Repassado (aguardando confirmação)</option><option value="repasse-concluido">Repasse concluído</option><option value="conta-a-pagar">Conta fixa a pagar</option><option value="conta-paga">Conta fixa paga</option>
          </select>
        </div>
      </section>
      {filtrada.length === 0 ? (
        <EstadoVazio compacto icone={ICONES.grupo} titulo={ativos ? "Nada encontrado com esses filtros" : "Nenhum lançamento entre membros"} descricao={ativos ? "Tente limpar os filtros." : "Quando alguém lançar uma despesa para outra pessoa ser a responsável, ela aparece aqui."} />
      ) : (
        <section className="card-glass px-4 py-1 md:px-5">
          <p className="border-b border-line py-3 text-xs text-muted">{filtrada.length} {filtrada.length === 1 ? "lançamento" : "lançamentos"} · total <b className="text-ink">{brl(total)}</b></p>
          <ul className="anim-stagger divide-y divide-line">{filtrada.map((l) => <LinhaGrupo key={l.chave} l={l} meuId={meuId} onAcao={acao} />)}</ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Resumo por membro ---------- */
function AbaResumo({ dados, membros, meuId, mes }: { dados: Dados; membros: Membro[]; meuId: string; mes: string }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const resumos = useMemo(() => resumoPorMembro(dados, membros, mes, { meuId }), [dados, membros, mes, meuId]);

  const alternarMeuResumo = async (visivel: boolean) => {
    setSalvando(true);
    setErro("");
    const { data, error } = await supabase.from("perfis").update({ resumo_visivel: visivel }).eq("id", meuId).select("id").maybeSingle();
    setSalvando(false);
    if (error || !data) {
      const msg = /resumo_visivel/.test(error?.message || "") ? "Execute o script supabase-04-grupo-repasses.sql no Supabase para habilitar esta opção." : "Não foi possível salvar sua preferência.";
      setErro(msg);
      avisos.erro("Preferência não salva", msg);
      return;
    }
    avisarPerfilAtualizado();
    avisos.sucesso(visivel ? "Seu resumo agora aparece para o grupo" : "Seu resumo ficou oculto para o grupo");
  };

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-muted">Resumo de {rotuloMes(mes)} por pessoa. Para os outros membros, considera os lançamentos que você tem permissão para ver.</p>
      <div className="anim-stagger grid gap-4 md:grid-cols-2">
        {membros.map((m) => {
          const eu = m.id === meuId;
          const r = resumos.find((x) => x.id === m.id)!;
          const oculto = !eu && !m.resumoVisivel;
          return (
            <article key={m.id} className="card-glass space-y-4 p-5">
              <header className="flex items-center gap-3">
                <Avatar src={m.avatar} nome={m.nome} cor={m.cor} tamanho="lg" anel />
                <div className="min-w-0"><p className="truncate text-base font-bold">{m.nome}{eu && <span className="ml-2 text-xs font-medium text-accent">você</span>}</p><p className="text-xs text-muted">{m.cargo === "gestor" || m.cargo === "admin" ? "Gestor" : m.convidado ? "Convidado" : "Membro"}</p></div>
              </header>
              {oculto ? (
                <p className="flex items-center gap-2 rounded-xl bg-background p-4 text-sm text-muted"><Ico icon={Lock} size={16} />{m.nome} escolheu não exibir o resumo financeiro.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-emerald-500/10 p-3"><dt className="text-xs text-muted">Entradas</dt><dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{brl(r.entradas)}</dd></div>
                  <div className="rounded-xl bg-rose-500/10 p-3"><dt className="text-xs text-muted">Despesas</dt><dd className="font-semibold tabular-nums text-rose-700 dark:text-rose-400">{brl(r.saidas)}</dd></div>
                  <div className="rounded-xl bg-background p-3 ring-1 ring-line"><dt className="text-xs text-muted">Saldo restante</dt><dd className={`font-semibold tabular-nums ${r.saldo < 0 ? "text-rose-700 dark:text-rose-400" : ""}`}>{r.saldo < 0 ? "− " : ""}{brl(Math.abs(r.saldo))}</dd></div>
                  <div className="rounded-xl bg-amber-500/10 p-3"><dt className="text-xs text-muted">Repasses</dt><dd className="text-xs font-semibold tabular-nums">Receber {brl(r.aReceber)}<br />Repassar {brl(r.aRepassar)}{(r.aReceberAguardando > 0 || r.aRepassarAguardando > 0) && <span className="mt-1 block font-medium text-sky-700 dark:text-sky-400">Aguardando confirmação {brl(r.aReceberAguardando + r.aRepassarAguardando)}</span>}</dd></div>
                </dl>
              )}
              {eu && (
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <span><span className="block font-medium">Mostrar meu resumo ao grupo</span><span className="block text-xs text-muted">Desligado, os outros não veem suas entradas, despesas e saldo aqui.</span></span>
                  <input type="checkbox" role="switch" checked={m.resumoVisivel} disabled={salvando} onChange={(e) => alternarMeuResumo(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
                </label>
              )}
            </article>
          );
        })}
      </div>
      {erro && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">{erro}</p>}
    </div>
  );
}

/* ---------- Tela ---------- */
export default function TelaGrupo({
  dados, membros, userId, mes, onRepasse, onGerenciar, onNova, abaInicial = "resumo", pessoasFiltradas = null,
}: { dados: Dados; membros: Membro[]; userId: string | null; mes: string; onRepasse: Repasse; onGerenciar: () => void; onNova: () => void; abaInicial?: Sub; /** ids das pessoas do filtro de responsáveis; null = todo o grupo */ pessoasFiltradas?: Set<string> | null }) {
  const [sub, setSub] = useState<Sub>(abaInicial);
  const meuId = userId || "";
  // Lançamentos e repasses mostram só o mês selecionado (o mês atual, por padrão), sem misturar períodos.
  // Os meses anteriores continuam guardados: basta trocar o mês no topo para consultar.
  const doGrupo = useMemo(() => filtrarGrupoPorPessoas(lancamentosDoGrupo(dados), pessoasFiltradas), [dados, pessoasFiltradas]);
  const lista = useMemo(() => repassesDoMes(doGrupo, mes), [doGrupo, mes]);
  const membrosVisiveis = useMemo(() => (pessoasFiltradas ? membros.filter((m) => pessoasFiltradas.has(m.id)) : membros), [membros, pessoasFiltradas]);
  // Repasses: também só do mês selecionado. O que ficou em outros meses é só avisado (contagem), não misturado.
  const listaRepasses = lista;
  const repassesOutrosMeses = useMemo(() => ({ total: doGrupo.length - lista.length, abertos: doGrupo.filter((l) => l.mes !== mes && !l.repassePago).length }), [doGrupo, lista, mes]);
  // Ações minhas: informar um repasse que devo (pendente) ou confirmar um recebimento (aguardando)
  const pendentes = useMemo(() => listaRepasses.filter((l) => l.vencido && ((l.respId === meuId && l.situacaoRepasse === "pendente") || (l.autorId === meuId && l.situacaoRepasse === "aguardando"))).length, [listaRepasses, meuId]);
  // Confirmar ("concluir") e informar perguntam antes a conta; estornar ("reabrir") pede confirmação
  const [pedindoConta, setPedindoConta] = useState<{ acao: "concluir" | "informar"; itens: { origem: "extrato" | "cartao" | "contas"; id: string }[] } | null>(null);
  const [estornando, setEstornando] = useState<LancGrupo[] | null>(null);
  const [simples, setSimples] = useState<{ acao: "desinformar" | "recusar"; itens: LancGrupo[] } | null>(null);
  // Uma ação de repasse por vez: evita confirmação duplicada por clique repetido (o banco é a garantia final)
  const [ocupado, setOcupado] = useState(false);
  const executar: Repasse = async (itens, acao, conta) => {
    if (ocupado) return false;
    setOcupado(true);
    try { return await onRepasse(itens, acao, conta); } finally { setOcupado(false); }
  };
  const repasseComConta: Repasse = async (itens, acao, conta) => {
    if ((acao === "concluir" || acao === "informar") && conta === undefined) { setPedindoConta({ acao, itens }); return true; }
    if ((acao === "desinformar" || acao === "recusar") && conta === undefined) { setSimples({ acao, itens: listaRepasses.filter((l) => itens.some((i) => i.origem === l.origem && i.id === l.id)) }); return true; }
    if (acao === "reabrir") { setEstornando(listaRepasses.filter((l) => itens.some((i) => i.origem === l.origem && i.id === l.id))); return true; }
    return executar(itens, acao, conta);
  };
  const lancamentosPedidos = pedindoConta ? listaRepasses.filter((l) => pedindoConta.itens.some((i) => i.origem === l.origem && i.id === l.id)) : [];
  const chip = (a: boolean) => `relative h-11 flex-1 md:h-10 rounded-full text-sm font-semibold transition sm:flex-none sm:px-5 ${a ? "bg-accent text-on-accent shadow-sm" : "text-muted"}`;

  if (membros.length === 0) {
    return <EstadoVazio icone={ICONES.grupo} titulo="Você ainda não faz parte de um grupo" descricao="Crie um grupo para a sua família ou entre em um existente. Com o grupo, vocês dividem despesas, veem quem lançou cada gasto e acompanham valores a repassar." acao={{ rotulo: "Criar ou entrar em um grupo", onClick: onGerenciar }} />;
  }

  return (
    <div className="space-y-5">
      <section className="card-glass flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3"><AvatarPilha pessoas={membros.map((m) => ({ nome: m.nome, avatar: m.avatar, cor: m.cor }))} tamanho="md" /><p className="text-sm text-muted">{membros.length} {membros.length === 1 ? "pessoa" : "pessoas"} no grupo</p></div>
        <button type="button" onClick={onGerenciar} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:bg-background md:h-10"><Ico icon={Settings2} size={16} />Gerenciar grupo</button>
      </section>

      <div className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line sm:w-fit" role="tablist" aria-label="Seções do grupo">
        <button type="button" role="tab" aria-selected={sub === "resumo"} onClick={() => setSub("resumo")} className={chip(sub === "resumo")}>Resumo</button>
        <button type="button" role="tab" aria-selected={sub === "lancamentos"} onClick={() => setSub("lancamentos")} className={chip(sub === "lancamentos")}>Lançamentos</button>
        <button type="button" role="tab" aria-selected={sub === "repasses"} onClick={() => setSub("repasses")} className={chip(sub === "repasses")}>Repasses{pendentes > 0 && <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-warn px-1.5 text-[11px] font-bold text-surface">{pendentes}</span>}</button>
      </div>

      {sub === "resumo" && <AbaResumo dados={dados} membros={membrosVisiveis} meuId={meuId} mes={mes} />}
      {sub === "lancamentos" && <AbaLancamentos lista={lista} membros={membros} meuId={meuId} mes={mes} onRepasse={repasseComConta} />}
      {sub === "repasses" && <AbaRepasses lista={listaRepasses} mes={mes} outrosMeses={repassesOutrosMeses} meuId={meuId} membros={membros} ocupado={ocupado} onRepasse={repasseComConta} onEstornar={(ls) => setEstornando(ls)} onNova={onNova} />}
      {pedindoConta && (
        <EscolherContaRepasse
          modo={pedindoConta.acao === "concluir" ? "receber" : "repassar"}
          lista={lancamentosPedidos}
          dados={dados}
          userId={meuId}
          mes={mes}
          onFechar={() => setPedindoConta(null)}
          onConfirmar={(conta) => {
            const a = pedindoConta.acao;
            // Revalida contra a lista atual: só entra o que ainda está em aberto e é meu para agir (nunca concluído, nunca de outro grupo)
            const itens = lancamentosPedidos
              .filter((l) => repasseValidoParaAcao(l, a, meuId))
              .map((l) => ({ origem: l.origem, id: l.id }));
            setPedindoConta(null);
            if (itens.length === 0) { avisos.aviso("Nada para atualizar", "Esses repasses já foram atualizados."); return; }
            void executar(itens, a, conta);
          }}
        />
      )}
      {simples && simples.itens.length > 0 && (
        <ConfirmarSimples
          acao={simples.acao}
          itens={simples.itens}
          onFechar={() => setSimples(null)}
          onConfirmar={() => {
            const a = simples.acao;
            // Reconfere com a lista atual antes de enviar
            const itens = simples.itens.map((x) => listaRepasses.find((l) => l.chave === x.chave) ?? x).filter((l) => repasseValidoParaAcao(l, a, meuId)).map((l) => ({ origem: l.origem, id: l.id }));
            setSimples(null);
            if (itens.length === 0) { avisos.aviso("Nada para atualizar", "Esses repasses já foram atualizados."); return; }
            void executar(itens, a, null);
          }}
        />
      )}
      {estornando && estornando.length > 0 && (
        <ConfirmarEstorno
          itens={estornando}
          onFechar={() => setEstornando(null)}
          onConfirmar={() => { const itens = estornando.map((l) => ({ origem: l.origem, id: l.id })); setEstornando(null); void executar(itens, "reabrir"); }}
        />
      )}
    </div>
  );
}
